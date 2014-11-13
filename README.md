pouch.host
=====

pouch.host is a service that lets your PouchDB applications easily provide login
and online sync functionality.

When users of your application want to login, they provide an email address and
your app notifies the pouch.host service of that email. pouch.host will generate
a token for that user and send it to their email address.

When the user clicks the token, they will be authenticated with pouch.host and sent
back to your application, pouch.host will create a database that that user alone
can access, your PouchDB application can then sync with that database so
whenever the user logs in to your application, their data is automatically
kept in sync.


pouch.host Getting Started
---------------------

The first step is to have a PouchDB application, you can visit
http://pouchdb.com/getting-started.html for help getting started with PouchDB

Download https://pouch.host/pouch.host.js and
add it to your web application

```
<script src="https://pouch.host/pouch.host.js'></script>
```

When the user wants to login, call PouchHost.login

```
loginButton.addEventListener('click', function() {
  PouchHost.login({
    email: emailField.value
  });
}
```

The user will then be sent an email, when they click on the url they will be
authenticated and sent back to your application with a valid session, so check
for a valid session when your web application loads

```
var db = .... // Instiated elsewhere
var sync;

PouchHost.session().then(function (result) {
   if (result.ok) {
     // We have a valid session, sync!
     sync = db.sync(result.db, {live: true});
   }
});
```

And your application should now keep your users data in sync wherever they
login.

PouchHost API
---------

The PouchHost API is a simple JSON api served from https://pouch.host/, if you
dont want to use the provided JS client, then you can call it directly.

# POST /login/

##### Example Body:

```
{
  "email": "myemail@example.org"
}
```

Send a login request, the body of the request is JSON document, the `email` property
is required, you can provide any extra fields you desire and they will be accessible
via the session API

# GET /session/

This will return JSON that indicates if the current user has a valid session, if
they do any extra data provided to the `POST /login/` or `POST /session/` API will
be included in the response

##### Example Response:

```
{
  "ok": true,
  "user": "myemail@example.org"
  "db": "https://pouch.host/db/"
}
```

##### Failed Response:

```
{
  "error": true,
  "reason": "unauthorized"
}
```

# POST /session/

If a user has a valid session, you can post a JSON object to it and it will be
stored for future access

# POST /logout/

Deletes a current users session

# REQUEST /db/

If the user has a current valid session, they will be provided a database in which
to sync data to, requests to /db/* will be forwarded to a PouchDB (CouchDB) instance
that only the current user can access

<style>
  body {
    font-family: "Open Sans",Helvetica,Arial,sans-serif;
    font-size: 14px;
    line-height: 1.42857;
    color: #555;
    background-color: #F6F6F6;
    width: 800px;
    margin: 0 auto;
  }
  pre {
    background: white;
    display: block;
    padding: 10px;
    border: 1px solid #CCC;
  }
</style>
