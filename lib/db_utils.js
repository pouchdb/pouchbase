"use strict";

var url = require('url');
var _ = require('underscore');
var request = require('request').defaults({json: true});

function parseCookie(str) {
  var cookies = {};
  str.split(';').forEach(function (cookie) {
    var parts = cookie.split('=');
    cookies[parts[0].trim()] = (parts[1] || '').trim();
  });
  return cookies;
}

module.exports = function Database(databaseConfig, afterInit) {

  this.dbConf = databaseConfig;

  this.createDatabase = function (dbName, options, callback) {
    var reqJSON = {
      method: 'PUT',
      uri: url.format(this.dbConf.db) + dbName,
    };
    reqJSON = _.extend(options, reqJSON);
    request(reqJSON, function (err, res, body) {
      if (!err && (res.statusCode === 201 || res.statusCode === 412)) {
        callback(null);
      } else {
        callback(true);
      }
    });
  };

  this.putDocument = function (dbName, docId, doc, options, callback) {
    var reqJSON = {
      method: 'PUT',
      uri: url.format(this.dbConf.db) + dbName + '/' + docId,
      json: doc
    };
    reqJSON = _.extend(options, reqJSON);
    request(reqJSON, function (err, res, body) {
      if (!err && (res.statusCode === 200 || res.statusCode === 201)) {
        callback(null);
      } else {
        callback(true);
      }
    });
  };

  this.getDocument = function (dbName, docId, options, callback) {
    var reqJSON = {
      method: 'GET',
      uri: url.format(this.dbConf.db) + dbName + '/' + docId,
    };
    reqJSON = _.extend(options, reqJSON);
    request(reqJSON, function (err, res, body) {
      if (!err && (res.statusCode === 200 || res.statusCode === 404)) {
        if (res.statusCode === 200) {
          callback(null, body);
        } else {
          callback(null, null);
        }
      } else {
        callback(true);
      }
    });
  };

  this.secureDatabase = function (dbName, name, options, callback) {
    var securityDoc = {
      admins: {names: [], roles: []},
      readers: {names: [name], roles: []}
    };
    this.putDocument(dbName, '_security', securityDoc, options, callback);
  };

  this.createSession = function (username, password, callback) {
    request({
      method: 'POST',
      uri: url.format(this.dbConf.db) + '_session',
      form: {
        name: username,
        password: password
      }
    }, function (err, res, body) {
      if (res.statusCode === 200) {
        var cookies = parseCookie(res.headers['set-cookie'][0]);
        callback(null, cookies.authSession);
      } else {
        callback(true);
      }
    });
  };

  // Check DB connection and admin permissions
  request({
    method: 'GET',
    uri: url.format(this.dbConf.db) + '_session',
    auth: this.dbConf.adminAuth
  }, function (err, res, body) {
    if (err || res.statusCode !== 200) {
      console.log('Error connecting to database');
      process.exit(1);
    } else if (!body.ok || body.userCtx.roles.indexOf('_admin') === -1) {
      console.log('Admin login data is incorrect or you ' +
                  'are not in admin party');
      process.exit(1);
    } else {
      afterInit();
    }
  });
};
