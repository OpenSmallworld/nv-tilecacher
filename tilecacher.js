const { http, https } = require('follow-redirects');
const fs = require('fs');
const async = require('async');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const util = require('util');
const url = require('url');
const uaaUtil = require('predix-uaa-client');

// Ramp up the number of sockets so that we can make as many web calls as possible.
http.globalAgent.maxSockets = 500000;
https.globalAgent.maxSockets = http.globalAgent.maxSockets;

const usageOptions = {
	title: 'tilecacher',
	description: 'Makes WMTS requests to a server over a set of bounding boxes'
}

var optionDef = [
	{ name: 'configfile', alias: 'c', type: String, description: 'The name of a JSON file containing the caching definitions' },
	{ name: 'configdir', alias: 'd', type: String, description: 'A directory that contains a set of JSON config files. Use instead of -c for multiple configs' },
	{ name: 'help', alias: 'h', description: 'Display usage' },
	{ name: 'workers', alias: 'w', type: Number, defaultOption: 10, description: 'Number of simultaneous requests made at a time (default 10)' },
	{ name: 'countonly', alias: 'o', type: Boolean, defaultOption: false, description: 'Whether to only count tiles or not - true or false (default false)' },
	{ name: 'reportinterval', alias: 'r', type: Number, description: 'The number of requests that progress is reported on e.g. every 100 requests, 1000 requests etc. Requires verboserequests to be true.' },
	{ name: 'connectionpooling', alias: 'p', type: Boolean, description: 'Use connection pooling' },
	{ name: 'verbose', alias: 'v', type: Boolean, description: 'Output information verbosely' },
	{ name: 'verboserequests', alias: 'b', type: Boolean, description: 'Output request information verbosely' },
	{ name: 'extraverboserequests', alias: 'x', type: Boolean, description: 'Extra verbose request information' },
	{ name: 'sockettimeout', alias: 's', type: Number, defaultOption: 120, description: 'The timeout period for the socket connection in seconds (default 120)' },
	{ name: 'zoomstartoverride', alias: 'i', type: Number, description: 'Override the zoom start value' },
	{ name: 'zoomstopoverride', alias: 'j', type: Number, description: 'Override the zoom stop value' },
	{ name: 'servernameoverride', alias: 'k', type: String, description: 'Override the name of the server' },
	{ name: 'serverportoverride', alias: 'l', type: Number, description: 'Override the server port' },
	{ name: 'serverprotocoloverride', alias: 'n', type: String, description: 'Override the protocol of the server' },
	{ name: 'layersoverride', alias: 'm', type: String, description: 'Override the layers' },
	{ name: 'displaymemoryusage', alias: 'u', type: Boolean, description: 'Display the memory heap usage' }
];

var options = commandLineArgs(optionDef);
var optionList = [];

optionList.push({
	header: 'tilecacher',
	content: 'Tool for making WMTS requests to a tile server'
});

var optionDetail = {
	header: 'Options',
	optionList: []
}

optionDef.forEach(option => {
	optionDetail.optionList.push({
		name: option.name,
		alias: option.alias,
		description: option.description
	})
});

optionList.push(optionDetail);

if (options.help) {
	console.log(getUsage(optionList));
	return;
}

var configFileName = options.configfile;
var config;

var configDir = options.configdir;

// The default number of async queue workers is 10. This can be overridden using the -w parameter.
var numWorkers = (options.workers) ? options.workers : 10;

var countOnly = options.countonly;

var reportInterval = options.reportinterval;

var outputverbose = (options.verbose) ? options.verbose : false;

var verboserequests = (options.verboserequests) ? options.verboserequests : false;

var extraverboserequests = (options.extraverboserequests) ? options.extraverboserequests : false;

var socketTimeout = (options.sockettimeout) ? options.sockettimeout : 120;

