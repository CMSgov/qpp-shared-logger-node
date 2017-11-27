'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const fs = require('fs');
const startCapturingStdout = require('intercept-stdout');
const moment = require('moment');
const sharedLogger = require('../src');

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
    describe('when configured with missing values', function() {
        it('should throw an error', function() {
            assert.throws(
                () => sharedLogger.configure(null),
                Error,
                /are required/
            );
            assert.throws(
                () => sharedLogger.configure({}),
                Error,
                /is required/
            );
        });
    });

    context('#accessLogger', function() {
        describe('when configured', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    accessLog: {
                        logDirectory: '/tmp',
                        format: 'combined'
                    }
                });
            });
            after(function() {
                rmFile('/tmp/access.log');
            });
            it('should log http requests to a file', function(done) {
                truncateFile('/tmp/access.log');

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(req, res, next);

                setTimeout(() => {
                    let data = fs.readFileSync('/tmp/access.log', 'utf8');
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
                    logDirectory: '/tmp',
                    accessLog: {
                        logDirectory: '/tmp',
                        rotationMaxsize: 100 // bytes
                    }
                });
            });
            after(function() {
                rmFile('/tmp/access.log');
            });

            it('should log http requests to a file', function(done) {
                truncateFile('/tmp/access.log');

                const res = {};
                const next = () => {};
                sharedLogger.accessLogger(req, res, next);

                setTimeout(() => {
                    let data = fs.readFileSync('/tmp/access.log', 'utf8');
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
                        format: 'none'
                    }
                });
            });
            it('should not build an accessLogger', function() {
                assert.isUndefined(sharedLogger.accessLogger);
            });
        });
    });

    context('#logger', function() {
        describe('when configured', function() {
            var spy;
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: '/tmp',
                    logFilenamePrefix: 'ktke',
                    rotationMaxsize: 'none',
                    logLevel: 'debug',
                    accessLog: {
                        logDirectory: '/tmp',
                        rotationMaxsize: 'none'
                    }
                });
            });
            beforeEach(function() {
                spy = sinon.spy();
                sharedLogger.logger.add(SpyTransport, {
                    spy: spy,
                    level: 'debug'
                });
            });
            afterEach(function() {
                sharedLogger.logger.remove('SpyTransport');
            });
            after(function() {
                rmFile('/tmp/ktke.log');
                rmFile('/tmp/access.log');
            });

            it('should have log level -debug-', function() {
                sharedLogger.logger.debug('DEBUG', {});
                sharedLogger.logger.silly('SILLY', {});
                assert(
                    spy.calledWith('debug', 'DEBUG', {}),
                    'logger did not log a debug message'
                );
                assert(
                    spy.neverCalledWith('silly', 'SILLY', {}),
                    'logger should not have logged a silly message'
                );
            });
            it('should log to a file', function(done) {
                truncateFile('/tmp/ktke.log');

                sharedLogger.logger.debug('logging to file', {});

                setTimeout(() => {
                    let data = fs.readFileSync('/tmp/ktke.log', 'utf8');
                    let logLines = data.split('\n');
                    assert.isAtMost(logLines.length, 2);
                    assert.match(logLines[0], /logging to file/);
                    done();
                }, 5); // give the fs a moment to write the file
            });
        });

        describe('when configured with log rotation', function() {
            const logFilename = `/tmp/ktke.${moment()
                .utc()
                .format('YYYYMMDD')}.log`;
            before(function() {
                sharedLogger.configure({
                    environment: 'production',
                    projectSlug: 'tester',
                    logDirectory: '/tmp',
                    logFilenamePrefix: 'ktke',
                    rotationMaxsize: 1000, // bytes
                    accessLog: {
                        logDirectory: '/tmp'
                    }
                });
            });
            after(function() {
                rmFile(logFilename);
                rmFile('/tmp/access.log');
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
        });

        describe('when configured', function() {
            var spy;
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logDirectory: 'console',
                    logLevel: 'warn'
                });
            });
            beforeEach(function() {
                spy = sinon.spy();
                sharedLogger.logger.add(SpyTransport, {
                    spy: spy,
                    level: 'warn'
                });
            });
            afterEach(function() {
                sharedLogger.logger.remove('SpyTransport');
            });

            it('should have log level -warn-', function() {
                sharedLogger.logger.warn('WARN', {});
                sharedLogger.logger.info('INFO', {});
                assert(
                    spy.calledWith('warn', 'WARN', {}),
                    'logger did not log a warn message'
                );
                assert(
                    spy.neverCalledWith('info', 'INFO', {}),
                    'logger should not have logged an info message'
                );
            });
            it('should log to stdout', function(done) {
                let captured = '';
                // begin capturing stdout, this returns the stop fn
                var stopCapturingStdout = startCapturingStdout(
                    text => (captured += text)
                );
                sharedLogger.logger.warn('MESSAGE', {});
                stopCapturingStdout();
                setTimeout(() => {
                    assert.match(captured, /MESSAGE/);
                    done();
                }, 5); // give stdout a moment
            });
            it('should log context fields', function(done) {
                let captured = '';
                // begin capturing stdout, this returns the stop fn
                var stopCapturingStdout = startCapturingStdout(
                    text => (captured += text)
                );
                const logger2 = sharedLogger.contextLogger({ x: 1, y: 5 });
                const logger3 = sharedLogger.contextLogger({ x: 2, z: 8 });
                sharedLogger.logger.warn('MESSAGE 1', {});
                logger2.warn('MESSAGE 2', { a: 1000 });
                logger3.error('MESSAGE 3');
                logger2.info('MESSAGE 4'); // info not logged
                sharedLogger.logger.error('MESSAGE 5', { z: 9 });
                // Override x in the context
                logger3.warn('MESSAGE 6', { x: 3 });
                stopCapturingStdout();
                setTimeout(() => {
                    assert.match(captured, /MESSAGE/);
                    assert.equal(
                        captured,
                        `warn: MESSAGE 1
warn: MESSAGE 2 x=1, y=5, a=1000
error: MESSAGE 3 x=2, z=8
error: MESSAGE 5 z=9
warn: MESSAGE 6 x=3, z=8
`
                    );
                    done();
                }, 5); // give stdout a moment
            });
        });

        describe('when disabled', function() {
            before(function() {
                sharedLogger.configure({
                    environment: 'development',
                    projectSlug: 'tester',
                    logLevel: 'none',
                    accessLog: {
                        format: 'none'
                    }
                });
            });
            it('should not build a logger', function() {
                assert.isUndefined(sharedLogger.logger);
            });
        });
    });
});
