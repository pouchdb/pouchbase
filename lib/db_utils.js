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
      if (!err && res.statusCode === 201) {
        callback(null);
      } else {
        callback(err || res.statusCode);
      }
    });
  };

  this.deleteDatabase = function (dbName, options, callback) {
    var reqJSON = {
      method: 'DELETE',
      uri: url.format(this.dbConf.db) + dbName,
    };
    reqJSON = _.extend(options, reqJSON);
    request(reqJSON, function (err, res, body) {
      if (!err && res.statusCode === 200) {
        callback(null);
      } else {
        callback(err || res.statusCode);
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
      if (!err && res.statusCode === 201) {
        callback(null);
      } else {
        callback(err || res.statusCode);
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
        callback(err || res.statusCode);
      }
    });
  };

  this.deleteDocument = function (dbName, docId, options, callback) {
    var reqJSON = {
      method: 'HEAD',
      uri: url.format(this.dbConf.db) + dbName + '/' + docId,
    };
    reqJSON = _.extend(options, reqJSON);
    request(reqJSON, function (err, res, body) {
      var update = {
        method: 'DELETE',
        qs: {rev: res.headers.etag.replace(/"/g, '')}
      };
      reqJSON = _.extend(reqJSON, update);
      request(reqJSON, function (err, res, body) {
        if (!err && res.statusCode === 200) {
          callback(null);
        } else {
          callback(err || res.statusCode);
        }
      });
    });
  };

  this.secureDatabase = function (dbName, name, options, callback) {
    var securityDoc = {
      admins: {names: [], roles: []},
      readers: {names: [name], roles: []}
    };
    this.putDocument(dbName, '_security', securityDoc, options, function (err) {
      if (err === 200) {
        callback(null);
      } else {
        callback(err);
      }
    });
  };

  this.createCouchSession = function (username, password, callback) {
    request({
      method: 'POST',
      uri: url.format(this.dbConf.db) + '_session',
      form: {
        name: username,
        password: password
      }
    }, function (err, res, body) {
      if (!err && res.statusCode === 200) {
        var cookies = parseCookie(res.headers['set-cookie'][0]);
        callback(null, cookies.AuthSession);
      } else {
        callback(err || res.statusCode);
      }
    });
  };

  this.checkCouchSession = function (sessionKey, callback) {
    request({
      method: 'GET',
      uri: url.format(this.dbConf.db) + '_session'
    }, function (err, res, body) {
      if (!err && res.statusCode === 200) {
        callback(null, true);
      } else {
        callback(err, false);
      }
    });
  };

  this.deleteCouchSession = function (sessionKey, callback) {
    request({
      method: 'DELETE',
      uri: url.format(this.dbConf.db) + '_session',
      headers: {
        Cookie: 'AuthSession=' + sessionKey
      }
    }, function (err, res, body) {
      if (!err && res.statusCode === 200) {
        callback(null);
      } else {
        callback(err || res.statusCode);
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
