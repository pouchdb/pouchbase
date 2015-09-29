'use strict';

var fs = require('fs');
var path = require('path');

var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var mkdirp = require('mkdirp');
var debug = require('debug')('pouchbase');
var marked = require('marked');
var exphbs = require('express-handlebars');

var DATA_DIR = './data/';
mkdirp.sync(DATA_DIR);
mkdirp.sync(DATA_DIR + 'tmp/');
mkdirp.sync(DATA_DIR + 'core/');

var PouchDB = require('pouchdb').defaults({prefix: DATA_DIR + 'core/'});
var TmpPouchDB = PouchDB.defaults({prefix: DATA_DIR + 'tmp/'});
var PublicPouchDB = PouchDB.defaults({prefix: DATA_DIR + 'public/'});

// The host we are exposed on
var hostUrl = process.env.HOST || 'http://127.0.0.1:3030/';
var host = require('url').parse(hostUrl);

var port = process.env.PORT || 3030;

var PouchBase = require('./pouchbase.js');
var pb = new PouchBase(hostUrl, PouchDB);

var app = express();

app.engine('.hbs', exphbs({defaultLayout: 'single', extname: '.hbs'}));
app.set('view engine', '.hbs');

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

// The general website
app.get('/', function(req, res) { res.render('testserver'); });
app.get('/tmp/', function(req, res) { res.render('testserver'); });
app.get('/public/', function(req, res) { res.render('datasets'); });
app.get('/user/', function(req, res) { res.render('userdb'); });
app.use(express.static(__dirname + '/../../public'));

// tmp dbs require no authentication, forward directly
app.use('/db/tmp/', require('pouchdb-express-router')(TmpPouchDB));

// public dbs will allow users to read, but not write data
function reject(req, res, next) {
  res.status(401).send({error: true, message: 'Unauthorised'});
}

app.post('/db/public/*', reject);
app.delete('/db/public/*', reject);
app.put('/db/public/*', reject);
app.use('/db/public', require('pouchdb-express-router')(PublicPouchDB));

// User databases require the user to be logged in
app.use('/db/users/', function(req, res, next) {
  if (!req.session.user) {
    debug('Unauthorised database access');
    res.status(401).send({error: true, reason: 'unauthorised'});
  } else {
    var dbName = pb.usersDbName(req.session.user, req.headers.origin);
    req.url = '/' + dbName + '/' + req.url.substring(1);
    next();
  }
});
app.use('/db/users', require('pouchdb-express-router')(PouchDB));

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
  pb.readSession(req.session.user, req.headers.origin)
    .then(function(result) {
      res.send(result);
    });
});

app.post('/session/', function (req, res) {
  pb.writeSession(req.session.user, req.headers.origin, req.body)
    .then(function(result) {
      res.send(result);
    });
});

app.post('/login/', function (req, res) {
  pb.login(req.body, req.headers.origin).then(function(result) {
    res.send(result);
  });
});

app.all('/validate/', function (req, res) {
  var uid = req.query.uid;
  var token = req.query.token;
  var host = req.query.host;
  pb.authenticate(uid, host, token).then(function(result) {
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

exports.fetchTokenUrl = pb.fetchTokenUrl.bind(pb);

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
