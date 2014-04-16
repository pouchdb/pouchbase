Janus
==================================================

A Node.js application + service that authenticates users and provisions instances of [Apache CouchDB](http://couchdb.apache.org/) for developers using PouchDB to build their applications.

Installation
----------

Janus requires a CouchDB host running, preferably with CORS support enabled.

Install and start your server

```bash
$ cd src/janus
$ DB_URL=http://127.0.0.1:5984 DB_USER=john DB_PASS=doe npm run janus
````
