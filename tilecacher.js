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
	{ name: 'workers', alias: 'w', description: 'Number of workers (default 10)'},
	{ name: 'countonly', alias: 'o', description: 'Whether to only count tiles or not - true or false (default false)'}
])

var options = cli.parse();

if (options.help || !options.configfile) {
	console.log(cli.getUsage(options, usageOptions));
	return;
}

var configFileName = options.configfile;
var config;

// The default number of workers is 10. This can be overridden using the -w parameter.
var numWorkers = (options.workers) ? options.workers : 10;

var countOnly = (options.countonly == "true") ? true : false;

fs.readFile(configFileName, 'utf8', function(err, data) {
	if (err) throw err;
	config = JSON.parse(data);
	
	for (var i = 0; i < config.cacheareas.length; i++) {
		var cacheArea = config.cacheareas[i];
		
		console.log(cacheArea);
		
		var requestHeader = "/maps?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=" + cacheArea.stylename + 
			"&FORMAT=" + cacheArea.format + "&TILEMATRIXSET=" + cacheArea.tilematrixset;
		
		var tilesToDo = 0;
		var tilesDone = 0;
		
		// Count the number of tiles that will be requested.
		for (var zoom = cacheArea.startzoomlevel; zoom <= cacheArea.stopzoomlevel; zoom++) {
			var tiles = getTileNumbers(zoom, cacheArea.bounds);
			
			for (var x = tiles[0]; x <= tiles[2]; x++) {
				for (var y = tiles[1]; y <= tiles[3]; y++) {				
					for (var index = 0; index < cacheArea.layernames.length; index++) {
						tilesToDo++;
					}
				}
			}
		}
		
		console.log("Number of tiles to request = " + tilesToDo);
		
		if (countOnly) return;
		
		// Define the interval that progress is reported on. Typically will be 1000 calls, but if the 
		// total is less than 1000, it will be the size of the total requests.
		var countInterval = Math.min(1000, tilesToDo);
		
		var startTime = (new Date).getTime();
		
		function makeRequest(task, callback) {
			var req = http.request({
				host: task.servername,
				path: task.layerTileUrl,
				port: task.serverport,
				method: 'GET'
			}, function(response) {
				var currentTime = (new Date).getTime();
				var elapsedTime = (currentTime - startTime) / 1000;
				
				tilesDone++;
				var rate = tilesDone / elapsedTime;
				var remainingTiles = tilesToDo - tilesDone;
				var etc = (remainingTiles / rate) / (60 * 60);
				
				if (tilesDone % countInterval == 0) {
					console.log("Tiles done = " + tilesDone + ", rate = " + rate + " requests/second (" + 
						remainingTiles + " left, elapsed time = " + elapsedTime + " seconds, ETC = " + etc + " hours)");
				}
				callback();
			});
			req.on('error', function(e) {
				console.log("Error: " + e.message);
				callback(e);
			});
			req.end();
		}
		
		var q = async.queue(makeRequest, numWorkers);
		
		// Actually request the tiles.
		for (var zoom = cacheArea.startzoomlevel; zoom <= cacheArea.stopzoomlevel; zoom++) {
			var url = requestHeader + "&TILEMATRIX=" + zoom;

			var tiles = getTileNumbers(zoom, cacheArea.bounds);
			//console.log("Processing zoom level " + zoom + ", xmin = " + tiles[0] + " xmax = " + tiles[2] + ", ymin = " + tiles[1] + " ymax = " + tiles[3]);
			for (var x = tiles[0]; x <= tiles[2]; x++) {
				for (var y = tiles[1]; y <= tiles[3]; y++) {
					var tileUrl = url + "&TILECOL=" + x + "&TILEROW=" + y;
					
					for (var index = 0; index < cacheArea.layernames.length; index++) {
						var layerTileUrl = encodeURI(tileUrl + "&LAYER=" + cacheArea.layernames[index]);
						q.push({ 
							servername: cacheArea.servername,
							serverport: cacheArea.serverport,
							layerTileUrl: layerTileUrl
						}, function(err) {
						});
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
	var maxXTile = Math.floor(n * ((bounds.maxx + 180) / 360));
	var minLatRad = Math.radians(bounds.miny);
	var maxLatRad = Math.radians(bounds.maxy);
	var minYTile = Math.floor(n * (1.0 - (Math.log(Math.tan(minLatRad) + sec(minLatRad)) / Math.PI)) / 2.0);
	var maxYTile = Math.floor(n * (1.0 - (Math.log(Math.tan(maxLatRad) + sec(maxLatRad)) / Math.PI)) / 2.0);
	
	//console.log("zoom = " + zoom + ", x = " + minXTile + ", y = " + minYTile + ", xmax = " + maxXTile + ", maxy = " + maxYTile);
	
	return [minXTile, minYTile, maxXTile, maxYTile];
}
