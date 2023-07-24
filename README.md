# qpp-shared-logger-node ![Build](https://github.com/CMSgov/qpp-shared-logger-node/workflows/Build%20-%20PR/badge.svg) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=CMSgov_qpp-shared-logger-node&metric=alert_status)](https://sonarcloud.io/dashboard?id=CMSgov_qpp-shared-logger-node) [![npm version](https://badge.fury.io/js/qpp-shared-logger-node.svg)](https://badge.fury.io/js/qpp-shared-logger-node)
A simple configurable wrapper around the [winston](https://www.npmjs.com/package/winston) application logger and the [morgan](https://www.npmjs.com/package/morgan) http access logger.

This logger is opinionated. Configure it with a minimal set of options, and get Splunk-searchable, PII-scrubbed, and QPP-compliant logs with minimal effort.

## Installation
```
$ npm install qpp-shared-logger-node --save

```

## Usage
This module accepts configuration, sets up the logger, then yields a winston Logger object for you to use.

It is recommended that you set up your project with a `log.js` module that you can import from the rest of your project; `log.js` is where you will configure the shared logger and expose the winston Logger.

First, pass your configuration to the module, then
get access to the Logger object.

log.js:
```javascript
const sharedLogger = require('qpp-shared-logger-node');

sharedLogger.configure({
    projectSlug: 'my-app-name'
});

module.exports = sharedLogger.logger; // a winston Logger
```

In other parts of your code:
```javascript
const logger = require('log');

logger.info('fetching data', { id: object.id, sort: 'asc' });
```

### Logging with context fields
The `contextLogger` function returns a logger object that includes a set of
fields with each log message. The fields are merged with those passed to a
logging method.

For example, this can be used to log a request id in all entries related to a
single client request:

```javascript
req.logger = sharedLogger.contextLogger({ requestId: uuidv1(), url: req.url });
req.logger.info('started');
req.logger.error(message, { error: err });
```

Field values in the log call take priority over values in the context fields.

### Context Logging Defaults
There are defaults that should be added to the context of the beginning with each request if possible.

Attribute Name | Attribute Value | Description
--- | --- | ---
requestId | UUID | This is a unique ID that will allow for tracking events throughout the livetime of the request.  This can be populated either through [uuid](https://www.npmjs.com/package/uuid) or [express request id](https://www.npmjs.com/package/express-request-id) or some other preferred UUID generator method.
oktaId | string | This value should be pulled from the auth service if possible
applicationBuild or gitSHA | string | This should be the build id or the git SHA of the current running application

```javascript
const requestContext = {
  requestId: uuidv1(),
  oktaId: AuthService(), // The auth service should return the okta id.
  applicationBuild: process.env.BUILD_ID // what constant the application would be storing this information
}

req.logger = sharedLogger.contextLogger(requestContext);
```

## Configuration

Key | Description | Allowed Values
--- | --- | ---
projectSlug (**Required**) | The name of your app, to be included in the log metadata and the log file path. | any string

### Environment Defaults
This module will read `process.env.NODE_ENV` to determine your application's "environment", and configure these settings out-of-the-box:

Environment | Application log path | Log level
--- | --- | ---
development | _console_ | debug
test | `./app.log` | silly
production | `/var/log/qpp-service/{{ projectSlug }}/app.log` | info

Environment | Access log path | Format
--- | --- | ---
development | _console_ | dev
test | `./access.log` | combined
production | /var/log/qpp-service/{{ projectSlug }}/access.log | combined


### Advanced Application Log Configuration
You may override the defaults:

Key | Description | Allowed Values | Default
--- | --- | --- | ---
addlFormats | This key accepts an array of Winston compatible [logform formats](https://github.com/winstonjs/logform) that are then added to the logger. This allows you to provide formats for unique scenarios that are not covered by the default formats. | An array of logform formats. | []
format | Format logs should be written in. Default is `json` format. More on winston fromats can be found [https://www.npmjs.com/package/winston#formats](here). | `json`, `simple`, `prettyPrint`, `logstash` | `json`
environment | Override the "node environment" that your app is running in. Using the conventional values will automatically configure various log settings for you. Conventional values are `development`, `test`, and `production`. Deployed code should [run with `NODE_ENV=production`](https://github.com/i0natan/nodebestpractices/blob/master/sections/production/setnodeenv.md) | `process.env.NODE_ENV`
logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir | _built from environment_
logFilenamePrefix | The application log filename will be built from this prefix, by default it will be `app.YYYYMMDD.log` | any string | `app`
datePattern | A string representing the [moment.js date](http://momentjs.com/docs/#/displaying/format/) format to be used for rotating. The meta characters used in this string will dictate the frequency of the file rotation. For example, if your datePattern is simply 'HH' you will end up with 24 log files that are picked up and appended to every day. (default: 'YYYYMMDD') | any string containing a standard date pattern | `YYYYMMDD`
logFileExtension | The log file extension to use. | string | `log`
logLevel | All log messages at this level or higher will be logged. `none` effectively turns off logging. | `none`, `error`, `warn`, `info`, `verbose`, `debug`, `silly` | _chosen based on environment_
logTimestamps | Add timestamps to log entries | `true` or `false` | `true`
logColorize | If `true`, log messages will be sent colorized (most valuable when logging to the `console`) | `true` or `false` | `false`
redactKeys | An array of keys to scrub from the log metadata | an array of lowercase strings | ``['email', 'firstname', 'lastname', 'password', 'ptan', 'tin', 'userid', 'username']``
redactRegexes | An array of regular expressions representing string values to scrub | an array of regular expressions (string or `RegExp`) | ``[]``
maxDays | The maximum number of days to keep logs for. | A number, in days | 0 (No deletion)
rotationMaxsize | The max size the log file should reach before it is rotated. | a size, in bytes. For example, 1M = 1000000. Or 'none' to never rotate logs | 50000000 (50M)
splunkSettings | Adding the Splunk configuration settings will add Splunk http transport via the [winston-splunk-httplogger](https://github.com/adrianhall/winston-splunk-httplogger) package | `object` | `undefined`

### Splunk Transport Configuration

Key | Description | Allowed Values | Default
--- | --- | --- | ---
url | URL string to pass to `url.parse`. This will try to set `host`, `path`, `protocol`, `port`, `url`. Any of these values will be overwritten if the corresponding property is set on `config` | `http://localhost:8888` | `undefined`
token | The Splunk HTTP Event Collector token | |

_**WARNING**_ - If the Splunk transport fails to connect to Splunk, log messages will be lost during the outage. DO NOT rely on this logger alone if you need to have guaranteed delivery of all logs to Splunk.

### Advanced HTTP Access Log Configuration
Override defaults.

Key | Description | Allowed Values | Default
--- | --- | --- | ---
accessLog.logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir |  _built from environment_
accessLog.logFilenamePrefix | The access log filename will be built from this prefix, by default it will be `access.YYYYMMDD.log` | any string | `access`
accessLog.format | The log format. Note that `combined` and `common` are well-known as NCSA log formats. | `combined`, `common`, `dev`, `short`, `tiny`, `none` | _chosen based on environment_
accessLog.rotationMaxsize | The max size the log file should reach before it is rotated. | a size, in bytes. For example, 1M = 1000000. Or 'none' to never rotate logs | 50000000 (50M)
accessLog.maxFiles | The maximum number of rotated logs to keep around. Logs rotated after this will be removed. | a count, in number of files | None (No deletion)

### Considerations for production logging

* Splunk ingesters are set up to find log files under `/var/log`, so always send your production logs here or to a subdirectory within.

* To differentiate logs emitted from the DEV or IMP or PROD deployed environments, be sure the name is embedded in one or more of the Splunk-searchable fields. For example, configure your log directory with the "deployed environment" embedded as a subdir: `/var/log/qpp-service/{{ dev|imp|prod }}/{{ projectSlug }}/`

    So on Halloween, Splunk will index the `source` of log messages as `/var/log/qpp-service/imp/projectSlug/app.20171031.log`. A sample Splunk query to pick up your IMP logs: `source=/var/log/qpp-service/imp/projectSlug/*`.

* Suggestion: use an environment var (not `NODE_ENV`) to communicate the name of the environment from the OS to the app. The auth service, for example, uses the `ENVIRONMENT` var.

### PII (Personally-Identifiable Information) and log scrubbing
Log messages are composed of a `message` (String) and `metadata` (key-value). Keys in the metadata that match one of the `redactKeys` will not have their value logged. _Note that the logger does not search the String message for data to scrub._ Please keep log messages simple, and add metadata with proper keys.

## Compatibility
Tested with node v10.15.3 and node v12.15.0

## Development
```
$ brew install gitleaks # Installs gitleaks for pre-commit secret detection. If not running on Mac, see https://github.com/zricethezav/gitleaks/releases
$ npm install       # install dependencies
$ npm  test         # run tests, also report coverage in ./coverage/index.html
$ npm run  format   # run prettier to format code
$ npm run lint      # run eslint to check code
```

## Release Process

The release process is semi-automated via github actions. A number of steps are necessarily left manual (such as versioning) and require intervention from the user.

1. Create a release branch `release/*` either off of `master` to pull all changes, or by cherry-picking only certain changes.

2. Bump the `version` using `npm version <patch | minor | major>`.

3. Push the release branch to github.

4. Github actions will automatically [create a release](https://github.com/CMSgov/qpp-shared-logger-node/releases/) and tag based off the version in `package.json`.

5. Review the draft release page and publish it as a pre-release.

5. Github actions will automatically publish a package to npm. Additionally, a new pull request will be created to backfill `master` from `release` if necessary.

## Want to Contribute?

Want to file a bug or contribute some code? Read up on our guidelines for [contributing].

[contributing]: /.github/CONTRIBUTING.md

## Public Domain
This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived
through the CC0 1.0 Universal public domain dedication.

All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to
comply with this waiver of copyright interest.

See the [formal LICENSE file](/LICENSE).


## Resources
* https://jira.cms.gov/browse/QPPELIG-130
* https://jira.cms.gov/browse/QPPELIG-131
* https://confluence.cms.gov/display/QPPGUIDE/Shared+Logger
* https://confluence.cms.gov/display/QPPPLAT/Logging+Standard+Proposal
* https://confluence.cms.gov/display/QPPGUIDE/Shared+Library+V1+Milestone
* https://www.owasp.org/index.php/Logging_Cheat_Sheet
* https://www.npmjs.com/package/winston
* https://www.npmjs.com/package/morgan
* https://github.com/i0natan/nodebestpractices/blob/master/sections/production/setnodeenv.md


