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
