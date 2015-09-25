'use strict';

// The Janus client is instantiatable so we can test with multiple
// clients representing seperate browser sessions, the packaged
// client doesnt need to be though
var PouchBase = require('./pouchbase.js');
module.exports = new PouchBase();