var zoomStartOverride = options.zoomstartoverride;
var zoomStopOverride = options.zoomstopoverride;
var serverNameOverride = options.servernameoverride;
var serverPortOverride = options.serverportoverride;
var serverProtocolOverride = options.serverprotocoloverride;
var displayMemoryUsage = (options.displaymemoryusage) ? options.displaymemoryusage : false;

var layersOverride;

if (typeof options.layersoverride != 'undefined') {
	var l = options.layersoverride.replace('[', '["');
	l = l.replace(']', '"]');
	l = l.replace(/,/g, '","');
	console.log('Overriding layers using ' + l);
	layersOverride = JSON.parse(l);
}

// By default the http connections will use the Nodejs HTTP connection pool.
var useconnectionpooling = (options.connectionpooling) ? options.connectionpooling : false;

if (configDir) {
	fs.readdir(configDir, function directoryReadCallback(err, files) {
		for (var i = 0; i <= files.length; i++) {
			var fn = files[i];
			//console.log(fn);
			if (fn && fn.match(/.json/)) {
				//console.log("Matched: " + fn);
				processConfigFile(configDir + "//" + fn);
			}
		}
	})
}
else {
	if (configFileName) {
		processConfigFile(configFileName);
	}
}

if (extraverboserequests) {
	verboserequests = true
}

