"use strict";

var request = require('supertest');
var persona = require('./persona-mock.js').app; // jshint unused: false

describe('Test Janus', function () {

  var janus = null;
  var loginUrl = '/login/';

  before(function (done) {
    require('../lib/janus.js').init(function (app) {
      janus = app;
      done();
    });
  });

  it('incorrect assertion', function (done) {
    request(janus)
      .post(loginUrl)
      .send({assert: 'incorrect'})
      .expect(400)
      .expect({error: 'error_verifying_assertion'}, done);
  });

  it('incorrect app', function (done) {
    request(janus)
      .post(loginUrl)
      .send({assert: 'test1'})
      .expect(400)
      .expect({error: 'error_verifying_app'}, done);
  });
});
