#!/usr/bin/env node

"use strict";

var crypto = require('crypto');
var fs = require('fs');
var url = require('url');

var async = require('async');
var commander = require('commander');
var yaml = require('js-yaml');
var uuid = require('node-uuid');
var request = require('request');

// Name of db that will be used to store valid app names
var APP_DB = 'apps';

// Name of db that will be used to store developers
var DEV_DB = 'developers';

function createDatabase(dbName, callback) {
  process.stdout.write('Creating ' + dbName + ' database...');
  request({
    method: 'PUT',
    uri: url.format(db) + dbName,
    auth: adminAuth
  }, function (err, res, body) {
    if (err || (res.statusCode !== 201 && res.statusCode !== 412)) {
      callback(true);
    } else {
      if (res.statusCode === 201) {
        console.log('OK');
      } else if (res.statusCode === 412) {
        console.log('already exists');
      }
      callback(null);
    }
  });
}

function secureDatabase(dbName, callback) {
  process.stdout.write('Securing ' + dbName + ' database...');
  var securityDoc = {
    admins: {names: [], roles: []},
    readers: {names: [], roles: ["_admin"]}
  };
  request({
    method: 'PUT',
    uri: url.format(db) + dbName + '/_security',
    auth: adminAuth,
    json: securityDoc
  }, function (err, res, body) {
    if (err || res.statusCode !== 200) {
      callback(true);
    } else {
      console.log('OK');
      callback(null);
    }
  });
}

commander
  .version('0.0.1')
  .option('--username <value>', 'CouchDB admin username')
  .option('--password <value>', 'CouchDB admin password')
  .option('--dburl <value>', 'URL to CouchDB instance')
  .option('--configure', 'configure a clean install of couch-persona')
  .option('--add_dev', 'add a developer')
  .option('--register_app <name>', 'register a new app')
  .option('--app_dev <dev_id>', 'id of the owner of the app')
  .parse(process.argv);

if (!commander.username || !commander.password) {
  console.log('username and password are required');
  commander.help();
}

if (!commander.dburl) {
  console.log('database url required!');
  commander.help();
}

var db = url.parse(commander.dburl);
var adminAuth = {user: commander.username, pass: commander.password};

if (commander.configure) {
  async.waterfall([
    async.apply(createDatabase, APP_DB),
    async.apply(secureDatabase, APP_DB),
    async.apply(createDatabase, DEV_DB),
    async.apply(secureDatabase, DEV_DB),
  ], function (err) {
    if (err) {
      console.log('ERROR');
    }
    process.exit(0);
  });
}

if (commander.add_dev) {
  process.stdout.write('Adding developer...');
  var devId = crypto.createHash('md5').update(uuid.v1()).digest('hex');
  request({
    method: 'PUT',
    uri: db.format(db) + DEV_DB + '/' + devId,
    auth: adminAuth,
    json: {
      _id: devId,
    }
  }, function (err, res, body) {
    if (err || res.statusCode !== 201) {
      console.log('ERROR');
    } else {
      console.log('OK\ndev id: ' + devId);
    }
    process.exit(0);
  });
}

if (commander.register_app) {
  if (commander.app_dev === undefined) {
    console.log('Developer ID is required');
    commander.help();
  }
  var appName = commander.register_app;
  var appKey = crypto.createHash('md5').update(appName).update(uuid.v1())
      .digest('hex');

  process.stdout.write('Registering app...');

  request({
    method: 'PUT',
    uri: url.format(db) + APP_DB + '/' + appKey,
    auth: adminAuth,
    json: {
      _id: appKey,
      name: appName,
      dev: commander.app_dev
    }
  }, function (err, res, body) {
    if (err || res.statusCode !== 201) {
      console.log('ERROR');
    } else {
      console.log('OK\napp key: ' + appKey);
    }
    process.exit(0);
  });
}
