'use strict';

const _ = require('lodash');
const winston = require('winston');

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
    'taxpayerIdentificationNumber',
];

export class Scrubber {
    blacklist = [];
    // A winston Formatter that removes all meta
    // See https://github.com/winstonjs/winston/blob/HEAD/UPGRADE-3.0.md#rewriters for upgrade info
    format = winston.format((info) => this.scrub(info));

    constructor(redactKeys: string[]) {
        // merge with defaults
        this.blacklist = [
            ...new Set([
                ...redactKeys.map((key) => key.toLowerCase()),
                ...defaultRedactKeys.map((key) => key.toLowerCase()),
            ]),
        ];
    }

    scrub(logEntry) {
        // Clone and redact in a single traversal
        const redacted = _.cloneDeepWith(logEntry, (value, key) => {
            if (_.isString(key) && this.blacklist.includes(key.toLowerCase())) {
                return '[REDACTED]';
            }
        });

        return redacted;
    }
}
