function main(map_div_id) {
    // Start connection to port 9090
    // L_ext.Websocket.connect('localhost', 9090);
    L_ext.Websocket.connect('outerpixels.com', 9090);

    // This is the default map layer.
    // We need a tile provider to provide us with the tiles of the map, depending on the zoom levels.
    // Without a tile provider we wouldn't be able to draw the map.
    // Below is a website where you can preview many different map styles from different tile providers:
    // https://leaflet-extras.github.io/leaflet-providers/preview/
    var default_map_layer = L.tileLayer(
        'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19
        }
    );

    // Create the map inside a div with the specified div-id
    var map = L.map(
        map_div_id,
        {
            zoomControl: false, // we want to add the zoom control ourselves later
            center: L.latLng(38.004697, 23.800735),
            zoom: 18,
            wheelPxPerZoomLevel: 150
        }
    );

    // Set the map to our extension class
    L_ext.init(map);

    // Triggers when map is clicked
    map.on('click', function onMapClick(e) {
            if (e == null || e.latlng == null) {
                console.log('broken map click event fired');
                return;
            }

            var marker = L_ext.createMarkerFromClick(e.latlng);

            if (marker != null) {
                // Fixing a leaflet bug... https://github.com/Leaflet/Leaflet/issues/4457
                marker.on('dragstart', function (e) {
                    map.off('click', onMapClick);
                });
                marker.on('dragend', function (e) {
                    setTimeout(function () {
                        map.on('click', onMapClick);
                    }, 10);
                });

                // Add the marker to the map
                map.addLayer(marker);
            }
        }
    );

    // This map layer will be our default. Without it our map wouldn't be able to be drawn
    map.addControl(default_map_layer);

    // Search bars and buttons - custom control
    map.addControl(L_ext.control.inputs(
        {
            position: 'topleft'
        }
    ));

    // Map buttons (zoom in/out and locate) - custom control
    map.addControl(L_ext.control.mapbuttons(
        {
            position: 'topleft'
        }
    ));

    // This is a scale which shows meters/feet, depending on the zoom levels
    map.addControl(L.control.scale(
        {
            position: 'bottomleft',
            maxWidth: 140
        }
    ));

    // Layers selector which enables the user to switch between different map styles
    // This is achieved by changing the URL to switch between different tile providers
    map.addControl(L.control.layers(
        {
            'Default': default_map_layer,
            'Hot': L.tileLayer(
                'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
                {
                    maxZoom: 19
                })
        },
        null,
        {
            position: 'bottomleft'
        })
    );
}


// ==================================================================================================


var L_ext = {
    Control: function () {
    },
    control: function () {
    }
};


L_ext.init = function (map) {
    this._inputs = [];
    this._markers = [];
    this._path_polyline = L.polyline(
        [],
        {
            color: 'blue',
            weight: 7,
            opacity: 0.58
        }
    );
    this._gray_polyline = L.polyline(
        [],
        {
            color: 'gray',
            weight: 4,
            opacity: 0.58
        }
    );
    this._SearchBarsContainer = null;
    map.addLayer(this._path_polyline);
    map.addLayer(this._gray_polyline);
};