function processConfigFile(configFileName) {
	fs.readFile(configFileName, 'utf8', function configfileProcessingCallback(err, data) {
		if (err) {
			if (err.code === 'ENOENT') {
				console.log('File ' + err.path + ' not found!');
				return;
			} else {
				throw err;
			}
		}
		config = JSON.parse(data);

		// totalTiles represents the grand total of tiles to process for every cache area in the configuration file.
		var totalTiles = 0;
		// tilesToDo represents the total number of tiles to do for a particular cache area in the configuration file.
		var tilesToDo;
		var tilesDone;

		function makeRequest(task, callback) {
			//
			// This is the worker function that makes an HTTP/HTTPS request for a specific tile based on the 
			// supplied task parameters. It is called as an async queue worker i.e. it processes a number
			// of tasks placed on the queue.
			// The auth token is refreshed every task.refreshTokenInterval calls to avoid expiring during 
			// very long run times.
			//

			// If nocertificatecheck parameter is set to true then certificate is not checked during HTTPS requests 
			// (not safe solution, should be used mainly for development).
			if (task.noCertificateCheck) {
				process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
			}
			else {
				process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 1;
			}

			if (task.useAuth) {
				// If auth has to be used then get token first.
				var uaaUrl = task.authUrl + "?grant_type=client_credentials";
				refreshToken = ((task.tileNumber % task.refreshTokenInterval) == 0);

				if (verboserequests && refreshToken) {
					console.log("Refreshing token: " + uaaUrl);
				}

				uaaUtil.getToken(uaaUrl, task.clientId, task.clientSecret, refreshToken).then((tokenData) => {
					internalMakeRequest(task, callback, tokenData.access_token);
				}).catch((e) => {
					console.log("Error while getting token: " + e.message);
				});
			}
			else {
				// If auth has not to be used then don't get token (use empty token below).
				internalMakeRequest(task, callback, "");
			}
		}

		function internalMakeRequest(task, callback, token) {
			var options = {
				host: task.servername,
				path: task.layerTileUrl,
				port: task.serverport,
				method: 'GET',
				headers: { Authorization: 'Bearer ' + token }
			};

			if (!useconnectionpooling) {
				options.agent = false;
			}

			if (verboserequests) {
				console.log("Requesting: " + task.serverprotocol + "://" + task.servername + ":" + task.serverport + task.layerTileUrl);
			}

			// Determine protocol base on configuration. Default is http.
			var protocol;
			if (task.serverprotocol === 'https') {
				protocol = https;
			} else {
				protocol = http;
			}

			var req = protocol.request(options, function httpRequestCallback(response) {

				if ((response.statusCode != 200 && response.statusCode != 204) || verboserequests) {
					console.log("Request " + response.responseUrl + " returned status code " + response.statusCode);
				}

				if (extraverboserequests) {
					console.log("Response: " + util.inspect(response, { showHidden: false, depth: null, colors: true }));
				}

				var resp = '';
				response.on('data', function (chunk) {
					// Grab the response data i.e. the image but don't do anything with it.
				});

				var currentTime = (new Date).getTime();
				var elapsedTime = (currentTime - startTime) / 1000;

				tilesDone++;
				var rate = tilesDone / elapsedTime;
				var remainingTiles = totalTiles - tilesDone;
				var etc = (remainingTiles / rate) / (60 * 60);

				if (outputverbose) {
					if (tilesDone % reportInterval == 0) {
						console.log("Tiles done = " + tilesDone + ", rate = " + rate + " requests/second (" +
							remainingTiles + " left, elapsed time = " + elapsedTime + " seconds, ETC = " + etc + " hours)");
					}
				}

				callback();
			});

			req.setTimeout(socketTimeout * 1000, function socketTimeout() {
				console.log("Socket timeout occurred for: " + task.layerTileUrl);
				callback("Socket timeout");
			})

			req.on('error', function (e) {
				console.log("Error: " + e.message + " : request " + task.layerTileUrl);
				callback(e);
			});

			req.end();
		}

		var q = async.queue(makeRequest, numWorkers);

		if (displayMemoryUsage) {
			console.log("Memory used: " + util.inspect(process.memoryUsage()));
		}


		for (var i = 0; i < config.cacheareas.length; i++) {
			var cacheArea = config.cacheareas[i];

			if (outputverbose) {
				console.log(cacheArea);
			}

			// The requests are WMTS calls - here we set up the common preamble.
			var requestHeader = "/maps?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=" + cacheArea.stylename +
				"&FORMAT=" + cacheArea.format + "&TILEMATRIXSET=" + cacheArea.tilematrixset;

			tilesToDo = 0;
			tilesDone = 0;

			if (outputverbose) {
				console.log("Calculating number of tiles...");
			}

			// Count the number of tiles that will be requested.
			var zoomstart = (typeof zoomStartOverride != 'undefined') ? zoomStartOverride : cacheArea.startzoomlevel;
			var zoomstop = (typeof zoomStopOverride != 'undefined') ? zoomStopOverride : cacheArea.stopzoomlevel;

			if (outputverbose) {
				console.log("Calculating from zoom level " + zoomstart + " to " + zoomstop);
			}

			// The layer names may come from the configuration file or may be overridden at the command line.
			var layernames = (typeof layersOverride != 'undefined') ? layersOverride : cacheArea.layernames;

			for (var zoom = zoomstart; zoom <= zoomstop; zoom++) {
				var tiles = getTileNumbers(zoom, cacheArea.bounds);

				tilesToDo += (tiles[2] - tiles[0] + 1) * (tiles[3] - tiles[1] + 1) * layernames.length;

				if (displayMemoryUsage) {
					console.log("Starting Memory used: " + util.inspect(process.memoryUsage()));
				}
			}

			// The total number of tiles is the sum of all the tiles for each cache area.
			totalTiles += tilesToDo;

			if (outputverbose) {
				console.log("Number of tiles to request for this area = " + tilesToDo);
			}
		}

		console.log(configFileName + ", Grand tile total = " + totalTiles);

		if (!countOnly) {
			console.log("Started making tile requests...please wait.");
			for (var i = 0; i < config.cacheareas.length; i++) {
				var cacheArea = config.cacheareas[i];
				// Actually make the requests instead of just adding up the number of tiles to do.

				// Define the interval that progress is reported on. If not defined on the command line it will be every 1000 requests
				// or the size of the total requests, whichever is smaller.
				if (!reportInterval) reportInterval = Math.min(1000, totalTiles);

				var startTime = (new Date).getTime();

				var servername = (typeof serverNameOverride != 'undefined') ? serverNameOverride : cacheArea.servername;
				var serverport = (typeof serverPortOverride != 'undefined') ? serverPortOverride : cacheArea.serverport;
				var serverprotocol = (typeof serverProtocolOverride != 'undefined') ? serverProtocolOverride : cacheArea.serverprotocol;
				var nocertificatecheck = cacheArea.nocertificatecheck;

				//Tile number in processed config.
				var tileNumber = 0;

				// Actually request the tiles.
				for (var zoom = zoomstart; zoom <= zoomstop; zoom++) {
					// Add the rest of the WMTS parameters based on zoom level and row/col numbers.
					var url = requestHeader + "&TILEMATRIX=" + zoom;

					var tiles = getTileNumbers(zoom, cacheArea.bounds);
					/* if (outputverbose) {
					 console.log("Processing zoom level " + zoom + ", xmin = " + tiles[0] + " xmax = " + tiles[2] + ", ymin = " + tiles[1] + " ymax = " + tiles[3]);
					} */

					var memCount = 0;
					var memDiv;
					var totalTiles = (tiles[2] - tiles[0]) * (tiles[3] - tiles[1]);

					if (totalTiles > 100000) {
						memDiv = 100000;
					}
					else {
						memDiv = Math.round(totalTiles / 10);
					}

					for (var x = tiles[0]; x <= tiles[2]; x++) {
						for (var y = tiles[1]; y <= tiles[3]; y++) {
							var tileUrl = url + "&TILECOL=" + x + "&TILEROW=" + y;

							for (var index = 0; index < layernames.length; index++) {
								var layerTileUrl = encodeURI(tileUrl + "&LAYER=" + layernames[index]);
								// Push a new tasks onto the async queue for the worker(s) to process.
								q.push({
									serverprotocol: (serverprotocol != null) ? serverprotocol : "http",
									servername: servername,
									serverport: serverport,
									layerTileUrl: layerTileUrl,
									noCertificateCheck: nocertificatecheck,
									useAuth: cacheArea.useauth,
									authUrl: cacheArea.authurl,
									clientId: cacheArea.clientid,
									clientSecret: cacheArea.clientsecret,
									refreshTokenInterval: cacheArea.refreshtokeninterval,
									tileNumber: tileNumber
								});

								memCount++;
								tileNumber++;

								if (displayMemoryUsage) {
									if (memCount % memDiv == 0) {
										console.log("Memory used: " + util.inspect(process.memoryUsage()));
									}
								}
							}
						}
					}
				}
			}
		}
	})
}

