// Heliotrope

var express = require('express');

var mongo = require("mongodb"),
    BSON = mongo.BSONPure,
    MongoClient = mongo.MongoClient;

var app = module.exports.app = express();

// Config needs to be exported before we get here. And yes, this
// is a bit nasty. 

function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}

function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.send(500, { error: "Error: " + err.name + " " + err.message, err: err });
  } else {
    next(err);
  }
}

function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}

app.configure(function(){
  app.locals.pretty = true;

  app.use(express.logger('dev'));
  app.use(express.static(process.cwd(), { maxAge: 0 }));
  app.use(express.methodOverride());

  app.use(app.router);
  app.use(logErrors);
  app.use(clientErrorHandler);
  app.use(errorHandler);

  // Unusually, we don't have global authorization here, although we could. This allows
  // the knowledge base to have public read access, without allowing access to the tracker
  // without logging in. The session here doesn't block access in the absence of a session,
  // but it does populate the session. To restrict, the authentication system needs to 
  // verify the existence of req.user for routes that we need authenticated. 
});

app.get('/api/stats/global', function(req, res){
  res.send({featureDensity: 0.02, featureCount: 10000});
});

app.get('/api/stats/region/:id', function(req, res){
  console.log("Request for region statistics", req.params);
  res.send({});
});

function calculateBoxSize(interval) {
  var scale = Math.round(3 * (Math.log(interval) / Math.LN10));
  var digits = Math.floor(scale / 3);
  var remainder = scale - 3 * digits;
  return Math.pow(10, digits) * ((remainder == 2) ? 5 : (remainder == 1) ? 2 : 1);
}

app.get('/api/browser/gene', function(req, res){

  var segment = req.query['segment'];
  var segmentRegex = /^(\w+):(\d+)-(\d+)$/;
  var segmentMatch = segmentRegex.exec(segment);

  MongoClient.connect("mongodb://localhost:27017/capsid", function (err, db) {

    if (err) return console.log(err);

    if (req.query['histogram'] == 'true') {
      var interval = calculateBoxSize(parseInt(req.query['interval']));
      var start = parseInt(segmentMatch[2]);
      var end = parseInt(segmentMatch[3]);
      var histogramCount = Math.ceil((end - start) / interval);

      db.collection("feature", function(err, feature) {
        var query = {genome: 302309598, type : "gene", start: {'$lte' : end}, end: {'$gte' : start}};
        var cursor = feature.find(query).toArray(function(err, docs) {
          var data = Array.apply(null, new Array(histogramCount)).map(Number.prototype.valueOf,0);
          docs.forEach(function(doc) {
            var box = Math.floor((doc.start - start) / interval);
            data[box]++;
          });
          var maximum = Math.max.apply(Math, data);
          var result = data.map(function(count, i) {
            return {start: (start += interval), end: start, interval: 0, absolute: count, value: count / maximum};
          });
          res.send(result);
        });
      });

    } else {
      db.collection("feature", function(err, feature) {
        var start = parseInt(segmentMatch[2]);
        var end = parseInt(segmentMatch[3]);
        var query = {genome: 302309598, type : "gene", start: {'$lte' : end}, end: {'$gte' : start}};
        var cursor = feature.find(query).toArray(function(err, docs) {
          db.close();
          res.send({data: docs});
        })
      });

    }
  });
});

app.get('/api/browser/feature', function(req, res){

  var segment = req.query['segment'];
  var segmentRegex = /^(\w+):(\d+)-(\d+)$/;
  var segmentMatch = segmentRegex.exec(segment);

  MongoClient.connect("mongodb://localhost:27017/capsid", function (err, db) {

    if (err) return console.log(err);

    if (req.query['histogram'] == 'true') {
      var interval = calculateBoxSize(parseInt(req.query['interval']));
      var start = parseInt(segmentMatch[2]);
      var end = parseInt(segmentMatch[3]);
      var histogramCount = Math.ceil((end - start) / interval);

      db.collection("mapped", function(err, mapped) {
        var query = {genome: 302309598, refStart: {'$lte' : end}, refEnd: {'$gte' : start}};
        var cursor = mapped.find(query).toArray(function(err, docs) {
          var data = Array.apply(null, new Array(histogramCount)).map(Number.prototype.valueOf,0);
          docs.forEach(function(doc) {
            var box = Math.floor((doc.refStart - start) / interval);
            data[box]++;
          });
          var maximum = Math.max.apply(Math, data);
          var result = data.map(function(count, i) {
            return {start: (start += interval), end: start, interval: 0, absolute: count, value: count / maximum};
          });
          res.send(result);
        });
      });

    } else {

      db.collection("mapped", function(err, mapped) {
        var start = parseInt(segmentMatch[2]);
        var end = parseInt(segmentMatch[3]);
        var query = {genome: 302309598, refStart: {'$lte' : end}, refEnd: {'$gte' : start}};
        var cursor = mapped.find(query).toArray(function(err, docs) {
          db.close();
          res.send({data: docs.map(function(doc) {
            return {start: doc.refStart, end: doc.refEnd, strand: doc.refStrand, id: doc.readId};
          })});
        })
      });

    }

  });

});

if(!process.argv[2] || !process.argv[2].indexOf("expresso")) {
  app.listen(3000, "127.0.0.1");
  console.log("Express server listening on port 3000");
}