L_ext.Websocket = {
    connect: function (server, port) {
        if (server == null)
            server = 'localhost';

        if (port == null)
            port = 9090;

        if ('WebSocket' in window) {
            var ws = this._ws = new WebSocket('ws://' + server + ':' + port);
            this._previous_msg = null;
            this._current_msg = null;
            this._query_is_pending = false;
            this._send_query_on_receive = false;

            ws.onopen = function () {
                console.log("Connected to the server.");
            };

            ws.onmessage = function (evt) {
                if (L_ext.Websocket._query_is_pending) {
                    L_ext.Websocket._query_is_pending = false;
                    if (L_ext.Websocket._send_query_on_receive) {
                        L_ext.Websocket._send_query_on_receive = false;
                        L_ext.Websocket._query_is_pending = true;
                        ws.send(L_ext.Websocket._current_msg);
                    }
                }

                var msg = evt.data;
                if (msg.startsWith('Error')) {
                    console.log(msg);
                    return;
                }

                // console.log("Message received: " + msg);

                var coordinates_string = L.Util.splitWords(msg);
                var coordinates = [];

                for (var i = 0; i < coordinates_string.length - 1; i += 2) {
                    var lat = parseFloat(coordinates_string[i]);
                    var lng = parseFloat(coordinates_string[i + 1]);
                    coordinates.push(L.latLng(lat, lng));
                }

                L_ext._path_polyline.setLatLngs(coordinates);
            };

            ws.onclose = function () {
                setTimeout(function () {
                        L_ext.Websocket.connect(server, port)
                    },
                    2000);
            };
        }
        else {
            alert("WebSocket not supported by your browser! Couldn't connect.");
        }
    },
    query: function () {
        if (this._ws.readyState == 1) { // readyState == 1 means that connection is established
            var inputs = L_ext._inputs;

            var msg = '';
            var valid_coordinates_counter = 0;

            for (var i = 0; i < inputs.length; i++) {
                if (inputs[i].value == '')
                    continue;

                var coordinates = L.Util.splitWords(inputs[i].value);

                if (coordinates.length != 2)
                    return;

                var lat = parseFloat(coordinates[0]);
                var lng = parseFloat(coordinates[1]);
                if (!L_ext.Util.isNumerical(lat) || !L_ext.Util.isNumerical(lng) || !L_ext.Util.isValidLatLng(lat, lng))
                    return;

                msg += lat + ' ' + lng + ' ';
                valid_coordinates_counter++;
            }

            if (valid_coordinates_counter < 2)
                return;

            this._previous_msg = this._current_msg;
            this._current_msg = msg;
            if (this._query_is_pending) {
                this._send_query_on_receive = true;
            }
            else if (this._previous_msg != this._current_msg) {
                this._query_is_pending = true;
                this._ws.send(msg);
            }
        }
    }
};


// ========
//   Util
// ========
L_ext.Util = {
    latLngToStr: function (latlng, precision) {
        if (precision === undefined)
            precision = 7;
        return L.Util.formatNum(latlng.lat, precision) + ' ' + L.Util.formatNum(latlng.lng, precision);
    },
    isValidLatLng: function (lat, lng) {
        return lat > -90 && lat < 90 && lng > -180 && lng < 180;
    },
    isNumerical: function (num) {
        return !isNaN(num);
    },
    DistanceInMeters: function () {
    }
};


// ===========
//   Markers
// ===========
L_ext.createMarkerFromClick = function (latlng) {
    var markers = L_ext._markers;
    var inputs = L_ext._inputs;

    // The variable index is the markers array-index of the next marker that will be added.
    // It will either be (markers.length - 1) or the index of the first null marker in our markers array
    var index = markers.length - 1;
    for (var i = 0; i < markers.length; i++) {
        if (markers[i] == null) {
            index = i;
            break;
        }
    }

    // Update the search bar text
    inputs[index].value = L_ext.Util.latLngToStr(latlng);

    var new_marker = null;

    // If the marker is not null
    if (markers[index] != null)
        markers[index].setLatLng(latlng); // update the marker's position
    else
        new_marker = L_ext._createMarker(index, latlng); // create the marker

    L_ext.Websocket.query(); // Send query to the server

    return new_marker
};


