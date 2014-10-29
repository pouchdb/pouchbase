'use strict';

var Promise = global.Promise || require('bluebird');
var request = require('request').defaults({
  json: true
});

var defaultOptions = {
  server: 'http://janus.pouchdb.com/'
};

var Janus = function(host) {
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

Janus.prototype.options = function (key, val) {
  this.opts[key] = val;
};

Janus.prototype.login = function (data) {
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

Janus.prototype.session = function (data) {
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

Janus.prototype.logout = function() {
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
Janus.prototype.fetchRequest = function() {
  return this.r;
};

Janus.prototype.validateToken = function(url) {
  return new Promise(function(resolve) {
    this.r({method: 'GET', url: url}, resolve);
  }.bind(this));
};

module.exports = Janus;
