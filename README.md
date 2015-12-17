# tilecacher

A nodejs client that generates requests for map tiles from Network Viewer based server infrastructures. These requests will cause the maptiles to be cached in the Network Viewer tile cache, so this can be used as an alternate mechanism for pre-populating the cache (the other mechanism being the automated pre-population techniques described in the NV documentation).

## To install and run:
* Install Nodejs
* Install dependencies:
  * npm install async
  * npm install command-line-args
  
Place a copy of tilecacher.js and a config.json file in a directory and then run the cacher:

`
node tilecacher.js -c config.json
`

## Configuration

The client uses a file containing a JSON description of what area requests should be made for. The format of the file is something like this:

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
* servername - The machine name of the server that responds to the requests
* serverport - The TCP port that the server is listening one
* layernames - An array of strings representing the names of the layers that requests should be made for
* stylename - The name of the styles to be used
* format - The MIME type of the raster image that should be returned
* tilematrixset - The name of the coordinate system used in the request
* startzoomlevel - The topmost zoom level to use
* stopzoomlevel - The lowermost zoom level to use
* bounds - An object containing the bottom left and top right coordinates of the area (in lat/lons aka EPSG4326)

Note that some of the parameters correspond to WMTS request parameters, in particular servername, serverport, layernames, stylename, format and tilematrixset. The zoom level parameters are used along with the bounds to calculate the tile row and columns numbers for each zoom level. These numbers are then used in the WMTS request.

## Command Line Options

`
Options

  -c, --configfile string   The name of a JSON file containing the caching definitions
  -h, --help                Display usage
  -w, --workers             Number of workers (default 10)
  -o, --countonly           Whether to only count tiles or not -true or false (default false)
  -r, --reportinterval      The reporting interval for progress (integer)
 `
