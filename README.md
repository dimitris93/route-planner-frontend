## Synopsis

This website is the front-end of our routing engine. 

## Drawing the map

We use the **leaflet** javascript API to draw (or render) the map on the screen. This framework is really simple at its core, it simply fetches 256x256 .png images (in other words, tiles) which are placed side-by-side to show the correct part of the map. Depending on the zoom level and the view we set in our map, the API fetches the images necessary to fill the user's screen with tiles, in other words, draw the map. 

This images are provided from many servers, aka **tile providers**, but we could download them locally on our server if we wanted to. Each tile provider results in a slightly different "style" or "theme" to the map. [Here](https://leaflet-extras.github.io/leaflet-providers/preview/) is a great website where you can preview how the tiles of various tile providers look like.

Also, the tile providers follow kind of a "common protocol", meaning that they store the tiles in very specific folders, with specific names, so that they are accessible from many different APIs and frameworks that want to offer map-rendering functionality.

Here is an example of a single map tile. Notice that the image is saved on a very specific directory, so that **leaflet** (and the other frameworks) can access it easily within their API.

Url format:   `http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` <br>
Example tile: `http://b.tile.openstreetmap.org/16/37096/25278.png`

![1](http://b.tile.openstreetmap.org/16/37096/25278.png) 

## Sending a query to the user

Since we are using Javascript for the web application, the default way to communicate from the client (javascript - web application) to the server (c++ - server side) is with **Websockets**. If you don't already know about them, please look it up.

When the user performs certain actions in the website, for example adding/moving/deleting nodes, we send a query to the `server-side`. The **query** format we follow right now is really simple, for example:

Format: `Latitude_A Longitude_A Latitude_B Longitude_B`<br>
Example query: `38.0006436 23.7786841 38.0022161 23.7793064`

The message we get in **response** from the c++ application after the shortest path algorithm is computed, is the **nodes sequence of the shortest path**. The message we receive is in the same format as the query we sent, only this time we have a lot more nodes, each 2 adjacent nodes basically represent an edge in the shortest path. For example here is a **response** from the server.

Example shortest path response: `38.0006897 23.7785669 38.0007352 23.7785848 38.0009246 23.7786363 38.0012873 23.7786724 38.0013635 23.7793300 38.0017295 23.7791770 38.0019797 23.7790311 38.0022526 23.7792636`
