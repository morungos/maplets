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

app.get('/api/features/:id', function(req, res){
  MongoClient.connect("mongodb://localhost:27017/capsid", function (err, db) {
    db.collection("mapped", function(err, mapped) {
      var start = parseInt(req.query["start"])
      var end = parseInt(req.query["end"]);
      var query = {sample: "s1", genome: 302309598, refStart: {'$lte' : end}, refEnd: {'$gte' : start}};
      var cursor = mapped.find(query).toArray(function(err, docs) {
        db.close();
        res.send({features: docs.map(function(val) {
          return {start: val.refStart, end: val.refEnd, strand: val.refStrand, uniqueID: val['_id'].toString()};
        })});
      })
    })
  });
});

app.get('/api/densities/:id', function(req, res){

  var basesPerBin = parseInt(req.query['basesPerBin']);
  var start = parseInt(req.query['start']);
  var end = parseInt(req.query['end']);

  MongoClient.connect("mongodb://localhost:27017/capsid", function (err, db) {
    db.collection("mapped", function(err, mapped) {
      var start = parseInt(req.query["start"])
      var end = parseInt(req.query["end"]);
      var query = {sample: "s1", genome: 302309598, refStart: {'$lte' : end}, refEnd: {'$gte' : start}};
      var cursor = mapped.find(query).toArray(function(err, docs) {
        db.close();

        // http://stackoverflow.com/questions/1295584/most-efficient-way-to-create-a-zero-filled-javascript-array
        var bins = Array.apply(null, Array(Math.ceil((end - start + 1)/basesPerBin))).map(Number.prototype.valueOf, 0);
        docs.forEach(function(val) {
          var thisStartBin = Math.floor((val.refStart - start)/basesPerBin);
          var thisEndBin = Math.floor((val.refEnd - start)/basesPerBin);
          for(var i = Math.max(0,thisStartBin); i <= thisEndBin; i++) {
            bins[i]++;
          }
        });
        var max = Math.max.apply(null, bins);
        res.send({bins: bins, stats: {basesPerBin: basesPerBin, max: max}});
      })
    });
  });
});

if(!process.argv[2] || !process.argv[2].indexOf("expresso")) {
  app.listen(3000, "127.0.0.1");
  console.log("Express server listening on port 3000");
}