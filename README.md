# tilecacher

A nodejs client that generates WMTS requests for map tiles from Network Viewer based server infrastructures, as a browser-based Network Viewer client would when a user is panning and zooming around the map. These requests will cause the maptiles to be cached in the Network Viewer tile cache, so this can be used as an alternate mechanism for pre-populating the cache (the other mechanism being the automated pre-population techniques described in the NV documentation).

## To install and run:
* Install [Nodejs](https://nodejs.org/en/)
* Install dependencies:
  * npm install async
  * npm install command-line-args
  
Place a copy of tilecacher.js and a config.json file in a directory and then run the cacher:

`
node tilecacher.js -c config.json
`

## Configuration

The client uses a file containing a JSON description of each area you wish to make requests for (and therefore cache). The name of the file is referred to using the '-c' command line argument. The format of the file is like this:

```json
{
	"cacheareas": [
		{
			"description": "City of Exeter, UK",
			"servername": "cbgswws05.nms.dev.ps.ge.com",
			"serverport": 3200,
			"layernames": ["Support", "Network"],
			"stylename": "",
			"format": "image/png",
			"tilematrixset": "EPSG-900913",
			"startzoomlevel": 0,
			"stopzoomlevel": 20,
			"bounds": {
				"minx": -3.567553,
				"miny": 50.702354,
				"maxx": -3.494596,
				"maxy": 50.735503
			}
		}
	]
}
```

The configuration file can contain multiple areas to request tiles for by adding JSON objects to the cacheareas array. In the example above there is only one area defined, but more could be created by copying and pasting that example many times and changing the parameters appropriately, something like this:

```json
{
	"cacheareas": [
		{
			"description": "Chicago, Illinois, USA",
			"servername": "cbgswws05.nms.dev.ps.ge.com",
			"serverport": 3200,
			"layernames": ["Support"],
			"stylename": "",
			"format": "image/png",
			"tilematrixset": "EPSG-900913",
			"startzoomlevel": 0,
			"stopzoomlevel": 21,
			"bounds": {
				"minx": -88.416595,
				"miny": 41.435761,
				"maxx": -87.424393,
				"maxy": 42.206619
			}
		},
		{
			"description": "Denver, Colorado, USA",
			"servername": "cbgswws05.nms.dev.ps.ge.com",
			"serverport": 3200,
			"layernames": ["Support"],
			"stylename": "",
			"format": "image/png",
			"tilematrixset": "EPSG-900913",
			"startzoomlevel": 0,
			"stopzoomlevel": 21,
			"bounds": {
				"minx": -105.239410,
				"miny": 39.525726,
				"maxx": -104.654388,
				"maxy": 39.952352
			}
		}
	]
}
```

The parameters in the file are as follows:
* description - A string containing a description of the area
* servername - The machine name of the server that responds to the requests. This should be the same machinename that is being used for the Network Viewer URL.
* serverport - The TCP port that the server is listening on. This should be the same port that the Network Viewer app is using.
* layernames - An array of strings representing the names of the layers that requests should be made for. If there is more than one layer, then a request for each layer will be made for each tile
* stylename - The name of the styles to be used
* format - The MIME type of the raster image that should be returned
* tilematrixset - The name of the coordinate system used in the request
* startzoomlevel - The topmost zoom level to use e.g. 0
* stopzoomlevel - The lowermost zoom level to use e.g. 20
* bounds - An object containing the bottom left and top right coordinates of the area (in EPSG:4326 decimal degree coordinates aka "lat/lons")

Note that some of the parameters correspond to WMTS request parameters, in particular servername, serverport, layernames, stylename, format and tilematrixset. The zoom level parameters are used along with the bounds to calculate the tile row and columns numbers for each zoom level. These numbers are then used in the WMTS request.

In Network Viewer WMTS requests are handled in the first instance by a nodejs server. That server will be using a machinename and a port number that will also be used for the application running in the browser. It is this machinename and port number you should use in the configuration files. It will allow the tilecacher to construct WMTS requests that match what a Network Viewer client would construct when fetching raster tiles in a view (and cached if needed).

## Command Line Options

```
Options

  -c, --configfile string       The name of a JSON file containing the caching definitions
  -h, --help                    Display usage
  -w, --workers number          Number of workers (default 10)
  -o, --countonly               Whether to only count tiles or not -true or false (default false)
  -r, --reportinterval number   The reporting interval for progress (integer)
  -p, --connectionpooling       Use connection pooling
  -v, --verbose                 Output information verbosely
 ```
 
### Notes on command line options
 
The number of workers affects the number of requests that will be generated - in general more workers, the higher the rate of requests. However beware setting this too high as you may swamp the server's capability to provide a socket for the request to connect to. If you are seeing connection errors after a while or "socket hang up" errors (indicating that the request load has possibly caused the server to crash), try restarting with a lower worker number.

Connection pooling is where the HTTP requests use a pool of sockets rather than creating their own socket from scratch every time. This has been know to cause problems (specifically ENOBUF errors) in situations where the tilecacher is generating requests so quickly that the socket connection pool is full. The connection pooling behaviour can be switched off and this is the default i.e. every HTTP request will generate a new socket. However the connection pooloing behaviour can be turned on using the -p option.

## Output

The tilecacher will report its progress in a form similar to that below...

```
{ description: 'City of Exeter, UK',
  servername: 'cbgswws05.nms.dev.ps.ge.com',
  serverport: 3200,
  layernames: [ 'Support', 'Network' ],
  stylename: '',
  format: 'image/png',
  tilematrixset: 'EPSG-900913',
  startzoomlevel: 0,
  stopzoomlevel: 20,
  bounds:
   { minx: -3.567553,
     miny: 50.702354,
     maxx: -3.494596,
     maxy: 50.735503 } }
Calculating number of tiles...
Number of tiles to request = 86178
Starting requests...
Tiles done = 1000, rate = 117.53643629525153 requests/second (85178 left, elapsed time = 8.508 seconds, ETC = 0.20130400666666665 hours)
Tiles done = 2000, rate = 144.57134595923088 requests/second (84178 left, elapsed time = 13.834 seconds, ETC = 0.16173867388888888 hours)
Tiles done = 3000, rate = 153.75153751537516 requests/second (83178 left, elapsed time = 19.512 seconds, ETC = 0.15027491999999998 hours)
Tiles done = 4000, rate = 143.98329793743926 requests/second (82178 left, elapsed time = 27.781 seconds, ETC = 0.15854076513888887 hours)
Tiles done = 5000, rate = 146.2287602725704 requests/second (81178 left, elapsed time = 34.193 seconds, ETC = 0.15420663077777777 hours)
```

## Usage

It is often useful to run the tilecacher in "countonly" mode using the -o command line option first. This will calculate the number of tiles without actually generating the requests, which is useful to gauge the likely time to complete based on a known request run rate. Depending on the time estimation you make, you may decide to adjust the bounds in the configuration file. In this way you can fine-tune the area boundaries if you would like to have some cache pre-populated but are constrained to do that within a certain time window.

Depending on the server you are making calls to you may see errors. One type of error manifests itselfs as follows:

```
Error: socket hang up
```

This indicates that the WMTS request that the tilecacher made was unexpectedly closed before the response to that request was made. It indicates a problem on the serverside i.e. an issue with the node reverse proxy, the JBoss instance (including the EIS servers) or possible the machine those processes are running on.

