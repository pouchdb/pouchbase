'use strict';

var Promise = require('bluebird');
var expect = require('chai').expect;

var janusServer = require('../lib/server/server.js');
var JanusClient = require('../lib/client/janus.js');

var http = require('http');

function testServer(port) {
  return new Promise(function(resolve) {
    http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('Hello World\n');
    }).listen(port, resolve);
  });
}

describe('Test Basic Janus Functionality', function () {

  var host;
  var server;

  function serverStarted(_server, cb) {
    server = _server;
    host = 'http://127.0.0.1:' + server.address().port + '/';
    cb();
  }

  before(function (done) {
    Promise.all([testServer(3031), testServer(3032)]).then(function() {
      janusServer.init(function (server) {
        serverStarted(server, done);
      });
    });
  });

  after(function (done) {
    server.close(done);
  });


  it('Basic login flow', function (done) {
    var user = 'dale@arandomurl.com';
    var client = new JanusClient('http://127.0.0.1:3031/');
    var anonymous = new JanusClient('http://127.0.0.1:3032/');
    client.options('server', host);
    anonymous.options('server', host);

    // Send a login request
    return client.login({email: user}).then(function(result) {
      expect(result).to.have.property('ok').that.equals(true);

    }).then(function() {
      //Attempt to fetch unauthenticated session
      return client.session();
    }).then(function(session) {
      expect(session).to.have.property('error').that.equals(true);

      // Fetch the token validation url from the server and
      // use it to validate the client
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3031/');
      return client.validateToken(url);
    }).then(function() {

      // Ensure further requests are authenticated
      return client.session();
    }).then(function (session) {
      expect(session).to.have.property('ok').that.equals(true);

      // Anonymous user still shouldnt have a session
      return anonymous.session();
    }).then(function (session) {
      expect(session).to.have.property('error').that.equals(true);

      // Now log the client out
      return client.logout();
    }).then(function () {

      // The client should no longer have a valid session
      return client.session();
    }).then(function (session) {
      expect(session).to.have.property('error').that.equals(true);
    }).then(done).catch(done);
  });

  it('Login persist across server restart', function (done) {
    var user = 'dale@arandomurl.com';
    var client = new JanusClient('http://127.0.0.1:3031/');
    client.options('server', host);

    // Send a login request
    client.login({email: user}).then(function(result) {
      expect(result).to.have.property('ok').that.equals(true);

      // Fetch the token validation url from the server and
      // use it to validate the client
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3031/');
      return client.validateToken(url);
    }).then(function() {

      // Check we are logged in
      return client.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);

      // Stop the server
      return new Promise(server.close.bind(server));
    }).then(function() {

      // Restart the server
      return new Promise(function(resolve) {
        janusServer.init(function(server) {
          serverStarted(server, resolve);
        });
      });
    }).then(function() {

      // Check we are still logged in
      return client.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);
    }).then(done);
  });

  it('Users db access', function (done) {
    var user = 'dale@arandomurl.com';
    var client = new JanusClient('http://127.0.0.1:3031/');
    client.options('server', host);
    var dbUrl, r;

    client.login({email: user}).then(function() {
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3031/');
      return client.validateToken(url);
    }).then(function() {
      return client.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);
      dbUrl = session.db;
      r = client.fetchRequest();

      // Make a request against the database, authenticated
      // client should be allowed
      return new Promise(function(resolve) {
        r({method: 'PUT', url: dbUrl}, function(err, resp, body) {
          resolve(body);
        });
      });
    }).then(function(result) {
      expect(result).to.have.property('ok').that.equals(true);
      return client.logout();
    }).then(function() {

      // Make a request against the database, unauthenticated client
      // shouldnt
      return new Promise(function(resolve) {
        r({method: 'GET', url: dbUrl}, function(err, resp, body) {
          resolve(body);
        });
      });
    }).then(function(result) {
      expect(result).to.have.property('error').that.equals(true);
      expect(result).to.have.property('reason').that.equals('unauthorised');
    }).then(done);
  });

  it('The same user on different hosts dont share data', function(done) {

    var user = 'dale@arandomurl.com';
    var client1 = new JanusClient('http://127.0.0.1:3031/');
    var client2 = new JanusClient('http://127.0.0.1:3032/');
    client1.options('server', host);
    client2.options('server', host);

    var dbUrl, r;

    client1.login({email: user}).then(function(result) {
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3031/');
      return client1.validateToken(url);
    }).then(function() {
      return client1.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);
      dbUrl = session.db;
      r = client1.fetchRequest();

      // Ensure the db exists
      return new Promise(function(resolve) {
        r({method: 'PUT', url: dbUrl}, function() {
          r({method: 'PUT',
            url: dbUrl + 'randomDoc',
            json: {'foo': 'bar'}
          }, function (err, res, body) {
            resolve(body);
          });
        });
      });
    }).then(function(result) {
      expect(result).to.have.property('ok').that.equals(true);

      return client2.login({email: user});
    }).then(function() {
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3032/');
      return client2.validateToken(url);
    }).then(function() {
      return client2.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);
      dbUrl = session.db;
      r = client2.fetchRequest();

      return new Promise(function(resolve) {
        r({method: 'GET', url: dbUrl + 'randomDoc'}, function (err, res, body) {
          resolve(body);
        });
      });
    }).then(function(result) {
      expect(result).to.have.property('error');
    }).then(done).catch(done);
  });

  it('Store custom information for the user', function(done) {
    var user = 'dale@arandomurl.com';
    var client = new JanusClient('http://127.0.0.1:3031/');

    // Send a login request
    client.login({email: user, foo: 'bar'}).then(function(result) {
      expect(result).to.have.property('ok').that.equals(true);

      // Fetch the token validation url from the server and
      // use it to validate the client
      var url = janusServer.fetchTokenUrl(user, 'http://127.0.0.1:3031/');
      return client.validateToken(url);
    }).then(function() {

      // Check we are logged in and we receive custom data
      return client.session();
    }).then(function(session) {
      expect(session).to.have.property('ok').that.equals(true);
      expect(session).to.have.property('foo').that.equals('bar');

      // Write more custom data and overwrite existing
      return client.session({foo: 'baz', andmore: 'data'});
    }).then(function(session) {
      expect(session).to.have.property('foo').that.equals('baz');
      expect(session).to.have.property('andmore').that.equals('data');
    }).then(done).catch(done);
  });

});
