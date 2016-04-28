var http = require('http');
var fs = require('fs');
var async = require('async');
var commandLineArgs = require('command-line-args');

// Ramp up the number of sockets so that we can make as many web calls as possible.
http.globalAgent.maxSockets = 500000;

const usageOptions = {
	title: 'tilecacher',
	description: 'Makes WMTS requests to a server over a set of bounding boxes'
}
var cli = commandLineArgs([
	{ name: 'configfile', alias: 'c', type: String, description: 'The name of a JSON file containing the caching definitions' },
	{ name: 'configdir', alias: 'd', type: String, description: 'A directory that contains a set of JSON config files. Use instead of -c for multiple configs' },
	{ name: 'help', alias: 'h', description: 'Display usage' },
	{ name: 'workers', alias: 'w', type: Number, defaultOption: 10, description: 'Number of simultaneous requests made at a time (default 10)'},
	{ name: 'countonly', alias: 'o', type: Boolean, defaultOption: false, description: 'Whether to only count tiles or not - true or false (default false)'},
	{ name: 'reportinterval', alias: 'r', type: Number, description: 'The number of requests that progress is reported on e.g. every 100 requests, 1000 requests etc. Requires verboserequests to be true.'},
	{ name: 'connectionpooling', alias: 'p', type: Boolean, description: 'Use connection pooling'},
	{ name: 'verbose', alias: 'v', type: Boolean, description: 'Output information verbosely'},
	{ name: 'verboserequests', alias: 'b', type: Boolean, description: 'Output request information verbosely'},
	{ name: 'sockettimeout', alias: 's', type: Number, defaultOption: 120, description: 'The timeout period for the socket connection in seconds (default 120)'},
	{ name: 'zoomstartoverride', alias: 'i', type: Number, description: 'Override the zoom start value'},
	{ name: 'zoomstopoverride', alias: 'j', type: Number, description: 'Override the zoom stop value'},
	{ name: 'servernameoverride', alias: 'k', type: String, description: 'Override the name of the server'},
	{ name: 'serverportoverride', alias: 'l', type: Number, description: 'Override the server port'},
	{ name: 'layersoverride', alias: 'm', type: String, description: 'Override the layers'}
])

var options = cli.parse();

if (options.help) {
	console.log(cli.getUsage(options, usageOptions));
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

var socketTimeout = (options.sockettimeout) ? options.sockettimeout : 120;

var zoomStartOverride = options.zoomstartoverride;
var zoomStopOverride = options.zoomstopoverride;
var serverNameOverride = options.servernameoverride;
var serverPortOverride = options.serverportoverride;

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
				processConfigFile(configDir + "\\" + fn);
			}
		}
	})
}
else {
	if (configFileName) {
		processConfigFile(configFileName);
	}
}

function processConfigFile(configFileName) {
	fs.readFile(configFileName, 'utf8', function configfileProcessingCallback(err, data) {
		if (err) throw err;
		config = JSON.parse(data);
		
		// totalTiles represents the grand total of tiles to process for every cache area in the configuration file.
		var totalTiles = 0;
		// tilesToDo represents the total number of tiles to do for a particular cache area in the configuration file.
		var tilesToDo;
		var tilesDone;
		
		function makeRequest(task, callback) {
			//
			// This is the worker function that makes an HTTP request for a specific tile based on the 
			// supplied task parameters. It is called as an async queue worker i.e. it processes a number
			// of tasks placed on the queue.
			//
			var options = {
					host: task.servername,
					path: task.layerTileUrl,
					port: task.serverport,
					method: 'GET'
			};
			
			if (!useconnectionpooling) {
				options.agent = false;
			}
			
			if (verboserequests) {
				console.log("Requesting: http://" + task.servername + ":" + task.serverport + task.layerTileUrl);
			}
			
			var req = http.request(options, function httpRequestCallback(response) {
				response.on('data', function(chunk){
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
			
			req.on('error', function(e) {
				console.log("Error: " + e.message + " : request " + task.layerTileUrl);
				callback(e);
			});
			
			req.end();
		}
		
		var q = async.queue(makeRequest, numWorkers);
		
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
				
				// Actually request the tiles.
				for (var zoom = zoomstart; zoom <= zoomstop; zoom++) {
					// Add the rest of the WMTS parameters based on zoom level and row/col numbers.
					var url = requestHeader + "&TILEMATRIX=" + zoom;

					var tiles = getTileNumbers(zoom, cacheArea.bounds);
					/* if (outputverbose) {
					 console.log("Processing zoom level " + zoom + ", xmin = " + tiles[0] + " xmax = " + tiles[2] + ", ymin = " + tiles[1] + " ymax = " + tiles[3]);
					} */

					for (var x = tiles[0]; x <= tiles[2]; x++) {
						for (var y = tiles[1]; y <= tiles[3]; y++) {
							var tileUrl = url + "&TILECOL=" + x + "&TILEROW=" + y;
							
							for (var index = 0; index < layernames.length; index++) {
								var layerTileUrl = encodeURI(tileUrl + "&layer=" + layernames[index]);
								// Push a new tasks onto the async queue for the worker(s) to process.
								q.push({ 
									servername: servername,
									serverport: serverport,
									layerTileUrl: layerTileUrl
								});
							}
						}
					}
				}
			}
		}
	})
}

Math.radians = function(degrees) {
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
