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

app.get('/favicon.ico', function(req, res) {
  res.send(404, "Not Found");
})

app.get('/*', function(req, res){
  res.sendfile(__dirname + req.url);
});

if(!process.argv[2] || !process.argv[2].indexOf("expresso")) {
  app.listen(3000, "127.0.0.1");
  console.log("Express server listening on port 3000");
}