// The index argument is the markers array-index of the marker that will be added.
L_ext._createMarker = function (index, latlng) {
    var markers = L_ext._markers;
    var inputs = L_ext._inputs;

    // Set color of icon
    var icon;
    if (index == 0) { // we want to add a green marker
        icon = L_ext.greenMarkerIcon();
    }
    else if (index == inputs.length - 1) { // we want to add a red marker
        icon = L_ext.redMarkerIcon();
    }
    else { // we want to add a default marker
        icon = L_ext.markerIcon();
    }

    // Create new marker with the specified location and icon
    var marker = L.marker(
        latlng,
        {
            draggable: true,
            icon: icon
        }
    );
    marker.on('click', L.DomEvent.stopPropagation);
    marker.on('click', function () {
            var index = L.Util.indexOf(markers, marker);
            markers[index].remove();  // remove the marker from the webpage
            markers[index] = null;    // set the marker to null
            inputs[index].value = ''; // clear the search box
            // Send query to the server
            L_ext.Websocket.query();
        }
    );
    marker.on('drag', function (e) {
            var index = L.Util.indexOf(markers, marker);
            inputs[index].value = L_ext.Util.latLngToStr(e.latlng); // update the search bar text
            // Send query to the server
            L_ext.Websocket.query();
        }
    );
    markers[index] = marker; // update our markers array to include our newly created marker

    return marker;
};


