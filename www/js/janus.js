
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

  console.log(params);
  xhr.send(params);

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
}

function personaLogin(assertion) {
  request({
    method: 'POST',
    url: '/login/',
    params: {
      key: this.key,
      assertion: assertion
    }
  }, function(xhr) {
    //console.log(arguments);
  });
}

function personaLogout() {
  this.trigger('logout');
}

function Janus(key) {
  EE.call(this);

  this.key = key;

  if (navigator.id) {
    navigator.id.watch({
      onlogin: personaLogin.bind(this),
      onlogout: personaLogout.bind(this)
    });
  }
}

Janus.prototype.login = function() {
  navigator.id.request();
}

module.exports = Janus;
