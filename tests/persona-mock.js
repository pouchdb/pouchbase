#!/usr/bin/env node

"use strict";

var _ = require('underscore');
var express = require('express');
var bodyParser = require('body-parser');
var users = require('./users.json');

var app = express();

function sendJSON(client, status, content, hdrs) {
  var headers = _.extend({'Content-Type': 'application/json'}, hdrs);
  client.writeHead(status, headers);
  client.write(JSON.stringify(content));
  client.end();
}

app.use(bodyParser.urlencoded());

app.post('/verify', function (req, res) {

  var assert = req.body.assertion;
  if (assert in users) {
    sendJSON(res, 200, users[assert]);
  } else {
    sendJSON(res, 200, { status: "failure", reason: "Assert does not match" });
  }
});

app.listen(5555);

module.exports.app = app;
