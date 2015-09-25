'use strict';

var Promise = global.Promise || require('lie');
var request = require('request').defaults({
  withCredentials: true,
  json: true
});

var defaultOptions = {
  server: 'https://pouchbase.com/'
};

var PouchBase = function(host) {
  // Save a custom jar per session
  // for testing multiple users in node
  if (!process.browser) {
    this.jar = request.jar();
    this.r = request.defaults({
      headers: {origin: host},
      jar: this.jar
    });
  } else {
    this.r = request;
  }
  this.opts = defaultOptions;
};

PouchBase.prototype.options = function (key, val) {
  this.opts[key] = val;
};

PouchBase.prototype.login = function (data) {
  return new Promise(function(resolve) {
    this.r({
      method: 'POST',
      url: this.opts.server + 'login/',
      json: data
    }, function(err, response, body) {
      resolve(body);
    });
  }.bind(this));
};

PouchBase.prototype.session = function (data) {
  return new Promise(function(resolve) {
    var opts = {
      method: !data ? 'GET' : 'POST',
      url: this.opts.server + 'session/'
    };
    if (data) {
      opts.json = data;
    }
    this.r(opts, function(err, response, body) {
      resolve(body);
    });
  }.bind(this));
};

PouchBase.prototype.logout = function() {
  return new Promise(function(resolve) {
    this.r({
      method: 'POST',
      url: this.opts.server + 'logout/'
    }, function(err, response, body) {
      resolve(body);
    });
  }.bind(this));
};

// Used for testing
PouchBase.prototype.fetchRequest = function() {
  return this.r;
};

PouchBase.prototype.validateToken = function(url) {
  return new Promise(function(resolve) {
    this.r({method: 'GET', url: url}, resolve);
  }.bind(this));
};

module.exports = PouchBase;
