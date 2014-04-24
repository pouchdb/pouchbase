#!/bin/bash

export ASSERT_URL='http://localhost:5555/verify'

./node_modules/mocha/bin/mocha tests/test*.js
