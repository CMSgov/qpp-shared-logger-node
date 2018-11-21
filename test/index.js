'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const fs = require('fs');
const moment = require('moment');
const sharedLogger = require('../src');
const TEST_LOG_DIR = process.env.TEST_LOG_DIR || '/tmp';

// A winston Transport that sends log messages to a spy, so
// logging can be verified
function SpyTransport(options) {
    options = options || {};
    this.level = options.level || 'silly';
    this.spy = options.spy;
}
SpyTransport.prototype.name = 'SpyTransport';
SpyTransport.prototype.on = function() {};
SpyTransport.prototype.removeListener = function() {};
SpyTransport.prototype.log = function(level, msg, meta, callback) {
    this.spy(level, msg, meta);
    callback(null, true);
};

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
    url: '/index.html'
};

describe('sharedLogger', function() {
    beforeEach(function() {
        sharedLogger.configured = false;
    });
    describe('when configured with missing values', function() {
        it('should throw an error', function() {
            assert.throws(
                () => sharedLogger.configure(null),
                Error,
                /are required/
            );
            sharedLogger.configured = false;
            assert.throws(
                () => sharedLogger.configure({}),
                Error,
                /is required/
            );
        });
    });

    context('#accessLogger', function() {
        before(function() {
            sharedLogger.configured = false;
        });
        describe('when configured', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                        format: 'combined'
                    }
                });
            });
            after(function() {
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });
            it('should log http requests to a file', function(done) {
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

        describe('when configured with log rotation', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'production',
                    projectSlug: 'tester',
                    logDirectory: TEST_LOG_DIR,
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                        rotationMaxsize: 100 // bytes
                    }
                });
            });
            after(function() {
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should log http requests to a file', function(done) {
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

        describe('when disabled', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    loglevel: 'none',
                    accessLog: {
                        format: 'none',
                        directory: 'console'
                    }
                });
            });

            it('should silently suppress log messages', function() {
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

    context('#logger', function() {
        describe('when configured', function() {
            let spy;
            let sandbox;
            before(function() {
                sandbox = sinon.sandbox.create();

                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: TEST_LOG_DIR,
                    logFilenamePrefix: 'ktke',
                    rotationMaxsize: 'none',
                    logLevel: 'debug',
                    accessLog: {
                        logDirectory: TEST_LOG_DIR,
                        rotationMaxsize: 'none'
                    }
                });
            });
            beforeEach(function() {
                spy = sandbox.spy();
                sharedLogger.logger.add(SpyTransport, {
                    spy: spy,
                    level: 'debug'
                });
            });
            afterEach(function() {
                sharedLogger.logger.remove('SpyTransport');
                sandbox.restore();
            });
            after(function() {
                rmFile(`${TEST_LOG_DIR}/ktke.log`);
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should have log level -debug-', function() {
                sharedLogger.logger.debug('DEBUG', {});
                sharedLogger.logger.silly('SILLY', {});

                sandbox.assert.calledWith(spy, 'debug', 'DEBUG', {});
                sandbox.assert.neverCalledWith(spy, 'silly', 'SILLY', {});
            });
            it('should log to a file', function(done) {
                truncateFile(`${TEST_LOG_DIR}/ktke.log`);

                sharedLogger.logger.debug('logging to file', {});

                setTimeout(() => {
                    let data = fs.readFileSync(
                        `${TEST_LOG_DIR}/ktke.log`,
                        'utf8'
                    );
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /logging to file/);
                    done();
                }, 5); // give the fs a moment to write the file
            });
        });

        describe('when configured with log rotation', function() {
            const logFilename = `${TEST_LOG_DIR}/ktke.${moment()
                .utc()
                .format('YYYYMMDD')}.log`;
            before(function() {
                sharedLogger.configure({
                    environment: 'production',
                    projectSlug: 'tester',
                    logDirectory: TEST_LOG_DIR,
                    logFilenamePrefix: 'ktke',
                    rotationMaxsize: 1000, // bytes
                    accessLog: {
                        logDirectory: TEST_LOG_DIR
                    }
                });
            });
            after(function() {
                rmFile(logFilename);
                rmFile(`${TEST_LOG_DIR}/access.log`);
            });

            it('should log to a file', function(done) {
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

            it('should emit timestamp in the local server time (not GMT)', function(
                done
            ) {
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

        describe('when configured', function() {
            let spy;
            let sandbox;
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: 'console',
                    logLevel: 'warn'
                });
                sandbox = sinon.sandbox.create();
            });
            beforeEach(function() {
                spy = sandbox.spy();
                sharedLogger.logger.add(SpyTransport, {
                    spy: spy,
                    level: 'warn'
                });
                sandbox.spy(process.stdout, 'write');
                sandbox.spy(process.stderr, 'write');
            });
            afterEach(function() {
                sharedLogger.logger.remove('SpyTransport');
                sandbox.restore();
            });

            it('should have log level -warn-', function() {
                sharedLogger.logger.warn('WARN', {});
                sharedLogger.logger.info('INFO', {});

                sandbox.assert.calledWith(spy, 'warn', 'WARN', {});
                sandbox.assert.neverCalledWith(spy, 'info', 'INFO', {});
            });

            it('should log to stdout', function() {
                sharedLogger.logger.warn('MESSAGE', {});

                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE\n'
                );
            });

            it('should log context fields', function() {
                const logger2 = sharedLogger.contextLogger({ x: 1, y: 5 });
                const logger3 = sharedLogger.contextLogger({ x: 2, z: 8 });

                sharedLogger.logger.warn('MESSAGE 1', {});
                logger2.warn('MESSAGE 2', { a: 1000 });
                logger3.error('MESSAGE 3');
                logger2.info('MESSAGE 4'); // info not logged
                sharedLogger.logger.error('MESSAGE 5', { z: 9 });
                // Override x in the context
                logger3.warn('MESSAGE 6', { x: 3 });

                sandbox.assert.callCount(process.stdout.write, 3);
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE 1\n'
                );
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE 2 x=1, y=5, a=1000\n'
                );
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE 6 x=3, z=8\n'
                );

                sandbox.assert.callCount(process.stderr.write, 2);
                sandbox.assert.calledWithMatch(
                    process.stderr.write,
                    'error: MESSAGE 3 x=2, z=8\n'
                );
                sandbox.assert.calledWithMatch(
                    process.stderr.write,
                    'error: MESSAGE 5 z=9\n'
                );
            });

            it('should redact configured PII', function() {
                // Password is redacted by defaults
                sharedLogger.logger.warn('MESSAGE', { password: 'ABCDEF' });

                sandbox.assert.called(process.stdout.write);
                sandbox.assert.calledWithMatch(
                    process.stdout.write,
                    'warn: MESSAGE password=[REDACTED]\n'
                );
            });
        });
        describe('when disabled', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    logDirectory: 'console',
                    projectSlug: 'tester',
                    logLevel: 'none',
                    accessLog: {
                        format: 'none'
                    }
                });
            });

            it('should silently suppress logger calls', function() {
              const sandbox = sinon.sandbox.create();
              sandbox.spy(process.stdout, 'write');
              sandbox.spy(process.stderr, 'write');

              sharedLogger.logger.log('warn', 'This is a test');
              sandbox.assert.notCalled(process.stdout.write);
              sandbox.assert.notCalled(process.stderr.write);

              ['error', 'warn', 'info', 'verbose', 'debug', 'silly'].forEach(function(logLevel) {
                sharedLogger.logger[logLevel]('This is a test');
                sandbox.assert.notCalled(process.stdout.write);
                sandbox.assert.notCalled(process.stderr.write);
              });

              sandbox.restore();
            });
        });
    });
});
