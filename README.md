# tilecacher

A nodejs client that generates requests for map tiles from Network Viewer based server infrastructures.

## To install:
* Install Nodejs
* Install dependencies:
  * npm install async
  * npm install command-line-args
  
Place a copy of tilecacher.js and a config.json file in a directory and then run the cacher:
`
node tilecacher.js -c config.json
`

## Running:

At the command line type:

node tilecacher.js -c <configuration file>

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
			"stopzoomlevel": 21,
			"bounds": {
				"minx": -3.567553,
				"miny": 50.735503,
				"maxx": -3.494596,
				"maxy": 50.702354
			}
		}
	]
}
```

The configuration file can contain multiple areas to request tiles for by adding JSON objects to the cacheareas array. In the example above there is only one area defined, but more could be created by copying and pasting that example many times and changing the parameters appropriately.

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