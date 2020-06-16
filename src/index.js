'use strict';

const winston = require('winston');
require('winston-daily-rotate-file');
const morgan = require('morgan'); // access log
const rotatingFileStream = require('rotating-file-stream'); // for morgan
const fs = require('fs');
const filenames = require('./filenames');
const scrubber = require('./scrubber');

function defaultLogDirByEnvironment(options) {
    switch (options.environment) {
        case 'production':
            return `/var/log/qpp-service/${options.projectSlug}`;
        case 'test':
        case 'development':
        default:
            return '.';
    }
}

function logDirectory(options) {
    return options.logDirectory || defaultLogDirByEnvironment(options);
}

function accessLogDirectory(options) {
    return (
        options.accessLog.logDirectory || defaultLogDirByEnvironment(options)
    );
}

function logToConsole(options) {
    return (
        options.logDirectory === 'console' ||
        (!options.logDirectory && options.environment === 'development')
    );
}

function accessLogToConsole(options) {
    return (
        options.accessLog.logDirectory === 'console' ||
        (!options.accessLog.logDirectory &&
            options.environment === 'development')
    );
}

let tzOffset = new Date().getTimezoneOffset() * 60 * 1000; //convert minutes to milliseconds

function localTimestamp() {
    var localISOTime = new Date(Date.now() - tzOffset)
        .toISOString()
        .slice(0, -1); // remove the "Z"
    return localISOTime;
}

function buildLogTransport(options) {
    if (logToConsole(options)) {
        const consoleOptions = {
            colorize: Boolean(options.logColorize),
            timestamp: localTimestamp
        };

        if (options.json) {
            consoleOptions.json = true;
            // Following necessary to output json on a single line
            consoleOptions.stringify = obj => JSON.stringify(obj);
        }

        return new winston.transports.Console(consoleOptions);
    } else {
        if (options.rotationMaxsize !== 'none') {
            return new winston.transports.DailyRotateFile({
                filename: `${logDirectory(options)}/${filenames.logFilename(
                    options
                )}`,
                label: options.projectSlug,
                datePattern: options.logFilenameSuffix || '.yyyyMMdd.log',
                maxsize: options.rotationMaxsize || defaultRotationMaxsize,
                colorize: Boolean(options.logColorize),
                timestamp: localTimestamp,
                maxDays: options.maxDays || defaultRotationMaxDays
            });
        } else {
            return new winston.transports.File({
                filename: `${logDirectory(options)}/${filenames.logFilename(
                    options
                )}.log`,
                label: options.projectSlug,
                colorize: Boolean(options.logColorize),
                timestamp: localTimestamp
            });
        }
    }
}

function buildAccessLogStream(options) {
    if (accessLogToConsole(options)) {
        return undefined; // morgan uses stdout by default
    } else {
        if (options.accessLog.rotationMaxsize !== 'none') {
            const streamOptions = {
                path: accessLogDirectory(options),
                size: `${options.accessLog.rotationMaxsize ||
                    defaultRotationMaxsize}B`,
                interval: '1d' // rotate on daily intervals like the other logs
            };

            // Only add if set
            if (options.accessLog.maxFiles) {
                streamOptions.maxFiles = options.accessLog.maxFiles;
            }

            return rotatingFileStream(
                filenames.accessLogFilenameGenerator(options),
                streamOptions
            );
        } else {
            return fs.createWriteStream(
                `${accessLogDirectory(options)}/${filenames.accessLogFilename(
                    options
                )}.log`,
                { flags: 'a' }
            );
        }
    }
}

const defaultRotationMaxsize = 50000000; // 50M
const defaultRotationMaxDays = 0; // Keep logs forever by default

const defaultLevelByEnvironment = {
    development: 'debug',
    test: 'silly',
    production: 'info'
};

function logEnabled(options) {
    return options.logLevel !== 'none';
}

function logLevel(options) {
    return (
        options.logLevel ||
        defaultLevelByEnvironment[options.environment] ||
        'warn'
    );
}

