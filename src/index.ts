import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import SplunkStreamEvent = require('winston-splunk-httplogger');
import morgan = require('morgan'); // access log
import RotatingFileStream from 'rotating-file-stream'; // for morgan
import fs = require('fs');
import filenames = require('./filenames');
import { Scrubber } from './scrubber';
import { Options } from './options';

function defaultLogDirByEnvironment(options: Options) {
    switch (options.environment) {
        case 'production':
            return `/var/log/qpp-service/${options.projectSlug}`;
        case 'test':
        case 'development':
        default:
            return '.';
    }
}

function logDirectory(options: Options) {
    return options.logDirectory || defaultLogDirByEnvironment(options);
}

function accessLogDirectory(options: Options) {
    return (
        options.accessLog.logDirectory || defaultLogDirByEnvironment(options)
    );
}

function logToConsole(options: Options) {
    return (
        options.logDirectory === 'console' ||
        (!options.logDirectory && options.environment === 'development')
    );
}

function accessLogToConsole(options: Options) {
    return (
        options.accessLog.logDirectory === 'console' ||
        (!options.accessLog.logDirectory &&
            options.environment === 'development')
    );
}

let tzOffset = new Date().getTimezoneOffset() * 60 * 1000; //convert minutes to milliseconds

function localTimestamp() {
    const localISOTime = new Date(Date.now() - tzOffset)
        .toISOString()
        .slice(0, -1); // remove the "Z"
    return localISOTime;
}

const localTimestampFormat = winston.format((info) => {
    info.timestamp = localTimestamp();
    return info;
});

function buildAccessLogStream(options: Options) {
    if (accessLogToConsole(options)) {
        return undefined; // morgan uses stdout by default
    } else {
        if (options.accessLog.rotationMaxsize !== 'none') {
            const streamOptions = {
                path: accessLogDirectory(options),
                size: `${
                    options.accessLog.rotationMaxsize || defaultRotationMaxsize
                }B`,
                interval: '1d', // rotate on daily intervals like the other logs
            } as any;

            // Only add if set
            if (options.accessLog.maxFiles) {
                streamOptions.maxFiles = options.accessLog.maxFiles;
            }

            return RotatingFileStream(
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
    production: 'info',
};

function logEnabled(options: Options) {
    return options.logLevel !== 'none';
}

function logLevel(options: Options) {
    return (
        options.logLevel ||
        defaultLevelByEnvironment[options.environment] ||
        'warn'
    );
}

const defaultAccessLogFormatByEnvironment = {
    development: 'dev',
    test: 'combined',
    production: 'combined',
};

function accessLogFormat(options: Options) {
    return (
        options.accessLog.format ||
        defaultAccessLogFormatByEnvironment[options.environment] ||
        'combined'
    );
}

function accessLogEnabled(options: Options) {
    return options.accessLog.format !== 'none';
}

// A winston-equivalent logger used for logLevel='none' that just
// suppresses all output
const noneLogger = {
    log: function () {},
    error: function () {},
    warn: function () {},
    info: function () {},
    verbose: function () {},
    debug: function () {},
    silly: function () {},
    transports: [],
};

// A morgan-equivalent logger used for format='none' that suppresses
// all output
const noneAccessLogger = function (req, res, next) {};

class SharedLogger {
    accessLogger = undefined;
    logger = undefined;
    configured = false;

    /**
     * Configure the logger.
     */
    configure(options: Options) {
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
        if (options.logTimestamps === undefined) {
            options.logTimestamps = true;
        }

        //
        // winston: application logger
        //
        if (logEnabled(options)) {
            const scrubber = new Scrubber(options.redactKeys || []);
            const formats = [
                scrubber.format(),
                winston.format.label({ label: options.projectSlug }),
            ];

            if (options.logColorize === true) {
                formats.push(winston.format.colorize());
            }
            if (options.logTimestamps === true) {
                formats.push(localTimestampFormat());
            }

            switch (options.format) {
                case 'simple':
                    formats.push(winston.format.simple());
                    break;
                case 'prettyPrint':
                    formats.push(winston.format.prettyPrint());
                    break;
                case 'logstash':
                    formats.push(winston.format.logstash());
                    break;
                case 'json':
                default:
                    formats.push(winston.format.json());
            }

            this.logger = winston.createLogger({
                level: logLevel(options),
                transports: this.buildLogTransports(options),
                format: winston.format.combine(...formats),
            });
            this.logger.on('error', (error, transport) => {
                const transportName = transport ? transport.name : 'transport'
                console.error(`Error from logging transport: '${transportName}' while logging`, error)
            })
        } else {
            this.logger = noneLogger;
        }

        //
        // morgan: http access logger
        //
        options.accessLog = options.accessLog || {};
        if (accessLogEnabled(options)) {
            morgan.token('url', (req) => {
                const url = req['pathname'] ?? req.baseUrl;
                if (!req.query || Object.keys(req.query).length === 0) {
                    return url;
                }
                // redact the query parameters
                const scrubber = new Scrubber(options.redactKeys || []);
                const scrubbedQuery = scrubber.scrub(req.query);
                const scrubbedQueryParameters = Object.entries(
                    scrubbedQuery || {}
                )
                    .map((query) => `${query[0]}=${query[1]}`)
                    .join('&');

                return (
                    url +
                    (scrubbedQueryParameters
                        ? '?' + scrubbedQueryParameters
                        : '')
                );
            });
            this.accessLogger = morgan(accessLogFormat(options), {
                stream: buildAccessLogStream(options),
            });
        } else {
            this.accessLogger = noneAccessLogger;
        }
    }

    /**
     * Return a logger that includes the given fields with all entries.
     * @param  {Object} fields metadata to include with logs
     */
    contextLogger(fields) {
        let logger = {} as any;
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

    buildLogTransports(options: Options) {
        const transports = [];
        if (logToConsole(options)) {
            transports.push(new winston.transports.Console({
                handleExceptions: true
            }));
        } else {
            if (options.rotationMaxsize !== 'none') {
                transports.push(
                    new DailyRotateFile({
                        filename: `${logDirectory(
                            options
                        )}/${filenames.logFilename(options)}.%DATE%.${
                            options.logFileExtension || 'log'
                        }`,
                        datePattern: options.datePattern || 'YYYYMMDD',
                        maxSize:
                            options.rotationMaxsize || defaultRotationMaxsize,
                        maxFiles: `${
                            options.maxDays || defaultRotationMaxDays
                        }d`,
                    })
                );
            } else {
                transports.push(
                    new winston.transports.File({
                        filename: `${logDirectory(
                            options
                        )}/${filenames.logFilename(options)}.log`,
                    })
                );
            }
        }

        if (options.splunkSettings) {
            if (!options.splunkSettings.index)
                options.splunkSettings.index = 'qpp';
            transports.push(
                new SplunkStreamEvent({
                    splunk: options.splunkSettings,
                    handleExceptions: true
                })
            );
        }

        return transports;
    }
}

export const sharedLogger = new SharedLogger();
export type Logger = typeof sharedLogger.logger;
export * from './options';
module.exports.localTimestamp = localTimestamp;
