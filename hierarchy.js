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
      console.log("Ranking", node, i, ranks);
      if (i == ranks.length) {
        return node;
      } else {
        var rank = ranks[i];
        var j = i + 1;
        if (! node.children) {
          return node;
        } else if (node.level == rank) {
          node.children = node.children.map(function(sub) {
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
      width = 760,
      height = 760;

  function chart(selection) {
    selection.each(function(data) {

      console.log(data);

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

      var radius = width / 2;
      var padding = 5;
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
        .attr("fill-rule", "evenodd")
        .style("fill", colour);

      function colour(d) {
        if (d.placeholder) {
          return "none";
        } else if (! d.index) {
          return "none";
        } else {
          var index = parseInt(d.index) || 1;
          console.log(scale, index);
          var base = scale(index);
          console.log(index);
          return d3.hsl(base).brighter(d.y);
        }
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