# qpp-shared-logger-node

This logger is opinionated. Configure it with a minimal set of options, and get Splunk-searchable, PII-scrubbed, and QPP-compliant logs with minimal effort.

## Configuration

Key | Description | Allowed Values
--- | --- | ---
environment (**Required**) | The "environment" that your app is running in. Using a predefined QPP environment will automatically configure various log settings for you. QPP environments are defined as follows: `local`, `dev`, `imp`, `prod`. If you choose to dream up your own environment, you'll have to use some of the advanced configuration settings. | `local`, `dev`, `imp`, `prod`
projectSlug (**Required**) | The name of your app, to be included in the log metadata and the log file path. | any string

### Per-Environment Defaults
Set your `environment` to one of the supported environments and get these settings out-of-the-box:

Name | Application log path | Log level
--- | --- | ---
local | _console_ | debug
dev | /var/log/qpp-service/dev/{{ projectSlug }}/app.log | debug
imp | /var/log/qpp-service/imp/{{ projectSlug }}/app.log | info
prod | /var/log/qpp-service/prod/{{ projectSlug }}/app.log | info

Name | Access log path | Format
--- | --- | ---
local | _console_ | dev
dev | /var/log/qpp-service/dev/{{ projectSlug }}/access.log | combined
imp | /var/log/qpp-service/imp/{{ projectSlug }}/access.log | combined
prod | /var/log/qpp-service/prod/{{ projectSlug }}/access.log | combined


### Advanced Application Log Configuration
You may override the defaults:

Key | Description | Allowed Values | Default
--- | --- | --- | ---
logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir | _built from environment_
logFilenamePrefix | The application log filename will be built from this prefix, by default it will be `app.YYYYMMDD.log` | any string | `app`
logLevel | All log messages at this level or higher will be logged. `none` effectively turns off logging. | `none`, `error`, `warn`, `info`, `verbose`, `debug`, `silly` | _chosen based on environment_
logColorize | If `true`, log messages will be sent colorized (most valuable when logging to the `console`) | `true` or `false` | `false`
redactKeys | An array of keys to scrub from the log metadata | an array of lowercase strings | ``["username", "userid", "email", "firstname", "lastname", "password", "tin", "ptan"]``
rotationMaxsize | The max size the log file should reach before it is rotated. | a size, in bytes. For example, 1M = 1000000 | 50000000 (50M)

### Advanced HTTP Access Log Configuration
Override defaults.

Key | Description | Allowed Values | Default
--- | --- | --- | ---
accessLog.logDirectory | A valid directory where the log file should be written, or "console" to write to stdout. Will `throw` if the directory does not exist or is not writable. | `console`, or an absolute dir |  _built from environment_
accessLog.logFilenamePrefix | The access log filename will be built from this prefix, by default it will be `access.YYYYMMDD.log` | any string | `access`
accessLog.format | The log format. Note that `combined` and `common` are well-known as NCSA log formats. | `combined`, `common`, `dev`, `short`, `tiny`, `none` | _chosen based on environment_

### Considerations for production logging

* Splunk ingesters are set up to find log files under `/var/log`, so always send your production logs here or to a subdirectory within.

* To differentiate logs emitted from the DEV or IMP or PROD environments, be sure the environment name is embedded in one or more of the Splunk-searchable fields. For example, the default log directory has the `environment` embedded as a subdir: `/var/log/qpp-service/{{ env }}/{{ projectSlug }}/`

    So on Halloween, Splunk will index the `source` of log messages as `/var/log/qpp-service/imp/projectSlug/app.20171031.log`. A sample Splunk query to pick up your IMP logs: `source=/var/log/qpp-service/imp/projectSlug/*`.

* Suggestion: use an environment var to communicate the name of the environment from the OS to the app.

### PII (Personally-Identifiable Information) and log scrubbing
Log messages are composed of a `message` (String) and `metadata` (key-value). Keys in the metadata that match one of the `redactKeys` will not have their value logged. _Note that the logger does not search the String message for data to scrub._ Please keep log messages simple, and add metadata with proper keys.

## Resources
* https://jira.cms.gov/browse/QPPELIG-130
* https://jira.cms.gov/browse/QPPELIG-131
* https://confluence.cms.gov/display/QPPGUIDE/Shared+Logger
* https://confluence.cms.gov/display/QPPPLAT/Logging+Standard+Proposal
* https://confluence.cms.gov/display/QPPGUIDE/Shared+Library+V1+Milestone
* https://www.owasp.org/index.php/Logging_Cheat_Sheet
* https://www.npmjs.com/package/winston
* https://www.npmjs.com/package/morgan
