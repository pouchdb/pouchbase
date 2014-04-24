Janus
==================================================

A Node.js application + service that authenticates users and provisions instances of [Apache CouchDB](http://couchdb.apache.org/) for developers using PouchDB to build their applications.

Installation
----------

Janus requires a CouchDB host running, preferably with CORS support enabled.

Install and start your server

```bash
$ cd src/janus
$ DB_URL=http://username:pass@127.0.0.1:5984 npm run janus
````
