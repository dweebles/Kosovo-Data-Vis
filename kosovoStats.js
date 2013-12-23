var legend, legendGradient, legendTicks;
var legendGradientWidth = 30;
var legendGradientHeight = 200;

function drawLegend() {

    legend.append('svg:text')
        .attr('class', 'legend-title')
        .attr('x', -25)
        .attr('y', -20)
        .text('percent');

    // create the color gradient
    legendGradient.selectAll('rect')
        .data(d3.range(0, 1, 0.2))
        .enter()
        .insert('svg:rect')
        .attr('x', 1)
        .attr('y', function (d, i) {
            return i * 2;
        })
        .attr('width', legendGradientWidth)
        .attr('height', 2)
        .style('fill', function (d, i) {
            return d3.hsl(hue, 1, d);
        });

    legendTicks.selectAll('text')
        .data([maxValue, minValue])
        .enter()
        .insert('svg:text')
        .attr('class', 'legend-tick')
        .attr('text-anchor', 'end')
        .attr('x', -4)
        .attr('y', function (d, i) {
            return i * legendGradientHeight + 5;
        })
        .text(function(d, i) {
            return d3.format('.0f')(d) + '%';
        });

    // this is a dumb way of creating a border!
    legend.append('svg:rect')
        .attr('y', 0)
        .attr('x', 1)
        .attr('width', legendGradientWidth)
        .attr('height', legendGradientHeight)
        .style('fill', 'none')
        .style('stroke', '#ccc')
        .style('shape-rendering', 'crispEdges');
}
/**********************************************************************************************************************************/

/**
 * Formats a number to a 0,000.00 specification, there's probably a library for
 * this
 */
function format(number) {
    number += '';
    x = number.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1].substr(0, 2) : '';
    var regexp = /(\d+)(\d{3})/;
    while (regexp.test(x1))
        x1 = x1.replace(regexp, '$1' + ',' + '$2');
    return x1 + x2;
}

