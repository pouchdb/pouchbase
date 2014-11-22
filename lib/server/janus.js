'use strict';

var Promise = require('bluebird');
var uuid = require('node-uuid');
var email = require('emailjs');
var bcrypt = require('bcrypt');
var debug = require('debug')('janus');

var DB_NAME = 'token-storage';

var smtp = email.server.connect({
  user: process.env.EMAIL_ADDRESS,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_SMTP,
  ssl: true
});

function activeTokenId(user, host) {
  return 'active_tokens_' + encodeURIComponent(user) +
    '_' + encodeURIComponent(host);
}

function activeUserId(user, host) {
  return 'active_user_' + encodeURIComponent(user) +
    '_' + encodeURIComponent(host);
}

var Janus = function(host, PouchDB) {
  // memory store for tokens so the tests can fetch the
  // unencrypted token without going via email
  this.cachedTokens = {};

  // Host we are currently running on
  this.host = host;

  this.db = new PouchDB(DB_NAME)
};

Janus.prototype.sendToken = function(email, token, host, cb) {

  var url = this.tokenUrl(token, host, email);
  debug('Token url for' + email + ' is: ' + url);

  if (!process.env.EMAIL_ADDRESS ||
      !process.env.EMAIL_PASSWORD ||
      !process.env.EMAIL_SMTP) {
    cb();
    debug('Not sending email, no credentials');
    return;
  }

  var body = 'Hello!\nAccess your account here: ' + url;
  smtp.send({
    text: body,
    from: process.env.EMAIL_ADDRESS,
    to: email,
    subject: 'Login for ' + this.host
  }, function(err, message) {
    cb();
  });
};

Janus.prototype.tokenUrl = function(token, host, uid) {
  return this.host + 'validate/?token=' + token +
    '&uid=' + encodeURIComponent(uid) +
    '&host=' + encodeURIComponent(host);
};

Janus.prototype.login = function (details, origin) {
  return new Promise(function(resolve) {
    var token = uuid.v4();
    var email = details.email;
    debug('Attempting to login with ' + email);
    delete details.email;
    this.cachedTokens[email] = token;
    bcrypt.hash(token, 10, function (err, hashedToken) {
      var tokenDoc = {
        _id: activeTokenId(email, origin),
        email: email,
        hashedToken: hashedToken,
        origin: origin,
        details: details
      };
      this.sendToken(email, token, origin, function() {
        this.db.get(tokenDoc._id, function (err, doc) {
          if (doc) {
            tokenDoc._rev = doc._rev;
          }
          this.db.put(tokenDoc).then(function() {
            resolve({ok: true});
          });
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }.bind(this));
};

Janus.prototype.authenticate = function (user, origin, token) {
  debug('Authenticating ' + user);
  var db = this.db;
  return new Promise(function(resolve) {
    this.db.get(activeTokenId(user, origin)).then(function(tokenDoc) {
      bcrypt.compare(token, tokenDoc.hashedToken, function(err, res) {
        if (res) {
          db.get(activeUserId(user, origin), function(err, doc) {
            if (err) {
              doc = {_id: activeUserId(user, origin)};
            }
            for (var i in tokenDoc.details) {
              doc[i] = tokenDoc.details[i];
            }
            db.put(doc).then(function() {
              db.remove(tokenDoc).then(function() {
                debug('Authenticating ' + user + ' was successful');
                resolve({
                  ok: true,
                  origin: origin
                });
              });
            });
          });
        } else {
          resolve({error: true});
        }
      }.bind(this));
    }, function() {
      resolve({error: true});
    });
  }.bind(this));
};

Janus.prototype.readSession = function(user, host) {
  return new Promise(function(resolve) {
    this.db.get(activeUserId(user, host), function(err, doc) {
      doc = doc || {};
      delete doc._id;
      delete doc._rev;
      doc.ok = true;
      doc.user = user;
      doc.db = this.host + 'db/';
      resolve(doc);
    }.bind(this));
  }.bind(this));
};

Janus.prototype.writeSession = function(user, host, details) {
  return new Promise(function(resolve) {
    this.db.get(activeUserId(user, host), function(err, doc) {
      doc = doc || {_id: activeUserId(user, host)};
      for (var i in details) {
        if (i[0] !== '_') {
          doc[i] = details[i];
        }
      }
      this.db.put(doc, function(err, written) {
        resolve(doc);
      });
    }.bind(this));
  }.bind(this));
};

Janus.prototype.usersDbName = function(user, host) {
  return encodeURIComponent(user) + '_' + encodeURIComponent(host);
};

// Exposed for testing
Janus.prototype.fetchTokenUrl = function(user, host) {
  if (user in this.cachedTokens) {
    return this.tokenUrl(this.cachedTokens[user], host, user);
  }
  return false;
};

module.exports = Janus;
