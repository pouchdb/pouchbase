'use strict';

var janusServer = require('../lib/janus.js');
var janusClient = require('../lib/client/janus.js');

var should = require('chai').should();

describe('Test Basic Janus Functionality', function () {

  var server;

  before(function (done) {
    janusServer.init(function (_server) {
      server = _server;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  it('Basic login', function (done) {
    janusClient.login({
      email: 'dale@arandomurl.com'
    }).then(function(result) {
      // Send a login request
      result.ok.should.equal(true);
      return janusClient.user();
    }).then(function(user) {
      // We have only sent a login request, still not authenticated
      user.ok.should.equal(false);
    }).then(done);
  });

});