// =============
// Create Inputs
// =============
L_ext.Control.Inputs = L.Control.extend({
    options: {
        position: 'topleft', // default
        // The placeholder default values of the search bars
        addButtons: true,
        firstPoint: 'Start Point',
        lastPoint: 'End Point',
        middlePoint: 'Middle point'
    },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'outerpixels-control-inputs-wrapper leaflet-control');
        var searchbars_container = L.DomUtil.create('div', 'outerpixels-control-searchbars-wrapper leaflet-control');
        var buttons_container = L.DomUtil.create('div', 'outerpixels-control-inputbuttons-wrapper leaflet-control');
        container.appendChild(searchbars_container);
        container.appendChild(buttons_container);
        L.DomEvent.on(searchbars_container, 'click dblclick mousedown', L.DomEvent.stopPropagation);
        L_ext._inputs = searchbars_container.getElementsByTagName('input'); // set our inputs array


        // Create search bars
        this._addSearchBar(map, searchbars_container);
        this._addSearchBar(map, searchbars_container);

        // Add buttons
        this._addButtons(map, buttons_container, searchbars_container);

        return container;
    },
    _addButtons: function (map, buttons_container, searchbars_container) {
        var markers = L_ext._markers;
        var inputs = L_ext._inputs;

        // =====================
        // Add revers bar button
        // =====================
        var reversbars_div = L.DomUtil.create('div', 'outerpixels-control-reversebars leaflet-bar leaflet-control', buttons_container);
        var reversbars_a = L.DomUtil.create('a', 'outerpixels-control-reversebars', reversbars_div);
        reversbars_a.href = '#';
        reversbars_a.innerHTML = '↑↓';
        // Stop events from propagation to parent elements
        L.DomEvent.on(reversbars_a, 'dblclick mousedown', L.DomEvent.stopPropagation);
        L.DomEvent.on(reversbars_a, 'click', L.DomEvent.stop);
        L.DomEvent.on(reversbars_a, 'click', function () {
                // Swap inputs
                for (var i = 0; i < Math.ceil(inputs.length / 2); i++) {
                    var j = markers.length - 1 - i;
                    var temp = inputs[i].value;
                    inputs[i].value = inputs[j].value;
                    inputs[j].value = temp;
                }
                // Swap markers
                for (i = 0; i < Math.ceil((markers.length - 1) / 2); i++) {
                    j = markers.length - 1 - i;
                    if (markers[i] != null && markers[j] != null) {
                        temp = markers[i].getLatLng();
                        markers[i].setLatLng(markers[j].getLatLng());
                        markers[j].setLatLng(temp);
                    }
                    else {
                        if (i == 0) {
                            if (markers[i] != null)
                                markers[i].setIcon(L_ext.redMarkerIcon());
                            if (markers[j] != null)
                                markers[j].setIcon(L_ext.greenMarkerIcon());
                        }
                        temp = markers[i];
                        markers[i] = markers[j];
                        markers[j] = temp;
                    }
                }
                L_ext.Websocket.query();
            }
        );

        // =====================
        // Add search bar button
        // =====================
        var searchbar_div = L.DomUtil.create('div', 'outerpixels-control-addsearchbar leaflet-bar leaflet-control', buttons_container);
        var searchbar_a = L.DomUtil.create('a', 'outerpixels-control-addsearchbar', searchbar_div);
        searchbar_a.href = '#';
        searchbar_a.innerHTML = '+';
        // Stop events from propagation to parent elements
        L.DomEvent.on(searchbar_a, 'dblclick mousedown', L.DomEvent.stopPropagation);
        L.DomEvent.on(searchbar_a, 'click', L.DomEvent.stop);
        L.DomEvent.on(searchbar_a, 'click', function () {
                L_ext._SearchBarsContainer._addSearchBar(map, searchbars_container);
            }
        );
    },
    _addSearchBar: function (map, searchbars_container) {
        var markers = L_ext._markers;
        var inputs = L_ext._inputs;

        var options = this.options;
        var searchbar_div = L.DomUtil.create('div', 'outerpixels-control-searchbar', searchbars_container);

        // Update markers array
        // We want to keep the markers array to the same length as the number of search bars
        markers.push(null);

        // ===========
        //    Input
        // ===========
        var input = L.DomUtil.create('input', '', searchbar_div);
        // Update placeholders
        switch (inputs.length) {
            case 1:
                input.placeholder = options.firstPoint;
                break;
            case 2:
                input.placeholder = options.lastPoint;
                break;
            default:
                input.placeholder = options.lastPoint;
                inputs[inputs.length - 2].placeholder = options.middlePoint;
                if (markers[markers.length - 2] != null) {
                    markers[markers.length - 2].setIcon(L_ext.blueMarkerIcon());
                }
        }
        input.onchange = function () {
            var removeMarker = function () {
                var index = L.Util.indexOf(inputs, input);
                if (markers[index] != null)
                    markers[index].remove(); // remove the marker from the webpage
                markers[index] = null; // set the marker to null
                inputs[index].value = ''; // clear the search box
                // Send query to the server
                L_ext.Websocket.query();
            };

            var coordinates = L.Util.splitWords(input.value);

            if (coordinates.length != 2) {
                removeMarker();
                return;
            }

            var lat = parseFloat(coordinates[0]);
            var lng = parseFloat(coordinates[1]);

            if (!L_ext.Util.isNumerical(lat) || !L_ext.Util.isNumerical(lng) || !L_ext.Util.isValidLatLng(lat, lng)) {
                removeMarker();
                return;
            }

            input.value = lat + ' ' + lng; // update the search box text without whitespaces

            var index = L.Util.indexOf(inputs, input);
            // If marker is null
            if (markers[index] == null) {
                // Create a marker
                var marker = L_ext._createMarker(index, L.latLng(lat, lng));
                map.addLayer(marker); // add the marker to the map
            }
            else {
                markers[index].setLatLng(L.latLng(lat, lng));
            }

            // Send query to the server
            L_ext.Websocket.query();
        };

        // ============
        // Clear button
        // ============
        var clearButton = L.DomUtil.create('a', 'outerpixels-control-searchbar-clear', searchbar_div);
        clearButton.innerHTML = String.fromCharCode(parseInt('00d7', 16)); // 'x' symbol as innerHtml
        clearButton.href = '#';
        L.DomEvent.on(clearButton, 'click', L.DomEvent.stop);
        L.DomEvent.on(clearButton, 'click', function () {
                // Get the index of the clicked element
                var index = L.Util.indexOf(inputs, input);

                // Remove the marker from the webpage
                if (markers[index] != null)
                    markers[index].remove();

                // If we only have 2 search boxes
                if (inputs.length <= 2) {
                    inputs[index].value = ''; // clear the search box
                    markers[index] = null; // set the marker to null
                }
                // If we have more than 2 search boxes
                else {
                    // Update placeholders
                    if (index == 0) { // if we want to remove the first element
                        if (markers[1] != null)
                            markers[1].setIcon(L_ext.greenMarkerIcon()); // update the color of the marker
                    }
                    else if (index == inputs.length - 1) { // if we want to remove the last element
                        if (markers[inputs.length - 2] != null)
                            markers[inputs.length - 2].setIcon(L_ext.redMarkerIcon()); // update the color of the marker
                    }
                    searchbar_div.remove(); // remove the bar from the webpage
                    markers.splice(index, 1); // remove the marker from our array
                }

                // Send query to the server
                L_ext.Websocket.query();
            }
        );
    }
});
L_ext.control.inputs = function (options) {
    L_ext._SearchBarsContainer = new L_ext.Control.Inputs(options);
    return L_ext._SearchBarsContainer;
};


