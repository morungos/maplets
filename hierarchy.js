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

    var rankedRoot = ranked(root, 0, ranks);
    callback(rankedRoot);
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

  function annotate(node, parent, context, left) {
    var percentage = (100 * node.value).toFixed(1) + "%";
    node.percentage = percentage;
    node.context = context;
    var right = left + 1;
    if (node.children) {
      node.children.forEach(function(child, i) {
        right = annotate(child, node, (context) ? (context + "." + i.toString()) : i.toString(), right) + 1;
      })
    }
    node.left = left;
    node.right = right;
    return right;
  }

  function chart(selection) {
    selection.each(function(data) {

      var partition = d3.layout.partition()
          .sort(null)
          .value(function(d) { return d.score; })
          .children(function(d) { return d.children || []; });

      var nodes = partition.nodes(data);
      annotate(nodes[0], nodes[0], "", 0);

      var rootNode = nodes[0];

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

      var path = svg.selectAll("path.background").data(nodes);
      path.enter().append("path")
        .attr("class", "background")
        .attr("id", function(d, i) { return "path-" + i; })
        .attr("d", arc)
        .style("fill", colour)
        .on("click", click);

      var labels = svg.selectAll("text").data(nodes);
      var labelsEnter = labels.enter()
        .append("text")
        .style("visibility", function(d) { return (visibleLabel(rootNode, d) ? "visible" : "hidden"); })
        .style("font-size", "12px")
        .style("fill", "black")
        .attr("dx", "5px")
        .attr("dy", "20px")
        .attr("text-anchor", "middle")
        .append("textPath")
        .attr("xlink:href", function(d, i) { return "#path-" + i; })
        .attr("startOffset", "25%")
        .text(textLabel)
        .on("click", click);

      var overlayPath = svg.selectAll("path.hierarchyLabel").data(nodes);
      overlayPath.enter().append("path")
        .attr("class", tooltipClass)
        .attr("id", function(d, i) { return "npath-" + i; })
        .attr("d", arc)
        .style("fill", "rgba(255, 255, 255, 0.0)")
        .attr("data-tooltip", textLabel)
        .on("click", click);

      // Colour handling really would be better by mapping colours recursively. We want a
      // colour for the top-level nodes, and can then use gradations at lower levels. This
      // is probably better coded into the nodes. The down-side is that small gradations can
      // be hard to see. 

      function visible(d) {
        return ! (d.level == "ROOT" || d.placeholder);
      }

      function visibleLabel(d, e) {
        return ! (e.level == "ROOT" || e.placeholder || (e.value < (d.value / 20)));
      }

      function tooltipClass(d) {
        if (visible(d)) {
          return "hierarchyLabel";
        } else {
          return "invisibleLabel";
        }
      }

      function textLabel(d) {
        return d.level + ": " + d.name;
      }

      function colour(d) {
        if (d.placeholder) {
          return "white";
        } else if (d.context == "") {
          return "red";
        } else {
          var category = parseInt(d.context);
          var base = scale(category);

          // var index = parseInt(d.index) || 1;
          // var base = scale(index);
          return d3.hsl(base).brighter(d.y);
        }
      }

      function brightness(rgb) {
        return rgb.r * .299 + rgb.g * .587 + rgb.b * .114;
      }

      function click(d) {
        jQuery('.hierarchyLabel').qtip('hide');
        path
          .transition()
          .duration(duration)
          .attrTween("d", arcTween(d));
        overlayPath
          .transition()
          .duration(duration)
          .attrTween("d", arcTween(d));
        labels.style("visibility", function(e) {
          return (visibleLabel(d, e) && isParentOf(d, e)) ? "visible" : "hidden";
          });
        setTimeout(function() {
          jQuery('.hierarchyLabel').qtip('reposition');
        }, duration + 50);
        
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

      jQuery('.hierarchyLabel').qtip({
        content:{attr: 'data-tooltip'}, 
        position: {target: 'mouse', adjust: {mouse: true, x: 5, y: 0}}});
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