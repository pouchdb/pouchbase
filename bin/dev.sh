#!/bin/bash

./node_modules/.bin/watchify www/js/janus.js -s Janus -o www/js/janus-client.js &
./node_modules/.bin/nodemon ./lib/janus.js
