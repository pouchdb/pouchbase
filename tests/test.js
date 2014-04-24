"use strict";

var request = require('supertest');
var persona = require('./persona-mock.js').app; // jshint unused: false

describe('Test Janus', function () {

  var janus = null;

  before(function (done) {
    require('../lib/janus.js').init(function (app) {
      janus = app;
      done();
    });
  });

  it('incorrect assertion', function (done) {
    request(janus)
      .post('/login/')
      .send({assert: 'incorrect'})
      .expect(400, done);
  });
});
