# An example implementation
To update the code,
```
$ yarn upgrade @cmsgov/qpp-shared-logger-node
```

## Basic logger - winston

```
$ NODE_ENV=development node src/index.js
```

All configuration of the shared logger is done in `log.js`. In a larger project,
add `const log = require('./log');` in any file where you want to send log messages.

Note that winston stdout log output is **not** in json format. Send logs to a file to see JSON.

## Access logger - morgan
The access logger is simple http middleware.

### node http

```
$ NODE_ENV=development node src/http.js
$ curl "http://localhost:8080/"
```


### Express
It can be easily introduced to your middleware chain:

```
var app = express();
app.use(logger.accessLogger);
```
