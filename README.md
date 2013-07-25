couch-persona
==================================================

A Node.js server that integrated [Mozilla Persona](https://login.persona.org/) logins with [Apache CouchDB](http://couchdb.apache.org/), once a user has successfully authenticated with persona we create a user and a database for their use only, on a successful login this script will return the url to a couchdb database and a token used to authenticate against that instance.

Installation
----------

couch-persona requires a CouchDB host running, preferably with CORS support enabled.

Install and start your server

```bash
$ npm install couch-persona
$ npm start couch-persona --host=http://127.0.0.1:5984 --username=john --password=doe
````

Follow the [Quick Setup instructions](https://developer.mozilla.org/en-US/docs/Mozilla/Persona/Quick_Setup) on the MDN wiki to install the persona client on your site, ensure you use the correct urls to sign in and out (`/persona/sign-in` + `/persona/sign-out`). Here is some example working code:

```javascript
// Host that the couch-persona server is running on
var authHost = 'http://127.0.0.1:3000';

var loggedIn = function(result) { 
  console.log('logged in:', result);
  // result.dbUrl is the location of your CouchDB Instance
  // result.authToken is the token you need to be able to write to it, 
  // use xhr.setRequestHeader("Cookie", result.authToken);
};

var loggedOut = function() { 
  console.log('logged out!');
};
  
function simpleXhrSentinel(xhr) {
  return function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        var result = {};
        try { 
          result = JSON.parse(xhr.responseText);
        } catch(e) {}
        loggedIn(result);
      } else {
        loggedOut();
        navigator.id.logout();
      } 
    } 
  };
}

function verifyAssertion(assertion) {
  var xhr = new XMLHttpRequest();
  var param = 'assert=' + assertion;
  xhr.open('POST', authHost + '/persona/sign-in', true);
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Content-length", param.length);
  xhr.setRequestHeader("Connection", "close");
  xhr.send(param);
  xhr.onreadystatechange = simpleXhrSentinel(xhr); 
}

function signoutUser() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", authHost + '/persona/sign-out', true);
  xhr.send(null);
  xhr.onreadystatechange = simpleXhrSentinel(xhr); 
}

navigator.id.watch({
  onlogin: verifyAssertion,
  onlogout: signoutUser 
});

var signinLink = document.getElementById('signin');
var signoutLink = document.getElementById('signout');
signinLink.onclick = function() { navigator.id.request(); };
signoutLink.onclick = function() { navigator.id.logout(); };
```
