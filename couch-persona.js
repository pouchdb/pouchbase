#!/usr/bin/env node

/*jshint node:true */

// TODO: We should split this into a login-with-persona-and-create-couch-user
// and a create-database-per-couch-user module

// TODO: I think we probably need some way to specify an application prefix
// to use, if multiple applications use the same auth server their data
// will be messed up

"use strict";

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var url = require('url');

var _ = require('underscore');
var async = require('async');
var express = require('express');
var request = require('request');
var uuid = require('node-uuid');
var yaml = require('js-yaml');

var config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

var logger = require('./couch-persona-log.js');

function verifyAssert(assert, audience, callback) {
  logger.info('Verifying assertion');
  request({
    method: 'POST',
    uri: config.ASSERT_URL,
    auth: adminAuth,
    form: {
      assertion: assert,
      audience: audience
    }
  }, function(err, res, body) {
    if (err || body.status == "failure") {
      callback({status: 400, json: {error: 'error_veryfying_assertion'}});
    } else {
      callback(err, body);
    }
  });
}

function ensureUser(body, callback) {
  logger.info('Ensuring', body.email, 'user exists');
  var email = body.email;
  var userDoc = createUserDoc(email);
  var userDocUri = url.format(db) + '_users/' + userDoc._id;
  request({
    method: 'GET',
    uri: userDocUri,
    auth: adminAuth,
  }, function(err, res, body) {
    if (err) {
      callback({status: 400, json: {error: 'error_retrieving_user'}});
    } else {
      if (res.statusCode === 200) {
        // Copy over any existing attributes (including _rev so we can update it)
        userDoc = _.extend(body, userDoc);
      } else {
        userDoc.password = uuid.v1();
        userDoc.thepassword = userDoc.password;
        logger.info('User', body.email, 'doesn\'t exist, creating ...');
      }
      request({
        method: 'PUT',
        json: userDoc,
        auth: adminAuth,
        uri: userDocUri
      }, function(err, res, body) {
        if (!err) {
          callback(null, userDoc);
        } else {
          callback({status: 400, json: {error: 'error_creating_user'}});
        }
      });
    }
  });
}

function verifyApp(appKey, userDoc, callback) {
  logger.info('Verifying application, key:' + appKey);
  request({
    method: 'GET',
    uri: url.format(db) + config.APP_DB + '/' + appKey,
    auth: adminAuth
  }, function(err, res, body) {
    if (err || res.statusCode != 200) {
      callback({status: 400, json: {error: 'error_verifying_app'}});
    } else {
      // Email addresses arent valid database names, so just hash them
      var emailHash = crypto.createHash('md5').update(userDoc.name).digest("hex");
      userDoc.currentDb = config.DB_PREFIX + body.dev + '_' +
          body.name + '_' + emailHash;
      callback(null, userDoc);
    }
  });
}

function ensureDatabase(userDoc, callback) {
  logger.info('Ensuring', userDoc.currentDb, 'exists');
  request({
    method: 'PUT',
    auth: adminAuth,
    uri: url.format(db) + userDoc.currentDb
  }, function(err, res, body) {
    if (!err && (res.statusCode === 201 || res.statusCode === 412)) {
      callback(null, userDoc);
    } else {
      callback({status: 400, json: {error: 'error_creating_database'}});
    }
  });
}

function ensureUserSecurity(userDoc, callback) {
  logger.info('Ensuring', userDoc.name, 'only can write to', userDoc.currentDb);
  var securityDoc = {
    admins: {names:[], roles: []},
    readers: {names: [userDoc.name], roles: []}
  };
  request({
    method: 'PUT',
    json: securityDoc,
    auth: adminAuth,
    uri: url.format(db) + userDoc.currentDb + '/_security'
  }, function(err, res, body) {
    if (!err) {
      callback(null, userDoc);
    } else {
      callback({status: 400, json: {error: 'error_securing_database'}});
    }
  });

}

function createSessionToken(userDoc, callback) {
  logger.info('Creating session');
  request({
    method: 'POST',
    uri: url.format(db) + '_session',
    form: {
      name: userDoc.name,
      password: userDoc.thepassword
    }
  }, function(err, res, body) {
    if (res.statusCode === 200) {
      var cookies = parseCookie(res.headers['set-cookie'][0]);
      userDoc.authToken = 'AuthSession=' + cookies.AuthSession + '; Path=/db; HttpOnly';
      callback(null, userDoc);
    } else {
      callback({status: 400, json: {error: 'error_creating_session'}});
    }
  });
}

function parseCookie(str) {
  var cookies = {};
  str.split(';').forEach(function(cookie) {
    var parts = cookie.split('=');
    cookies[parts[0].trim()] = (parts[1] || '').trim();
  });
  return cookies;
}

function sendJSON(client, status, content, hdrs) {
  var headers = _.extend({'Content-Type': 'application/json'}, hdrs);
  client.writeHead(status, headers);
  client.write(JSON.stringify(content));
  client.end();
}

function createUserDoc(email) {
  return {
    _id: 'org.couchdb.user:' + encodeURIComponent(email),
    type: 'user',
    name: email,
    roles: ['browserid'],
    browserid: true,
  };
}

function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
};

// TODO: We should verify that we have a running CouchDB instance, and probably
// also test for CORS being enabled and warn if not

if (!process.env.DB_USER || !process.env.DB_PASS) {
  // TODO: Ensure we are in admin party or fail nicely
  console.log('You are not in admin party');
  process.exit(1);
} else {
  request = request.defaults({json: true});
}

var db = url.parse(process.env.DB_URL);
var port = process.env.PORT || 5000;
var host = url.parse(process.env.HOST_URL || 'http://127.0.0.1:' + port);

var adminAuth = {
  user: process.env.DB_USER,
  pass: process.env.DB_PASS
};

var app = express();

app.configure(function() {

  app.use(allowCrossDomain);
  app.use(express.cookieParser());

  app.use('/db/', function(req, res) {
    var erl = url.format(db) + req.url.substring(1);
    req.pipe(request(erl)).pipe(res);
  });

  app.use(express.urlencoded());
  app.use(express.json());
});

app.post('/persona/sign-in', function(req, res) {
  async.waterfall([
    verifyAssert.bind(this, req.body.assert, req.headers.origin),
    ensureUser,
    verifyApp.bind(this, req.body.appkey),
    ensureDatabase,
    ensureUserSecurity,
    createSessionToken
  ], function (err, userDoc) {
    if (err) {
      logger.error('Error during sign-in: ', err);
      sendJSON(res, err.status, err.json);
    } else {
      logger.info('Successful sign-in');
      sendJSON(res, 200, {
        ok: true,
        db: url.format(host) + 'db/' + userDoc.currentDb,
        name: userDoc.name
      }, {'Set-Cookie': userDoc.authToken});
    }
  });
});

app.post('/persona/sign-out', function(req, res) {
  // TODO: We should probably try and kill the session or something
  // but right now we dont know anything about it (since the authToken
  // is stored locally and not sent as a cookie)
  sendJSON(res, 400, {
    ok: true
  });
});

app.listen(port);
