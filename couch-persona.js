#!/usr/bin/env node

/*jshint node:true */

// TODO: We should split this into a login-with-persona-and-create-couch-user
// and a create-database-per-couch-user module

// TODO: I think we probably need some way to specify an application prefix
// to use, if multiple applications use the same auth server their data
// will be messed up

"use strict";

var ASSERT_URL = 'https://verifier.login.persona.org/verify';
var DB_PREFIX = 'couch_persona_';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var _ = require('underscore');
var async = require('async');
var commander = require('commander');
var express = require('express');
var request = require('request');
var uuid = require('node-uuid');

var logger = require('./couch-persona-log.js');

function verifyAssert(assert, audience, callback) {
  logger.info('Verifying assertion');
  request({
    method: 'POST',
    json: true,
    uri: ASSERT_URL,
    form: {
      assertion: assert,
      audience: audience
    }
  }, callback);
}

function ensureUser(err, body, callback) {
  logger.info('Ensuring', body.email, 'user exists');
  var email = body.email;
  var userDoc = createUserDoc(email);
  var userDocUri = commander.host + '/_users/' + userDoc._id;
  request({
    method: 'GET',
    uri: userDocUri
  }, function(err, res, body) {
    if (res.statusCode === 200) {
      // Copy over any existing attributes (including _rev so we can update it)
      userDoc = _.extend(body, userDoc);
    } else {
      logger.info('User', body.email, 'doesnt exist, creating ...');
    }
    request({
      method: 'PUT',
      json: userDoc,
      uri: userDocUri
    }, function(err, res, body) {
      callback(null, userDoc);
    });
  });
}

function ensureDatabase(userDoc, callback) {
  logger.info('Ensuring', userDoc.db, 'exists');
  request({
    method: 'PUT',
    json: true,
    uri: userDoc.db
  }, function(err, res, body) {
    if (!err && (res.statusCode === 201 || res.statusCode === 412)) {
      callback(null, userDoc);
    } else {
      callback({status: 400, json: {error: 'error_creating_database'}});
    }
  });
}

function ensureUserSecurity(userDoc, callback) {
  logger.info('Ensuring', userDoc.name, 'only can write to', userDoc.db);
  var securityDoc = {
    admins: {names:[], roles: []},
    readers: {names: [userDoc.name], roles: []}
  };
  request({
    method: 'PUT',
    json: securityDoc,
    uri: userDoc.db + '/_security'
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
    uri: commander.host + '/_session',
    form: {
      name: userDoc.name,
      password: userDoc.password
    }
  }, function(err, res, body) {
    if (res.statusCode === 200) {
      var cookies = parseCookie(res.headers['set-cookie'][0]);
      userDoc.authToken = 'AuthSession=' + cookies.AuthSession;
      callback(null, userDoc);
    } else {

      callback({error: 'screwed'});
    }
  });
}

function parseCookie(str) {
  var cookies = {};
  str.split(';').forEach(function(cookie) {
    console.log('cookie', cookie);
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
  // Email addresses arent valid database names, so just hash them
  var dbName = DB_PREFIX + crypto.createHash('md5').update(email).digest("hex");
  return {
    _id: 'org.couchdb.user:' + encodeURIComponent(email),
    type: 'user',
    name: email,
    roles: ['browserid'],
    browserid: true,
    db: commander.host + '/' + dbName,
    // We generate a random password every time a user logs in to give
    // them a valid session token
    password: 'test'//uuid.v1()
  };
}

var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};

var app = express();
app.use(express.bodyParser());
app.use(allowCrossDomain);

app.post('/persona/sign-in', function(req, res) {
  async.waterfall([
    verifyAssert.bind(this, req.body.assert, req.headers.origin),
    ensureUser,
    ensureDatabase,
    ensureUserSecurity,
    createSessionToken
  ], function (err, userDoc) {
    if (err) {
      sendJSON(res, err.status, err.json);
    } else {
      sendJSON(res, 200, {
        ok: true,
        dbUrl: userDoc.db,
        authToken: userDoc.authToken
      });
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

commander
  .version('0.0.1')
  .option('-h, --host [value]', 'CouchDB host (for example http://127.0.0.1:5984)')
  .option('-u, --username [value]', 'CouchDB admin username')
  .option('-p, --password [value]', 'CouchDB admin password')
  .option('-P, --port <n>', 'Port number to run couch-persona on', parseInt)
  .parse(process.argv);

if (!commander.host) {
  console.log('The host argument is required');
  commander.help();
  process.exit(1);
}

// TODO: We should verify that we have a running CouchDB instance, and probably
// also test for CORS being enabled and warn if not

if (!commander.username || !commander.password) {
  // TODO: Ensure we are in admin party or fail nicely
  // remember to request = request.defaults({json: true});
  console.log('You are not in admin party');
  process.exit(1);
} else {
  request = request.defaults({
    json: true,
    auth: {
      username: commander.username,
      password: commander.password
    }
  });
}

app.listen(commander.port || 3000);
