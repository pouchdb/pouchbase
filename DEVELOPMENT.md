# Developing pouch.host

## Install

```
$ npm install
$ export DEBUG=janus
$ export EMAIL_ADDRESS={from_address}
$ export EMAIL_PASSWORD={from_password}
$ export EMAIL_SMTP={smtp_server}
$ npm run dev
```

If you set set `DEBUG`, the login token will be added to the console output, so
the SMTP settings then are technically optional...unless you're testing them.
:grinning:

*Note:* If testing on `localhost` you MAY need to change the generated validate
URL to use `localhost` rather than `127.0.0.1`. They aren't quite the same to
the validation system.
