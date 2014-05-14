
'use strict';

var EE = require('events').EventEmitter;

function request(opts, callback) {

  var xhr = new XMLHttpRequest();
  if (typeof opts === 'string') {
    opts = {url: opts};
  }
  opts.headers = opts.headers || {};
  opts.params = opts.params || {};
  opts.complete = opts.complete || callback || function() {};

  if (opts.json) {
    opts.headers['Content-Type'] = 'application/json';
  }

  var params = Object.keys(opts.params).map(function(k) {
    return k + '=' + opts.params[k];
  }).join('&') || null;

  if (params) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.headers['Content-Length'] = params.length;
    opts.headers['Connection'] = 'close';
  }

  xhr.open(opts.method || 'GET', opts.url, true);
  Object.keys(opts.headers).forEach(function (key) {
    xhr.setRequestHeader(key, opts.headers[key]);
  });

  xhr.onreadystatechange = function() {
    var data = null;
    if (opts.json) {
      try {
        data = JSON.parse(xhr.responseText);
      } catch(e) {}
    }
    if (xhr.readyState === 4) {
      opts.complete(xhr.status, data, xhr);
    }
  };

  xhr.send(params);
}

function Janus(key) {
  EE.call(this);
  this.key = key;
}

Janus.prototype.signup = function(opts) {
}

Janus.prototype.login = function(opts) {
}

module.exports = Janus;
