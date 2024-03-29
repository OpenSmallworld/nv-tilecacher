# tilecacher

A nodejs client that generates WMTS requests for map tiles from Network Viewer based server infrastructures, in exactly the same way as a browser-based Network Viewer client would when a user is panning and zooming around the map. These requests will cause the maptiles to be created and cached in the Network Viewer tile cache if they do not exist in the cache already, so this can be used as an alternate mechanism for pre-populating the cache (the other mechanism being the automated pre-population techniques described in the NV documentation).

## Installation

* Install [Nodejs](https://nodejs.org/en/)
* Install dependencies:
  * npm install
  
The dependencies can be added explicitly if you choose...

* npm install [async](https://github.com/caolan/async)
* npm install [command-line-args](https://www.npmjs.com/package/command-line-args)
* npm install [command-line-usage](https://www.npmjs.com/package/command-line-usage)
* npm install [follow-redirects](https://www.npmjs.com/package/follow-redirects)
* npm install [predix-uaa-client](https://www.npmjs.com/package/predix-uaa-client)

Copy an example config as `config.json` and then run directly as shown below:

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
         "serverprotocol": "https",
         "servername": "cbgdo693.nms.dev.ps.ge.com",
         "serverport": 30443,
         "nocertificatecheck": true,
         "useauth": true,
         "authurl": "https://cbgdo693.nms.dev.ps.ge.com:30443/uaa/oauth/token",
         "clientid": "client_user",
         "clientsecret": "client_user",
         "refreshtokeninterval": 1000,
         "layernames": ["Cadastral"],
         "stylename": "",
         "format": "image/png",
         "tilematrixset": "EPSG-900913",
         "startzoomlevel": 8,
         "stopzoomlevel": 14,
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

The configuration file can contain multiple areas to request tiles for by adding JSON objects to the cacheareas array. In the example above there is only one area defined, but more could be created by copying and pasting that example many times and changing the parameters appropriately, such as:

```json
{
   "cacheareas": [
      {
         "description": "Chicago, Illinois, USA",
         "servername": "cbgswws05.nms.dev.ps.ge.com",
         "serverport": 30443,
         "nocertificatecheck": true,
         "useauth": true,
         "authurl": "https://cbgdo693.nms.dev.ps.ge.com:30443/uaa/oauth/token",
         "clientid": "client_user",
         "clientsecret": "client_user",
         "refreshtokeninterval": 1000,
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
         "serverport": 30443,
         "nocertificatecheck": true,
         "useauth": true,
         "authurl": "https://cbgdo693.nms.dev.ps.ge.com:30443/uaa/oauth/token",
         "clientid": "client_user",
         "clientsecret": "client_user",
         "refreshtokeninterval": 1000,
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

Alternately, create a directory with several config files and use the `-d` command line switch.

The parameters in the file are as follows:

* **description** - A string containing a description of the area
* **serverprotocol** - The protocol to be used for server connection ("http" or "https"). This parameter is optional and defaults to "http".
* **servername** - The machine name of the server that responds to the requests. This should be the same machinename that is being used for the Network Viewer URL.
* **serverport** - The TCP port that the server is listening on. This should be the same port that the Network Viewer app is using.
* **nocertificatecheck** - If set to true then certificate will not be validated when using https connection.
* **useauth** - If set to true then auth token will be retrieved before calling WMTS service.
* **authurl** - The URL to be used for retrieving auth token.
* **clientid** - The user ID to be used for retrieving auth token.
* **clientsecret** - The user secret to be used for retrieving auth token.
* **refreshtokeninterval** - The interval between token refreshes (eg. when set to 1000 then token will be refreshed at every 1000 WMTS service call).
* **layernames** - An array of strings representing the names of the layers that requests should be made for. If there is more than one layer, then multiple requests will be made for each tile on that layer.
* **stylename** - The name of the styles to be used.
* **format** - The MIME type of the raster image that should be returned.
* **tilematrixset** - The name of the coordinate system used in the request.
* **startzoomlevel** - The topmost zoom level to use, for example 0.
* **stopzoomlevel** - The lowermost zoom level to use, for example 20.
* **bounds** - An object containing the bottom left and top right coordinates of the area (in EPSG:4326 decimal degree coordinates aka "lat/lon").
* **verbose** - Output verbose information.
* **verboserequests** - Output verbose request information.
* **extraverboserequests** - Output extreemly verbose request/response information.

Note that some of the parameters correspond to WMTS request parameters, in particular serverprotocol, servername, serverport, layernames, stylename, format and tilematrixset.
The zoom level parameters are used along with the bounds to calculate the tile row and columns numbers for each zoom level. These numbers are then used in the WMTS request.

In Network Viewer WMTS requests are handled in the first instance by a nodejs server. Thaia server will typically be the hostname and port number which is configured for GSS. It is this hostname and port number you should use in the configuration files. This will allow the tilecacher to construct WMTS requests which match those for a Network Viewer client and cached if needed.

## Command Line Options

```text
Options

  -c, --configfile string             The name of a JSON file containing the caching definitions
  -d, --configdir string              A directory that contains a set of JSON config files. Use instead of -c for
                                      multiple configs
  -h, --help                          Display usage
  -w, --workers number                Number of simultaneous requests made at a time (default 10)
  -o, --countonly                     Whether to only count tiles or not -true or false (default false)
  -r, --reportinterval number         The number of requests that progress is reported on e.g. every 100 requests,
                                      1000 requests etc. Requires verboserequests to be true.
  -p, --connectionpooling             Use connection pooling
  -v, --verbose                       Output information verbosely
  -b, --verboserequests               Output request information verbosely
  -x, --extraverboserequests               Output request information verbosely
  -s, --sockettimeout number          The timeout period for the socket connection in seconds (default 120)
  -i, --zoomstartoverride number      Override the zoom start value
  -j, --zoomstopoverride number       Override the zoom stop value
  -k, --servernameoverride string     Override the name of the server
  -l, --serverportoverride number     Override the server port
  -m, --layersoverride string         Override the layers
  -n, --serverprotocoloverride string Override the server protocol
 ```

### Notes on command line options

The number of "workers" affects the number of requests that will be generated simultaneously - in general the higher the value for this parameter, the higher the rate of requests. However beware of setting this too high as you may swamp the server's capability to respond to the request in a timeframe that is less than the timeout for the socket connection. If you are seeing "socket hang up" errors, this indicates that the request load has probably caused the server to become overloaded or has crashed. Try restarting with a lower worker number to throttle the request rate, or increase the server's capacity to respond in a timely manner. See below for more on socket hangups.

Connection pooling is where the HTTP requests use a pool of sockets rather than creating their own socket from scratch every time. This has been know to cause problems (specifically ENOBUF errors) in situations where the tilecacher is generating requests so quickly that the socket connection pool is full. The connection pooling behaviour can be switched off and this is the default i.e. every HTTP request will generate a new socket. However the connection pooloing behaviour can be turned on using the -p option.

Note that it is possible to override some of the settings in the configuration file by using the -i, -j, -k, -l and -m parameters. This is useful when you have a configuration file with the right bounding areas but incorrect servername, port, zoom levels or layer names.

## Output

The tilecacher will report its progress in a form similar to that below...

```json
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

## Notes on Usage

It is often useful to run the tilecacher in "countonly" mode using the -o command line option first. This will calculate the number of tiles without actually generating the requests, which is useful to gauge the likely time to complete based on a known request run rate. Depending on the time estimation you make, you may decide to adjust the bounds in the configuration file. In this way you can fine-tune the area boundaries if you would like to have some cache pre-populated but are constrained to do that within a certain time window.

### Socket Hangups due to poor server response times

Depending on the server you are making calls to you may see errors. One type of error manifests itselfs as follows:

```text
Error: socket hang up
```

This indicates that the WMTS request made was unexpectedly closed before the response to that request was made. It indicates a problem on the server side, most likely that the server is unable to respond quickly enough and the socket was closed after a timeout. There are a number of possible reasons for this for example an issue with the node reverse proxy, the Magik Service Providers, or possibly the hosts those processes are running on are too busy. Essentially, your setup is running too slow to service the number of requests you're making.

### Typical Tile Rates

Tile rates will heavily depend on deployment hardware. For an uncached area you might expect at least 10 tiles per second to be reported from the tilecacher for a single GSS Magik Service Providers. Typically it would be more than this i.e. perhaps over 20 but less than 30 tiles per second. The exact number will vary depending on your database optimisation, visibilities etc. If you see a rate which is less than 10 tiles per second, then something is wrong and you should look at the configuration of your Smallworld installation to ascertain the cause. Possible reasons can include rendering too much data on the map at selected view scales, poor database spatial indexing, slow network between the database server and the web infrastructure etc.

Note that if you see a very high rate e.g. many hundreds of tiles per second then it is likely that you are making requests on an area that is already cached, especially if you only have one GSS EIS server. In this scenario the rate is high because the tiles are pre-rendered, so the request is simply to retrieve the existing tile.

Increasing the number of GSS Magik Service Providers should increase the overall throughput of the system which in turn will translate into an increased tile rate. Note that the time to create an individual tile will not decrease by adding more servers, however the number of requests for tiles that the system can respond to simultaneously will. In other words adding more EIS servers will increase the scalability of the system.

### Possible response codes

Error 400 is simply `Bad Request` but will occur if the layer names reference and incorrect name.