$(function() {

    // # of choropleth colors we're supporting (up to 9)
    var choropleth_range = 9;

    /*
     * Set up plain Kosovo map when the document is ready (we actually need the width
     * measurements)
     */

    // Width calculation is pretty straightforward, but the height calculation
    // uses the magic margin number.  Note that the centering, scaling, and
    // translation assumes you'll be viewing this in a window that has more width
    // than height
    var margin = 60,
        width = $('#chart').width(),
        height = window.innerHeight - $('#navigation').height() - margin;

    // Equirectangular projection isn't very nice to look at, but the projection
    // function is very simple, and that makes it easy to solve for the ideal
    // scale and translation, which we do later
    var projection = d3.geo.equirectangular();

    var path = d3.geo.path().projection(projection);

    d3.json('data/new_map.json', function(json) {

        /*
         * Set up zip code boundary features
         */

        var features = json.features;

        var svg = d3.select('#chart').append('svg')
            .attr('width', width)
            .attr('height', height)
            .call(d3.behavior.zoom().on('zoom', redraw));

        var zipcodes = svg.append('g')
            .attr('id', 'nyc-zipcodes')
            .attr('class', 'Blues');

        zipcodes.selectAll('path')
            .data(features)
            .enter().append('path')
                .attr('d', path)
                .attr('title', function(d) {
                    return d.id;
                })
                .html(function(d) {
                    $(this).tooltip({ 'placement': 'left' });
                });

        // Figure out latitude and longitude bounds for our geography
        var longitude_bounds = [null, null],
            latitude_bounds = [null, null];

        features.forEach(function(feature) {
            var bounds = d3.geo.bounds(feature);
            if (longitude_bounds[0] == null || bounds[0][0] < longitude_bounds[0])
                longitude_bounds[0] = bounds[0][0];
            if (longitude_bounds[1] == null || bounds[1][0] > longitude_bounds[1])
                longitude_bounds[1] = bounds[1][0];
            if (latitude_bounds[0] == null || bounds[0][1] < latitude_bounds[0])
                latitude_bounds[0] = bounds[0][1];
            if (latitude_bounds[1] == null || bounds[1][1] > latitude_bounds[1])
                latitude_bounds[1] = bounds[1][1];
        });

        // Reverse-engineer the appropriate scale and translation factors if we want
        // [(min_longitude + max_longitude) / 2, max_latitude] to [width / 2, 0] and
        // [(min_longitude + max_longitude) / 2, min_latitude] to [width / 2, height]
        // i.e. scale the center-axis of our bounding box to the center-axis of the
        // SVG canvas (this is basically solving a system of three equations in three
        // unknowns)
        var scale = 360 * height / (latitude_bounds[1] - latitude_bounds[0]);
        var translation = [
            width / 2 - scale * (longitude_bounds[0] + longitude_bounds[1]) / 720,
            scale * latitude_bounds[1] / 360,
        ];

        projection.scale(scale);
        projection.translate(translation);
        zipcodes.selectAll('path').attr('d', path);

        // redraw() from http://bl.ocks.org/1283960
        function redraw() {
            // d3.event.translate (an array) stores the current translation from the
            // parent SVG element.  t (an array) stores the projection's default
            // translation.  We add the x and y vales in each array to determine the
            // projection's new translation
            var tx = translation[0] * d3.event.scale + d3.event.translate[0];
            var ty = translation[1] * d3.event.scale + d3.event.translate[1];
            projection.translate([tx, ty]);

            // Now we determine the projection's new scale, but there's a problem:
            // the map doesn't 'zoom onto the mouse point'
            projection.scale(scale * d3.event.scale);

            // Redraw the map
            zipcodes.selectAll('path')
                .attr('d', path);
        }

        // We're only going to enable the loading features when the population data
        // is loaded, since we don't know if people will ask for per-capita views
       
            $('#data-select').prop('disabled', false);
            $('#load-button').prop('disabled', false);
     

        /*
         * Handlers for UI elements
         */

        var file_handles = {};
        $('#dummy-file').change(function(ui) {
            var filelist = ui.target.files;
            for (var i = 0; i < filelist.length; ++i) {
                var file = filelist.item(i);
                $('#data-select').prepend(
                    $('<option></option>')
                        .attr('name', file.fileName)
                        .attr('value', file.fileName)
                        .prop('uploaded', true)
                        .text(file.fileName));
                $('#data-select').val(file.fileName);

                // Save the "File" object so we can retrieve it later
                file_handles[file.fileName] = file;
            }
        });

        $('#data-select').change(function(ui) {
            if (ui.target.value == "upload")
                $('#dummy-file').click();
        });

        $('#load-button').click(function() {
            var getValue = $('#data-select').val().split(",");
            var filename = getValue[0];
            var color = getValue[1];
            zipcodes.attr('class', color);
              $('#feature-types').empty();
           
            // alert(lang_val);
            if ($('#data-select option[value="' + filename +'"]').prop('uploaded')) {
                var file = file_handles[filename];
                if (file) {
                    var reader = new FileReader();
                    reader.readAsText(file);
                    reader.onloadend = function() {
                        loadJSON(JSON.parse(reader.result));
                    };
                }
            } else {
              
                d3.json(filename, loadJSON);
            }
        });

        $('#color-types').change(function(ui) {
            zipcodes.attr('class', ui.target.value);
        });

        $('#slider').slider({
            min: 3,
            max: 9,
            value: 9
        });

        $('#reset-button').click(function() {
            projection.scale(scale);
            projection.translate(translation);
            d3.behavior.zoomReset();
            zipcodes.selectAll('path')
                .attr('d', path);
        });

        /*
         * Functions to handle datasets
         */

        function loadJSON(json) {
            var feature = null;


            function loadFeature(feature) {
                var option = $('#feature-types option[value="' + feature +'"]');
                var is_per_capita = option.prop('per-capita');

                if (is_per_capita)
                    feature = option.prop('original');

                var domain = [];
                for (var k in data) {
                    if (data[k][feature]) {
                        if (is_per_capita)
                            domain.push(data[k][feature] / k);
                        else
                            domain.push(data[k][feature]);
                    }
                }
                domain.sort(function(a, b) { return a - b; });

                zipcodes.selectAll('path')
                    .attr('data-original-title', function(d) {
                        var value = data[d.id];
                        var output = value ? (value[feature] ? (is_per_capita ? value[feature] / d.properties.name : value[feature]) : 0) : 0;
                        return d.properties.name + ': ' + format(output);
                    })
                    .attr('class', createQuantization(domain, choropleth_range, $('#quantize-types').val()));

                // Creates the function that quantizes the different zip codes
                // into the specified number of buckets
                function createQuantization(domain, buckets, type) {
                    var scale = null;
                    switch (type) {
                        case 'quantile':
                            var range = [];
                            for (var i = 0; i < domain.length; ++i)
                                range.push(Math.floor(i / (Math.ceil(domain.length / buckets))));
                            scale = d3.scale.ordinal()
                                .domain(domain)
                                .range(range);
                            break;
                        case 'linear':
                            scale = d3.scale.linear()
                                .domain([0, d3.max(domain)])
                                .range([0, buckets - 1]);
                            break;
                        case 'log':
                            scale = d3.scale.log()
                                .domain([1, d3.max(domain) + 1])
                                .range([0, buckets]);
                            break;
                        case 'pow':
                            scale = d3.scale.pow()
                                .exponent(0.5)
                                .domain([1, d3.max(domain) + 1])
                                .range([0, buckets]);
                            break;
                        default:
                            break;
                    }

                    return function(d) {
                        if (data[d.id] && data[d.id][feature]) {
                            var domain_value = data[d.id][feature];
                            if (is_per_capita)
                                domain_value /= d.id;
                            return 'q' + ~~scale(domain_value) + '-' + buckets;
                        } else {
                            return 'q0-' + buckets;
                        }
                    };
                }

                // We bind the change event in the slider here to pull in the
                // scale and recalculate the quantization style classes
                $('#slider').bind('slidechange', function(event, ui) {
                    choropleth_range = ui.value;
                    $('#choropleth-count').text(ui.value);

                    zipcodes.selectAll('path')
                        .attr('class', createQuantization(domain, choropleth_range, $('#quantize-types').val()));
                });

                $('#quantize-types').change(function(ui) {
                    zipcodes.selectAll('path')
                        .attr('class', createQuantization(domain, choropleth_range, ui.target.value));
                });
            }

            // Clear out options from any previous loads
            $('#feature-types').children().remove().end();
            var data = json.data;
            var lang_val = $('#selectMe').val();
                 

                json.specification.forEach(function(type) {


             if (lang_val == 1)
            {
                    $('#feature-types').append(
                        $('<input type="radio" name="domain" /> '+type.text1+'<br/>')
                            .attr('value', type.id)
                           
                            );
            }
             if (lang_val == 2)
            {
                     $('#feature-types').append(
                        $('<input type="radio" name="domain" /> '+type.text2+'<br/>')
                            .attr('value', type.id)
                            );
            }
             if (lang_val == 3)
            {
                    $('#feature-types').append(
                        $('<input type="radio" name="domain" /> '+type.text3+'<br/>')
                            .attr('value', type.id)
                            );
            }
                // We're introducing some convenience here by using the population
                // data to auto-calculate per-capita usage for things that are
                // specified as per-capita-calculatable
                if (type['per-capita']) {
                    $('#feature-types').append(
                        $('<option></option>')
                            .attr('value', type.id)
                            .prop('original', type.id)
                            .text(type.text ));
                }

                if (feature == null)
                    feature = type.id;
            })

            loadFeature(feature);

            $('#feature-types').change(function(ui) {
                loadFeature(ui.target.value);
            });
        }
    });
});
