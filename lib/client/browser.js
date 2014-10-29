'use strict';

// The Janus client is instantiatable so we can test with multiple
// clients representing seperate browser sessions, the packaged
// client doesnt need to be though
var Janus = require('./janus.js');
module.exports = new Janus();
