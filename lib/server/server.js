'use strict';

var fs = require("fs");

var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var mkdirp = require('mkdirp');
var debug = require('debug')('janus');
var marked = require('marked');

var DATA_DIR = './data/';
mkdirp.sync(DATA_DIR);

var PouchDB = require('pouchdb').defaults({
  prefix: DATA_DIR
});

// The host we are exposed on
var hostUrl = process.env.HOST || 'http://127.0.0.1:3030/';
var host = require('url').parse(hostUrl);

var port = process.env.PORT || 3030;

var Janus = require('./janus.js');
var janus = new Janus(hostUrl, PouchDB);

var app = express();

function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.end();
  } else {
    next();
  }
}

app.use(allowCrossDomain);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  keys: ['keyboard', 'cat'],
  maxAge: 1000 * 60 * 60 * 24 * 30
}));

var readme = fs.readFileSync('./README.md', 'utf8');
var index = marked(readme);

app.get('/', function(req, res) {
  res.send(index);
});

app.get('/pouch.host.js', function(req, res) {
  res.sendFile('pouch.host.js', {root: './dist/'});
});

// Requests to /db/ get forwarded to the current sessions user database
app.use('/db', function(req, res, next) {
  if (!req.session.user) {
    debug('Unauthorised database access');
    res.status(401).send({
      error: true,
      reason: 'unauthorised'
    });
  } else {
    var dbName = janus.usersDbName(req.session.user, req.headers.origin);
    req.url = '/' + dbName + '/' + req.url.substring(1);
    next();
  }
});

app.use('/db', require('pouchdb-express-router')(PouchDB));

app.all('/session/', function (req, res, next) {
  if (!req.session.user) {
    debug('Unauthorised session access');
    return res.status(401).send({
      error: true,
      reason: 'unauthorised'
    });
  } else {
    next();
  }
});

app.get('/session/', function (req, res) {
  janus.readSession(req.session.user, req.headers.origin)
    .then(function(result) {
      res.send(result);
    });
});

app.post('/session/', function (req, res) {
  janus.writeSession(req.session.user, req.headers.origin, req.body)
    .then(function(result) {
      res.send(result);
    });
});

app.post('/login/', function (req, res) {
  janus.login(req.body, req.headers.origin).then(function(result) {
    res.send(result);
  });
});

app.all('/validate/', function (req, res) {
  var uid = req.query.uid;
  var token = req.query.token;
  var host = req.query.host;
  janus.authenticate(uid, host, token).then(function(result) {
    if (result.ok) {
      req.session.user = req.query.uid;
    }
    if (req.method === 'GET' && result.origin) {
      res.redirect(result.origin);
    } else {
      res.send(result);
    }
  });
});

app.post('/logout/', function(req, res) {
  req.session = null;
  res.send({ok: true});
});

exports.fetchTokenUrl = janus.fetchTokenUrl.bind(janus);

exports.init = function(cb) {
  var server = app.listen(port, function() {
    if (cb) {
      cb(server);
    }
  });
};

if (require.main === module) {
  exports.init();
}