const defaultAccessLogFormatByEnvironment = {
    development: 'dev',
    test: 'combined',
    production: 'combined'
};

function accessLogFormat(options) {
    return (
        options.accessLog.format ||
        defaultAccessLogFormatByEnvironment[options.environment] ||
        'combined'
    );
}

function accessLogEnabled(options) {
    return options.accessLog.format !== 'none';
}

const defaultRedactKeys = [
    'authorization',
    'email',
    'firstname',
    'lastname',
    'login',
    'password',
    'practice_tin',
    'ptan',
    'qpp-provider-transaction-access-number',
    'qpp-taxpayer-identification-number',
    'tin',
    'tin_num',
    'userid',
    'username',
    'taxpayerIdentificationNumber'
];

// A winston-equivalent logger used for logLevel='none' that just
// suppresses all output
const noneLogger = {
    log: function() {},
    error: function() {},
    warn: function() {},
    info: function() {},
    verbose: function() {},
    debug: function() {},
    silly: function() {},
    transports: []
};

// A morgan-equivalent logger used for format='none' that suppresses
// all output
// eslint-disable-next-line no-unused-vars
const noneAccessLogger = function(req, res, next) {};

let sharedLogger = {
    accessLogger: undefined,
    logger: undefined,
    configured: false,

    /**
     * Configure the logger.
     * @param  {Object} options config options
     */
    configure: function(options) {
        if (this.configured) {
            // eslint-disable-next-line no-console
            console.error(
                'sharedLogger.configure(): called more than once, ignoring'
            );
            return;
        }
        this.configured = true;
        if (!options) {
            throw new Error('options are required');
        }
        if (!options.environment) {
            options.environment = process.env.NODE_ENV || 'development';
        }
        if (!options.projectSlug) {
            throw new Error('projectSlug is required');
        }

        //
        // winston: application logger
        //
        if (logEnabled(options)) {
            this.logger = new winston.Logger({
                level: logLevel(options),
                transports: [buildLogTransport(options)]
            });
            this.logger.rewriters.push(
                scrubber(options.redactKeys || defaultRedactKeys)
            );
        } else {
            this.logger = noneLogger;
        }

        //
        // morgan: http access logger
        //
        options.accessLog = options.accessLog || {};
        if (accessLogEnabled(options)) {
            morgan.token('url', req => {
                if (!req.query) {
                    return req.url;
                }
                // redact the query parameters
                const scrubbedQuery = scrubber(
                    options.redactKeys || defaultRedactKeys
                )(null, null, req.query);
                // map each query parameter into a 'key=value' string, and join them all with '&' separators
                const scrubbedQueryParameters = Object.entries(
                    scrubbedQuery || {}
                )
                    .map(query => `${query[0]}=${query[1]}`)
                    .join('&');
                return (
                    req.pathname +
                    (scrubbedQueryParameters
                        ? '?' + scrubbedQueryParameters
                        : '')
                );
            });
            this.accessLogger = morgan(accessLogFormat(options), {
                stream: buildAccessLogStream(options)
            });
        } else {
            this.accessLogger = noneAccessLogger;
        }
    },

    /**
     * Return a logger that includes the given fields with all entries.
     * @param  {Object} fields metadata to include with logs
     */
    contextLogger: function(fields) {
        let logger = {};
        logger.log = (level, msg, meta) =>
            this.logger.log(level, msg, Object.assign({}, fields, meta));
        logger.error = (msg, meta) => logger.log('error', msg, meta);
        logger.warn = (msg, meta) => logger.log('warn', msg, meta);
        logger.info = (msg, meta) => logger.log('info', msg, meta);
        logger.verbose = (msg, meta) => logger.log('verbose', msg, meta);
        logger.debug = (msg, meta) => logger.log('debug', msg, meta);
        logger.silly = (msg, meta) => logger.log('silly', msg, meta);
        return logger;
    }
};

module.exports = sharedLogger;
module.exports.defaultRedactKeys = defaultRedactKeys;
module.exports.localTimestamp = localTimestamp;
