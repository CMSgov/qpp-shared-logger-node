'use strict';

const traverse = require('traverse');

/**
 * Return a winston rewriter that removes all meta
 * values associated with the passed keys.
 * @param  {[String]} redactKeys a list of keys to scrub from the log meta
 * @return {Function}            a winston rewriter fn
 * @see https://www.npmjs.com/package/winston#filters-and-rewriters
 */
function scrubber(redactKeys) {
    return function(level, msg, meta) {
        traverse(meta).forEach(function() {
            // see https://www.npmjs.com/package/traverse
            // "this" is a node in the meta
            if (this.key && redactKeys.includes(this.key.toLowerCase())) {
                this.update('[REDACTED]'); // update the value in place
            }
        });
        return meta;
    };
}

module.exports = scrubber;
