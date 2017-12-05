'use strict';

const _ = require('lodash');

/**
 * Return a winston rewriter that removes all meta
 * values associated with the passed keys.
 * @param  {[String]} redactKeys a list of keys to scrub from the log meta
 * @return {Function}            a winston rewriter fn
 * @see https://www.npmjs.com/package/winston#filters-and-rewriters
 */
function scrubber(redactKeys) {
    return function(level, msg, meta) {
        // Clone and redact in a single traversal
        const redacted = _.cloneDeepWith(meta, (value, key) => {
            if (_.isString(key) && redactKeys.includes(key.toLowerCase())) {
                return '[REDACTED]';
            }
        });

        return redacted;
    };
}

module.exports = scrubber;
