'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const fs = require('fs');
const moment = require('moment');
import { sharedLogger } from '../src';
import * as winston from 'winston';
const TEST_LOG_DIR = process.env.TEST_LOG_DIR || '/tmp';

// A winston Transport that sends log messages to a spy, so
// logging can be verified
let SpyTransport = (options) => {
    options = options || {};
    this.level = options.level || 'silly';
    this.spy = options.spy;

    return {
        name: 'SpyTransport',
        on: () => {},
        removeListener: () => {},
        log: (level, msg, meta, callback) => {
            this.spy(level, msg, meta);
            callback(null, true);
        },
    };
};

const fakeConsoleTransportName = 'fakeConsoleTransport';

// Winston transport which will emit an error event when the log method is called
class FakeConsoleTransport extends winston.transports.Console {
    constructor() {
        super();
        this.name = fakeConsoleTransportName;
    }

    log() {
        this.emit('error', new Error('expected test error'));
    }
}

function rmFile(fname) {
    try {
        fs.unlinkSync(fname);
    } catch (err) {
        // console.log('warning:', err);
    }
}

function truncateFile(fname) {
    try {
        fs.truncateSync(fname);
    } catch (err) {
        // console.log('warning:', err);
    }
}

// a minimal request object for testing http access logs
const req = {
    headers: [],
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    ip: '192.168.1.101',
    method: 'GET',
    baseUrl: '/index.html',
    query: {},
};

