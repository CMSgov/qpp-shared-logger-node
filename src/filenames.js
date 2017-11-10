'use strict';

function logFilename(options) {
    return `${options.logFilenamePrefix || 'app'}`;
}

function accessLogFilename(options) {
    return `${options.accessLog.logFilenamePrefix || 'access'}`;
}

/**
 * Generate a filename for the access log.
 * @see https://www.npmjs.com/package/rotating-file-stream
 * @return {Function}         a fn to build the filename based on date and index
 */
function accessLogFilenameGenerator(options) {
    return function(time, index) {
        const prefix = accessLogFilename(options);
        if (!time) {
            return `${prefix}.log`;
        }
        function pad(num) {
            return (num > 9 ? '' : '0') + num;
        }
        const dateStr = `${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(
            time.getDate()
        )}`;
        const indexStr = index ? `.${index}` : '';
        return `${prefix}.${dateStr}.log${indexStr}`;
    };
}

module.exports.logFilename = logFilename;
module.exports.accessLogFilename = accessLogFilename;
module.exports.accessLogFilenameGenerator = accessLogFilenameGenerator;