Math.radians = function (degrees) {
	return degrees * Math.PI / 180;
}

function sec(x) {
	return 1 / Math.cos(x);
}

function getTileNumbers(zoom, bounds) {
	// 
	// Returns the tiles that cover the supplied bounds at the supplied zoom level.
	//

	var n = Math.pow(2, zoom);
	var minXTile = Math.floor(n * ((bounds.minx + 180) / 360));

	if (bounds.maxx == 180 && bounds.minx == -180) {
		// 180 degrees is the same as -180 degrees, so don't double count.
		maxXTile = Math.floor(n * ((bounds.maxx + 180) / 360)) - 1;
	}
	else {
		maxXTile = Math.floor(n * ((bounds.maxx + 180) / 360));
	}
	var minLatRad = Math.radians(bounds.miny);
	var maxLatRad = Math.radians(bounds.maxy);
	// The tile matrix's origin is at top left-hand corner, hence the use of the min lat for the max y tile etc.
	var minYTile = Math.floor(n * (1.0 - (Math.log(Math.tan(maxLatRad) + sec(maxLatRad)) / Math.PI)) / 2.0);
	var maxYTile = Math.floor(n * (1.0 - (Math.log(Math.tan(minLatRad) + sec(minLatRad)) / Math.PI)) / 2.0);

	//console.log("zoom = " + zoom + ", x = " + minXTile + ", y = " + minYTile + ", xmax = " + maxXTile + ", maxy = " + maxYTile);

	return [minXTile, minYTile, maxXTile, maxYTile];
}
