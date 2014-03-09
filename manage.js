#!/usr/bin/env node

/*jshint node:true */

"use strict";

var fs = require('fs');

var async = require('async');
var commander = require('commander');
var request = require('request');
var url = require('url');
var yaml = require('js-yaml');

var config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

function createAppDatabase(callback) {
  process.stdout.write('Creating app database...');
  request({
    method: 'PUT',
    uri: url.format(db) + config.APP_DB,
    auth: adminAuth
  }, function(err, res, body) {
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

commander
  .version('0.0.1')
  .option('--username <value>', 'CouchDB admin username')
  .option('--password <value>', 'CouchDB admin password')
  .option('--configure', 'configure a clean install of couch-persona')
  .option('--register_app <name>', 'register a new app')
  .option('--type <type>', 'app type')
  .option('--desc <desc>', 'app description')
  .option('--unregister_app <name>', 'unregister app')
  .parse(process.argv);

if (!commander.username || !commander.password) {
  console.log('username and password are required');
  commander.help();
}

var db = url.parse(config.DB_URL);
var adminAuth = {user: commander.username, pass: commander.password};

if (commander.configure) {
  async.waterfall([
    createAppDatabase
  ], function (err) {
    if (err) {
      console.log('ERROR');
    }
    process.exit(0);
  });
}

if (commander.register_app) {
  if (commander.type === undefined) {
    console.log('App type is required');
    commander.help();
  }
  var name = commander.register_app;
  var type = commander.type;
  var description = commander.desc || '';
  var appUrl = url.format(db) + config.APP_DB + '/' + name;

  process.stdout.write('Registering app...');
  request({
    method: 'GET',
    uri: appUrl,
    auth: adminAuth,
  }, function (err, res, body) {
    if (err || (res.statusCode !== 200 && res.statusCode !== 404)) {
      console.log('ERROR');
      process.exit(0);
    } else if (res.statusCode === 200) {
      console.log('already registered');
      process.exit(0);
    } else {
      request({
        method: 'PUT',
        uri: appUrl,
        auth: adminAuth,
        json: {
          _id: name,
          type: type,
          description: description
        }
      }, function(err, res, body) {
        if (err) {
          console.log('ERROR');
        } else {
          console.log('OK');
        }
        process.exit(0);
      });
    }
  });
}

if (commander.unregister_app) {
  process.stdout.write('Unregistering app...');
  var appUrl = url.format(db) + config.APP_DB + '/' + commander.unregister_app;

  request({
    method: 'GET',
    uri: appUrl,
    auth: adminAuth,
    json: true
  }, function (err, res, body) {
    if (err || res.statusCode !== 200) {
      console.log('ERROR');
      process.exit(0);
    } else {
      request({
        method: 'DELETE',
        uri: appUrl + '?rev=' + body._rev,
        auth: adminAuth,
      }, function(err, res, body) {
        if (err) {
          console.log('ERROR');
        } else {
          console.log('OK');
        }
        process.exit(0);
      });
    }
  });
}
