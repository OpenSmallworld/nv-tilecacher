# tilecacher

A nodejs client that generates requests for map tiles from Network Viewer based server infrastructures.

To install:
* Install Nodejs
* Install dependencies:
** npm install async
** npm install command-line-args

Running:

At the command line type:

node tilecacher.js -c <configuration file>

Configuration

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