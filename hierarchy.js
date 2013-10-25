/**
 * A hierarchy displaying modified version of a zoomable sunburst. 
 */

function buildHierarchy(filename, callback) {
  var blocks = {
      "SEQUENCE": [],
      "SPECIES": [],
      "GENUS": [],
      "FAMILY": [],
      "PHYLUM": [],
      "ORDER": [],
      "CLASS": []
  }

  var levels = [
    "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"
  ]

  var identifiers = {0: {children: []}};

  function dataLoaded() {
    levels.forEach(function(level) {
      blocks[level].forEach(function(row) {
        var parent = identifiers[row.parent];
        if (! parent) parent = identifiers[0];
        if (! parent.hasOwnProperty('children')) parent.children = [];
        parent.children.push(identifiers[row.id]);
      })
    });

    var ranks = levels.filter(function(rank) {
      return blocks[rank].length > 0;
    });

    // And now we need to recurse through the levels, adding extra placeholder items 
    // if and when we need to. These can be omitted using the display process. 

    function ranked(node, i, ranks) {
      if (i == ranks.length) {
        return node;
      } else {
        var rank = ranks[i];
        var j = i + 1;
        if (! node.children) {
          return node;
        } else if (node.level == rank) {
          var sortedChildren = node.children.sort(function(a, b) {
            return b.score - a.score;
          });
          node.children = sortedChildren.map(function(sub) {
            return ranked(sub, j, ranks);
          })
          return node;
        } else {
          var newNode = {placeholder: true, level: rank, children: [ranked(node, j, ranks)]};
          return newNode;
        }
      }
    } 

    var root = identifiers[0];
    root.level = "ROOT";
    ranks.unshift("ROOT");

    callback(ranked(root, 0, ranks));
  }

  // Now, we really should introduce some placeholders, but this can probably omit 
  // ranks that are genuinely not populated at all. 

  d3.tsv(filename).get(function(error, rows) { 
    rows.forEach(function(row) {
      blocks[row.level].push(row);
      identifiers[row.id] = row;
    });
    dataLoaded();
  });
}

function hierarchyChart() {
  var margin = {top: 20, right: 20, bottom: 20, left: 20},
      width = 400,
      height = 400,
      duration = 1000;

  function chart(selection) {
    selection.each(function(data) {

      var partition = d3.layout.partition()
          .sort(null)
          .value(function(d) { return d.score; })
          .children(function(d) { return d.children || []; });

      var nodes = partition.nodes(data);

      var arc = d3.svg.arc()
        .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
        .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
        .innerRadius(function(d) { return Math.max(0, d.y ? y(d.y) : d.y); })
        .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });

      var padding = 5;
      var radius = width / 2 - padding;
      var x = d3.scale.linear().range([0, 2 * Math.PI]);
      var y = d3.scale.pow().exponent(1.3).domain([0, 1]).range([0, radius]);
      var scale = d3.scale.category10();

      var div = d3.select(this);
      var svg = div.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + [radius + padding, radius + padding] + ")");

      var path = svg.selectAll("path").data(nodes);
      path.enter().append("path")
        .attr("id", function(d, i) { return "path-" + i; })
        .attr("d", arc)
        .style("fill", colour)
        .on("click", click);

      var text = svg.selectAll("text").data(nodes);
      var textEnter = text.enter().append("text")
        .style("fill-opacity", 1)
        .style("fill", function(d) {
          return brightness(d3.rgb(colour(d))) < 125 ? "#eee" : "#000";
        })
        .attr("text-anchor", function(d) {
          return x(d.x + d.dx / 2) > Math.PI ? "end" : "start";
        })
        .attr("dy", ".2em")
        .attr("transform", function(d) {
          var multiline = (d.name || "").split(" ").length > 1,
              angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90,
              rotate = angle + (multiline ? -.5 : 0);
          return "rotate(" + rotate + ")translate(" + (y(d.y) + padding) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
        })
      textEnter.append("tspan")
        .attr("x", 0)
        .text(function(d) { return d.name; });


      // Colour handling really would be better by mapping colours recursively. We want a
      // colour for the top-level nodes, and can then use gradations at lower levels. This
      // is probably better coded into the nodes. The down-side is that small gradations can
      // be hard to see. 

      function colour(d) {
        if (d.placeholder) {
          return "white";
        } else if (! d.index) {
          return "red";
        } else {
          var index = parseInt(d.index) || 1;
          var base = scale(index);
          return d3.hsl(base).brighter(d.y);
        }
      }

      function brightness(rgb) {
        return rgb.r * .299 + rgb.g * .587 + rgb.b * .114;
      }

      function click(d) {
        path
          .transition()
          .duration(duration)
          .attrTween("d", arcTween(d));
        text.style("visibility", function(e) {
          return isParentOf(d, e) ? null : d3.select(this).style("visibility");
          })
          .transition()
          .duration(duration)
          .attrTween("text-anchor", function(d) {
            return function() {
              return x(d.x + d.dx / 2) > Math.PI ? "end" : "start";
            };
          })
          .attrTween("transform", function(d) {
            var multiline = (d.name || "").split(" ").length > 1;
            return function() {
              var angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90,
                  rotate = angle + (multiline ? -.5 : 0);
              return "rotate(" + rotate + ")translate(" + (y(d.y) + padding) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
            };
          })
          .style("fill-opacity", function(e) { return isParentOf(d, e) ? 1 : 1e-6; })
          .each("end", function(e) {
            d3.select(this).style("visibility", isParentOf(d, e) ? null : "hidden");
          });
      }

      function arcTween(d) {
        var my = maxY(d),
            xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
            yd = d3.interpolate(y.domain(), [d.y, my]),
            yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
        return function(d) {
          return function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
        };
      }

      function maxY(d) {
        return d.children ? Math.max.apply(Math, d.children.map(maxY)) : d.y + d.dy;
      }

      function isParentOf(p, c) {
        // console.log("isParentOf", p, c);
        if (p === c) return true;
        if (p.children) {
          return p.children.some(function(d) {
            return isParentOf(d, c);
          });
        }
        return false;
      }


      // var svg = d3.select(this).selectAll("svg").data([data]);

      // // Otherwise, create the skeletal chart.
      // var gEnter = svg.enter().append("svg").append("g");
      // gEnter.append("path").attr("class", "area");
      // gEnter.append("path").attr("class", "line");
      // gEnter.append("g").attr("class", "x axis");

      // svg.attr("width", width)
      //    .attr("height", height);


    });
  }

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  return chart;
}     