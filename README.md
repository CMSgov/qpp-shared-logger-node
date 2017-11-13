# qpp-shared-logger-node
A simple configurable wrapper around the [winston](https://www.npmjs.com/package/winston) application logger and the [morgan](https://www.npmjs.com/package/morgan) http access logger.

This logger is opinionated. Configure it with a minimal set of options, and get Splunk-searchable, PII-scrubbed, and QPP-compliant logs with minimal effort.

## Installation
```
$ yarn add qpp-shared-logger-node
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
environment | Override the "node environment" that your app is running in. Using the conventional values will automatically configure various log settings for you. Conventional values are `development`, `test`, and `production`. Deployed code should [run with `NODE_ENV=production`](https://github.com/i0natan/nodebestpractices/blob/master/sections/production/setnodeenv.md) | `process.env.NODE_ENV`
logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir | _built from environment_
logFilenamePrefix | The application log filename will be built from this prefix, by default it will be `app.YYYYMMDD.log` | any string | `app`
logLevel | All log messages at this level or higher will be logged. `none` effectively turns off logging. | `none`, `error`, `warn`, `info`, `verbose`, `debug`, `silly` | _chosen based on environment_
logColorize | If `true`, log messages will be sent colorized (most valuable when logging to the `console`) | `true` or `false` | `false`
redactKeys | An array of keys to scrub from the log metadata | an array of lowercase strings | ``['email', 'firstname', 'lastname', 'password', 'ptan', 'tin', 'userid', 'username']``
rotationMaxsize | The max size the log file should reach before it is rotated. | a size, in bytes. For example, 1M = 1000000. Or 'none' to never rotate logs | 50000000 (50M)

### Advanced HTTP Access Log Configuration
Override defaults.

Key | Description | Allowed Values | Default
--- | --- | --- | ---
accessLog.logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir |  _built from environment_
accessLog.logFilenamePrefix | The access log filename will be built from this prefix, by default it will be `access.YYYYMMDD.log` | any string | `access`
accessLog.format | The log format. Note that `combined` and `common` are well-known as NCSA log formats. | `combined`, `common`, `dev`, `short`, `tiny`, `none` | _chosen based on environment_
accessLog.rotationMaxsize | The max size the log file should reach before it is rotated. | a size, in bytes. For example, 1M = 1000000. Or 'none' to never rotate logs | 50000000 (50M)

### Considerations for production logging

* Splunk ingesters are set up to find log files under `/var/log`, so always send your production logs here or to a subdirectory within.

* To differentiate logs emitted from the DEV or IMP or PROD deployed environments, be sure the name is embedded in one or more of the Splunk-searchable fields. For example, configure your log directory with the "deployed environment" embedded as a subdir: `/var/log/qpp-service/{{ dev|imp|prod }}/{{ projectSlug }}/`

    So on Halloween, Splunk will index the `source` of log messages as `/var/log/qpp-service/imp/projectSlug/app.20171031.log`. A sample Splunk query to pick up your IMP logs: `source=/var/log/qpp-service/imp/projectSlug/*`.

* Suggestion: use an environment var (not `NODE_ENV`) to communicate the name of the environment from the OS to the app. The auth service, for example, uses the `ENVIRONMENT` var.

### PII (Personally-Identifiable Information) and log scrubbing
Log messages are composed of a `message` (String) and `metadata` (key-value). Keys in the metadata that match one of the `redactKeys` will not have their value logged. _Note that the logger does not search the String message for data to scrub._ Please keep log messages simple, and add metadata with proper keys.

## Compatibility
Tested with node 6.10.3 and node 8.9.0

## Development
```
$ yarn          # install dependencies
$ yarn test     # run tests, also report coverage in ./coverage/index.html
$ yarn format   # run prettier to format code
$ yarn lint     # run eslint to check code
```

## Contributing to this project
If you are planning on contributing to this project, please open a pull request with the branch title either name of the JIRA ticket that describes the work or some name that unambiguous.  We have a few people that we can assign the pull request to that should cover most of the stakeholders that would be interested in this project's development.

Name | Email | EUA Id | Company
--- | --- | --- | ---
Scott Haselton | scott.haselton@cms.hhs.gov | H98G |  USDS 
Jonathan Julian | jonathan@adhocteam.us | JS1I | Ad Hoc

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