// ===========================================
// Create map buttons (zoom in/out and locate)
// ===========================================
L_ext.Control.MapButtons = L.Control.extend({
    options: {
        position: 'topleft',
        defaultZoom: 15, // the zoom level of the map after locate button is clicked
        zoombuttons: true, // will add zoom buttons to the webpage
        locatebutton: true // will add locate button to the webpage
    },
    onAdd: function (map) {
        var options = this.options;
        var container = L.DomUtil.create('div', 'outerpixels-control-mapbuttons leaflet-control');

        // ============
        // Zoom Buttons
        // ============
        if (options.zoombuttons) {
            // Zoom in and out buttons
            var zoomcontrol = L.control.zoom(
                {
                    position: options.position
                }
            );
            map.addControl(zoomcontrol);
            container.appendChild(zoomcontrol.getContainer()); // add the zoom buttons to our mapbuttons div
        }

        // =============
        // Locate Button
        // =============
        if (options.locatebutton) {
            var locate_div = L.DomUtil.create('div', 'outerpixels-control-locate leaflet-bar leaflet-control', container);
            var locate_a = L.DomUtil.create('a', 'outerpixels-control-locate', locate_div);
            locate_a.href = '#';
            // Stop events from propagation to parent elements
            L.DomEvent.on(locate_a, 'dblclick mousedown', L.DomEvent.stopPropagation);
            L.DomEvent.on(locate_a, 'click', L.DomEvent.stop);
            L.DomEvent.on(locate_a, 'click', function () {
                    // If geolocation is supported
                    if ("geolocation" in navigator) {
                        // Get the user's current location and set the map view to that location
                        navigator.geolocation.getCurrentPosition(
                            function (location) {
                                map.setView(
                                    L.latLng(location.coords.latitude, location.coords.longitude),
                                    options.defaultZoom
                                );
                            }
                        );
                    } else {
                        alert("Geolocation is not supported.");
                    }
                }
            );
        }

        return container;
    }
});
L_ext.control.mapbuttons = function (options) {
    return new L_ext.Control.MapButtons(options);
};

// ==========================
// Custom marker icon classes
// ==========================
L_ext.MarkerIcon = L.Icon.extend({
    options: {
        iconUrl: 'images/marker-icon.png',
        shadowUrl: 'images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }
});
L_ext.markerIcon = function (options) {
    return new L_ext.MarkerIcon(options);
};


L_ext.GreenMarkerIcon = L_ext.MarkerIcon.extend({
    options: {
        iconUrl: 'images/green-marker.png'
    }
});
L_ext.greenMarkerIcon = function (options) {
    return new L_ext.GreenMarkerIcon(options);
};

L_ext.BlueMarkerIcon = L_ext.MarkerIcon.extend({
    options: {
        iconUrl: 'images/marker-icon.png'
    }
});
L_ext.blueMarkerIcon = function (options) {
    return new L_ext.BlueMarkerIcon(options);
};

L_ext.RedMarkerIcon = L_ext.MarkerIcon.extend({
    options: {
        iconUrl: 'images/red-marker.png'
    }
});
L_ext.redMarkerIcon = function (options) {
    return new L_ext.RedMarkerIcon(options);
};