describe('sharedLogger', function () {
    beforeEach(function () {
        sharedLogger.configured = false;
    });
    describe('when configured with missing values', function () {
        const sandbox = sinon.sandbox.create();
        afterEach(() => sandbox.restore());

        it('should throw an error', function () {
            assert.throws(
                () => sharedLogger.configure(null),
                Error,
                /are required/
            );
        });
        it('should throw error if no projectSlug', () => {
            try {
                sharedLogger.configure({} as any);
            } catch (error) {
                assert.equal(error.message, 'projectSlug is required');
            }
        });
        it('should set format to json', () => {
            const options = {
                format: 'json',
                projectSlug: 'test',
                logDirectory: 'console',
                logTimestamps: false,
            };
            const spy = sandbox.spy(process.stdout, 'write');
            sharedLogger.configure(options);
            sharedLogger.logger.info('should be json');
            assert.equal(
                spy.getCall(0).lastArg,
                '{"message":"should be json","level":"info","label":"test"}\n'
            );
        });

        it('should set format to prettyPrint', () => {
            const options = {
                format: 'prettyPrint',
                projectSlug: 'test',
                logDirectory: 'console',
                logTimestamps: false,
            };
            const spy = sandbox.spy(process.stdout, 'write');
            sharedLogger.configure(options);
            sharedLogger.logger.info('should be prettyPrint', { meta: {a: 'b'}});

            const expectedVal = "{\n  meta: { a: 'b' },\n  level: 'info',\n  message: 'should be prettyPrint',\n  label: 'test'\n}\n";

            assert.equal(
                spy.getCall(0).lastArg,
                expectedVal
            );
        });

        it('should set format to logstash', () => {
            const options = {
                format: 'logstash',
                projectSlug: 'test',
                logDirectory: 'console',
                logTimestamps: false,
            };
            const spy = sandbox.spy(process.stdout, 'write');
            sharedLogger.configure(options);
            sharedLogger.logger.info('should be logstash');
            assert.equal(
                spy.getCall(0).lastArg,
                '{"@message":"should be logstash","@fields":{"level":"info","label":"test"}}\n'
            );
        });
    });

    context('#accessLogger', function () {
        before(function () {
            sharedLogger.configured = false;
        });
        describe('when configured', function () {
            before(function () {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                        format: 'combined',
                        maxFiles: 10,
                    },
                });
            });
            after(function () {
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });
            it('should log http requests to a file', function (done) {
                truncateFile(`${TEST_LOG_DIR}/access.log`);

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(req, res, next);

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/access.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /GET \/index.html/);
                    done();
                }, 20); // give the fs a moment to write the file
            });

            it('should use `baseUrl` to log http requests to a file', function (done) {
                truncateFile(`${TEST_LOG_DIR}/access.log`);

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(
                    {
                        ...req,
                        pathname: undefined,
                        baseUrl: '/index.html',
                    },
                    res,
                    next
                );

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/access.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /GET \/index.html/);
                    done();
                }, 20); // give the fs a moment to write the file
            });

            it('should log redacted http requests to a file', function (done) {
                truncateFile(`${TEST_LOG_DIR}/access.log`);

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(
                    {
                        ...req,
                        pathname: '/index.html',
                        query: { tin: '123' },
                    },
                    res,
                    next
                );

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/access.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(
                        logLines[0],
                        /GET \/index.html\?tin=\[REDACTED\]/
                    );
                    done();
                }, 5); // give the fs a moment to write the file
            });
        });

        describe('when configured with log rotation', function () {
            before(function () {
                sharedLogger.configure({
                    environment: 'production',
                    projectSlug: 'tester',
                    logDirectory: TEST_LOG_DIR,
                    logColorize: true,
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                        rotationMaxsize: 100, // bytes
                    },
                });
            });
            after(function () {
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should log http requests to a file', function (done) {
                truncateFile(`${TEST_LOG_DIR}/access.log`);

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(req, res, next);

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/access.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /GET \/index.html/);
                    done();
                }, 5); // give the fs a moment to write the file
            });
        });

        describe('when disabled', function () {
            before(function () {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logLevel: 'none',
                    accessLog: {
                        format: 'none',
                        logDirectory: 'console',
                    },
                });
            });

            it('should silently suppress log messages', function () {
                const sandbox = sinon.sandbox.create();
                sandbox.spy(process.stdout, 'write');
                sandbox.spy(process.stderr, 'write');

                const res = {};
                const next = () => {};

                sharedLogger.accessLogger(req, res, next);
                sandbox.assert.notCalled(process.stdout.write);
                sandbox.assert.notCalled(process.stderr.write);
                sandbox.restore();
            });
        });
    });

    context('#logger', function () {
        describe('when configured', function () {
            let spy;
            let sandbox;
            let loggerOptions = {
                environment: 'development',
                projectSlug: 'tester',
                logDirectory: TEST_LOG_DIR,
                logFilenamePrefix: 'ktke',
                rotationMaxsize: 'none',
                logLevel: 'debug',
                accessLog: {
                    logDirectory: TEST_LOG_DIR,
                    rotationMaxsize: 'none',
                },
                format: 'simple',
            };

            before(function () {
                sandbox = sinon.sandbox.create();

                sharedLogger.configure(loggerOptions);
            });

            beforeEach(function () {
                spy = sandbox.spy();
                sharedLogger.logger.add(
                    SpyTransport({
                        spy: spy,
                        level: 'debug',
                    })
                );
            });
            afterEach(function () {
                sharedLogger.logger.remove('SpyTransport');
                sharedLogger.logger.remove(fakeConsoleTransportName);
                sandbox.restore();
            });
            after(function () {
                // rmFile(`${TEST_LOG_DIR}/ktke.log`);
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should log error id already configured', () => {
                const consoleSpy = sandbox.spy(console, 'error');
                sharedLogger.configure(loggerOptions);
                sharedLogger.configure(loggerOptions);
                assert.equal(consoleSpy.called, true);
            });

            it('should set env if not set', () => {
                loggerOptions.environment = null;
                sharedLogger.configure(loggerOptions);
                assert.isNotNull(loggerOptions.environment);
            });

            it('should have log level -debug-', function () {
                sharedLogger.logger.debug('DEBUG', {});
                sharedLogger.logger.silly('SILLY', {});

                assert.equal(spy.getCall(0).lastArg.level, 'debug');
                assert.equal(spy.getCall(1).lastArg.level, 'silly');
            });

            it('should log to a file', function (done) {
                truncateFile(`${TEST_LOG_DIR}/ktke.log`);

                sharedLogger.logger.debug('logging to file', {});

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/ktke.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 3);
                    assert.match(logLines[0], /logging to file/);
                    done();
                }, 20); // give the fs a moment to write the file
            });

            it('should keep transport if an error is emitted', function () {
                const consoleTransport = new FakeConsoleTransport();
                let gotUnpiped = false;
                consoleTransport.on('unpipe', () => {
                    gotUnpiped = true;
                });
                sharedLogger.logger.add(consoleTransport);

                sharedLogger.logger.info('testing message');

                // Winston will remove (unpipe) a transport stream after an error.
                // If we detect 'unpipe' and the transport is still in the list, then we have successfully re-added
                assert(gotUnpiped);
                assert(
                    sharedLogger.logger.transports.findIndex(
                        (element) => element == consoleTransport
                    ) >= 0
                );
            });
        });

        describe('when configured with log rotation', function () {
            const logFilename = `${TEST_LOG_DIR}/ktke.${moment()
                .utc()
                .format('YYYYMMDD')}.log`;
            before(function () {
                sharedLogger.configure({
                    environment: 'production',
                    projectSlug: 'tester',
                    logDirectory: TEST_LOG_DIR,
                    logFilenamePrefix: 'ktke',
                    rotationMaxsize: 1000, // bytes
                    logTimestamps: true,
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                    },
                });
            });
            after(function () {
                rmFile(logFilename);
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should log to a file', function (done) {
                truncateFile(logFilename);

                sharedLogger.logger.warn('logging to file', {});

                setTimeout(() => {
                    let data = fs.readFileSync(logFilename, 'utf8');
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /logging to file/);
                    done();
                }, 5); // give the fs a moment to write the file
            });

            it('should emit timestamp in the local server time (not GMT)', function (done) {
                truncateFile(logFilename);
                // This is the format that Splunk expects: TIME_FORMAT = %Y-%m-%dT%T.%3N
                // This corresponds to 2017-01-01T03:04:05.123 (note no TZ info, it's local time)
                let now = moment().format('YYYY-MM-DDTHH:mm:ss.SSS'); // expected
                sharedLogger.logger.warn('local timestamp is in the meta'); // actual
                setTimeout(() => {
                    let data = fs.readFileSync(logFilename, 'utf8');
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    let actualTimestamp = JSON.parse(logLines[0]).timestamp;
                    let expectedTimestamp = now;

                    // test the timestamp without the ms, which could vary
                    // depending on the speed of the test
                    let actualWithoutMs = actualTimestamp.slice(0, -3);
                    let expectedWithoutMs = expectedTimestamp.slice(0, -3);
                    assert.equal(actualWithoutMs, expectedWithoutMs);

                    // test the milliseconds are within a small tolerance
                    let actualMs = Number(actualTimestamp.slice(-3));
                    let expectedMs = Number(expectedTimestamp.slice(-3));
                    assert.closeTo(actualMs, expectedMs, 5);

                    done();
                }, 5); // give the fs a moment to write the file
            });
        });

        describe('when configured', function () {
            let stdoutSpy;
            let sandbox;
            before(function () {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: 'console',
                    logLevel: 'warn',
                    logTimestamps: false,
                    format: 'simple',
                });
                sandbox = sinon.sandbox.create();
            });
            beforeEach(function () {
                stdoutSpy = sandbox.spy(process.stdout, 'write');
            });
            afterEach(function () {
                sandbox.restore();
            });

            it('should have log level -warn-', function () {
                sharedLogger.logger.warn('WARN', {});
                sharedLogger.logger.info('INFO', {});

                assert.equal(
                    stdoutSpy.getCall(0).args[0],
                    'warn: WARN {"label":"tester"}\n'
                );
                assert.isNull(stdoutSpy.getCall(1));
            });

            it('should log to stdout', function () {
                sharedLogger.logger.warn('MESSAGE', {});

                sandbox.assert.calledWithMatch(
                    stdoutSpy,
                    'warn: MESSAGE {"label":"tester"}\n'
                );
            });

            it('should log context fields', function () {
                const logger2 = sharedLogger.contextLogger({ x: 1, y: 5 });
                const logger3 = sharedLogger.contextLogger({ x: 2, z: 8 });

                sharedLogger.logger.warn('MESSAGE 1', {});
                logger2.warn('MESSAGE 2', { a: 1000 });
                logger3.error('MESSAGE 3');
                logger2.info('MESSAGE 4'); // info not logged
                sharedLogger.logger.error('MESSAGE 5', { z: 9 });
                // Override x in the context
                logger3.warn('MESSAGE 6', { x: 3 });
                logger2.verbose('MESSAGE verbose');
                logger2.debug('MESSAGE debug');
                logger2.silly('MESSAGE silly');

                sandbox.assert.callCount(process.stdout.write, 5);
                assert.equal(
                    stdoutSpy.getCall(0).args[0],
                    'warn: MESSAGE 1 {"label":"tester"}\n'
                );
                assert.equal(
                    stdoutSpy.getCall(1).args[0],
                    'warn: MESSAGE 2 {"x":1,"y":5,"a":1000,"label":"tester"}\n'
                );
                assert.equal(
                    stdoutSpy.getCall(2).args[0],
                    'error: MESSAGE 3 {"x":2,"z":8,"label":"tester"}\n'
                );
                assert.equal(
                    stdoutSpy.getCall(3).args[0],
                    'error: MESSAGE 5 {"z":9,"label":"tester"}\n'
                );
                assert.equal(
                    stdoutSpy.getCall(4).args[0],
                    'warn: MESSAGE 6 {"x":3,"z":8,"label":"tester"}\n'
                );
            });

            it('should redact configured PII', function () {
                // Password is redacted by defaults
                sharedLogger.logger.warn('MESSAGE', { password: 'ABCDEF' });

                sandbox.assert.called(process.stdout.write);
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE {"password":"[REDACTED]","label":"tester"}\n'
                );
            });
        });

        describe('when configured with additional formats', function () {
            let stdoutSpy;
            let sandbox;
            before(function () {
                const maskTins = winston.format((info) => {
                    if (info.piitest) {
                        const tinRegex = RegExp('\\b(\\d-?){9}\\b', 'g');
                        info.piitest = info.piitest.replace(
                            tinRegex,
                            '[REDACTED]'
                        );
                    }
                    return info;
                });

                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: 'console',
                    logLevel: 'warn',
                    logTimestamps: false,
                    format: 'simple',
                    addlFormats: [maskTins()],
                });
                sandbox = sinon.sandbox.create();
            });

            beforeEach(function () {
                stdoutSpy = sandbox.spy(process.stdout, 'write');
            });

            afterEach(function () {
                sandbox.restore();
            });

            it('should redact configured PII & use additionaly supplied formatters', function () {
                // Password is redacted by defaults, `piitest` is redacted through additional formatter
                sharedLogger.logger.warn('MESSAGE', {
                    password: 'ABCDEF',
                    piitest: '000111000',
                });

                sandbox.assert.called(process.stdout.write);
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE {"password":"[REDACTED]","piitest":"[REDACTED]","label":"tester"}\n'
                );
            });
        });

        describe('when disabled', function () {
            before(function () {
                sharedLogger.configure({
                    environment: 'development',
                    logDirectory: 'console',
                    projectSlug: 'tester',
                    logLevel: 'none',
                    accessLog: {
                        format: 'none',
                    },
                });
            });

            it('should silently suppress logger calls', function () {
                const sandbox = sinon.sandbox.create();
                sandbox.spy(process.stdout, 'write');
                sandbox.spy(process.stderr, 'write');

                sharedLogger.logger.log('warn', 'This is a test');
                sandbox.assert.notCalled(process.stdout.write);
                sandbox.assert.notCalled(process.stderr.write);

                ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].forEach(
                    function (logLevel) {
                        sharedLogger.logger[logLevel]('This is a test');
                        sandbox.assert.notCalled(process.stdout.write);
                        sandbox.assert.notCalled(process.stderr.write);
                    }
                );

                sandbox.restore();
            });
        });
    });
});
