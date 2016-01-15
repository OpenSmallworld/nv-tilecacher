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
	{ name: 'help', alias: 'h', description: 'Display usage' },
	{ name: 'workers', alias: 'w', type: Number, defaultOption: 10, description: 'Number of workers (default 10)'},
	{ name: 'countonly', alias: 'o', type: Boolean, defaultOption: false, description: 'Whether to only count tiles or not - true or false (default false)'},
	{ name: 'reportinterval', alias: 'r', type: Number, description: 'The reporting interval for progress (integer)'},
	{ name: 'connectionpooling', alias: 'p', type: Boolean, description: 'Use connection pooling'},
	{ name: 'verbose', alias: 'v', type: Boolean, description: 'Output information verbosely'},
	{ name: 'sockettimeout', alias: 's', type: Number, defaultOption: 120, description: 'The timeout period for the socket connection in seconds (default 120)'}
])

var options = cli.parse();

if (options.help || !options.configfile) {
	console.log(cli.getUsage(options, usageOptions));
	return;
}

var configFileName = options.configfile;
var config;

// The default number of async queue workers is 10. This can be overridden using the -w parameter.
var numWorkers = (options.workers) ? options.workers : 10;

var countOnly = options.countonly;

var reportInterval = options.reportinterval;

var outputverbose = (options.verbose) ? options.verbose : false;

var socketTimeout = (options.sockettimeout) ? options.sockettimeout : 120;

// By default the http connections will use the Nodejs HTTP connection pool.
var useconnectionpooling = (options.connectionpooling) ? options.connectionpooling : false; 

fs.readFile(configFileName, 'utf8', function(err, data) {
	if (err) throw err;
	config = JSON.parse(data);
	
	function makeRequest(task, callback) {
		//
		// This is a callback function that makes an HTTP request for a specific tile based on the 
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
		
		if (outputverbose) {
			console.log("Requesting: http://" + task.servername + ":" + task.serverport + task.layerTileUrl);
		}
		
		var req = http.request(options, function(response) {
			var currentTime = (new Date).getTime();
			var elapsedTime = (currentTime - startTime) / 1000;
			
			tilesDone++;
			var rate = tilesDone / elapsedTime;
			var remainingTiles = tilesToDo - tilesDone;
			var etc = (remainingTiles / rate) / (60 * 60);
			
			if (tilesDone % reportInterval == 0) {
				console.log("Tiles done = " + tilesDone + ", rate = " + rate + " requests/second (" + 
					remainingTiles + " left, elapsed time = " + elapsedTime + " seconds, ETC = " + etc + " hours)");
			}
			
			callback();
		});
		
		req.setTimeout(socketTimeout * 1000, function socketTimeout() {
			console.log("Socket timeout occurred for: " + task.layerTileUrl);
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
		
		console.log(cacheArea);
		
		// The requests are WMTS calls - here we set up the common preamble.
		var requestHeader = "/maps?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=" + cacheArea.stylename + 
			"&FORMAT=" + cacheArea.format + "&TILEMATRIXSET=" + cacheArea.tilematrixset;
		
		var tilesToDo = 0;
		var tilesDone = 0;
		
		console.log("Calculating number of tiles...");
		
		// Count the number of tiles that will be requested.
		for (var zoom = cacheArea.startzoomlevel; zoom <= cacheArea.stopzoomlevel; zoom++) {
			var tiles = getTileNumbers(zoom, cacheArea.bounds);
			
			tilesToDo += (tiles[2] - tiles[0]) * (tiles[3] - tiles[1]) * cacheArea.layernames.length;
		}
		
		console.log("Number of tiles to request = " + tilesToDo);
		
		if (!countOnly) {
			console.log("Starting requests...");
			
			// Define the interval that progress is reported on. If not defined on the command line it will be every 1000 requests
			// or the size of the total requests, whichever is smaller.
			if (!reportInterval) reportInterval = Math.min(1000, tilesToDo);
			
			var startTime = (new Date).getTime();
			
			// Actually request the tiles.
			for (var zoom = cacheArea.startzoomlevel; zoom <= cacheArea.stopzoomlevel; zoom++) {
				// Add the rest of the WMTS parameters based on zoom level and row/col numbers.
				var url = requestHeader + "&TILEMATRIX=" + zoom;

				var tiles = getTileNumbers(zoom, cacheArea.bounds);
				if (outputverbose) {
				 console.log("Processing zoom level " + zoom + ", xmin = " + tiles[0] + " xmax = " + tiles[2] + ", ymin = " + tiles[1] + " ymax = " + tiles[3]);
				}
				for (var x = tiles[0]; x <= tiles[2]; x++) {
					for (var y = tiles[1]; y <= tiles[3]; y++) {
						var tileUrl = url + "&TILECOL=" + x + "&TILEROW=" + y;
						
						for (var index = 0; index < cacheArea.layernames.length; index++) {
							var layerTileUrl = encodeURI(tileUrl + "&LAYER=" + cacheArea.layernames[index]);
							// Push a new tasks onto the async queue for the worker(s) to process.
							q.push({ 
								servername: cacheArea.servername,
								serverport: cacheArea.serverport,
								layerTileUrl: layerTileUrl
							}, function asyncCallback(err) {
								// Callback function used when task has completed. We have nothing to do here, so do nothing.
							});
						}
					}
				}
			}
		}
	}
})

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
