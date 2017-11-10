'use strict';

const assert = require('chai').assert;
const filenames = require('../src/filenames');

describe('filenames', function() {
    context('#accessLogFilenameGenerator', function() {
        it('should return the default filename when no time or index is provided', function() {
            const filename = filenames.accessLogFilenameGenerator({
                accessLog: {}
            })(undefined, undefined);
            assert.equal(filename, 'access.log');
        });
        it('should return a custom filename when no time or index is provided', function() {
            const filename = filenames.accessLogFilenameGenerator({
                accessLog: { logFilenamePrefix: 'http' }
            })(undefined, undefined);
            assert.equal(filename, 'http.log');
        });
        it('should include the date in the filename when time is provided', function() {
            const time = new Date(2017, 0, 5); // Jan 5
            const filename = filenames.accessLogFilenameGenerator({
                accessLog: {}
            })(time, undefined);
            assert.equal(filename, 'access.20170105.log');
        });
        it('should include the date and the file index in the filename when time and index is provided', function() {
            const time = new Date(2017, 10, 2); // Nov 2
            const filename = filenames.accessLogFilenameGenerator({
                accessLog: {}
            })(time, 3);
            assert.equal(filename, 'access.20171102.log.3');
        });
    });
});
