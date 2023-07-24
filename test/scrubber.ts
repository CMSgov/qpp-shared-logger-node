'use strict';

const assert = require('chai').assert;
import { Scrubber } from '../src/scrubber';

describe('scrubber', function () {
    // initialize scrubber
    const scrubber = new Scrubber(
        ['password', 'firstname', 'CamelCaseKey'],
        [/X\d{3}/i, 'AB\\d+'],
    );

    it('should allow safe metadata', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message: 'this is the message',
            zipCode: '96161',
        });

        assert.include(scrubbedData, { zipCode: '96161' });
    });
    it('should redact sensitive metadata', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message: 'this is the message',
            zipCode: '96161',
            password: 'Password1',
            firstname: 'Jonathan',
        });

        assert.include(scrubbedData, { zipCode: '96161' });
        assert.notInclude(scrubbedData, { password: 'Password1' });
        assert.notInclude(scrubbedData, { firstname: 'Jonathan' });
        assert.include(scrubbedData, { password: '[REDACTED]' });
        assert.include(scrubbedData, { firstname: '[REDACTED]' });
    });
    it('should redact sensitive metadata case-insensitively', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message: 'this is the message',
            camelcaseKEY: 'secret',
        });
        assert.notInclude(scrubbedData, { camelcaseKEY: 'secret' });
        assert.include(scrubbedData, { camelcaseKEY: '[REDACTED]' });
    });
    it('should redact nested sensitive metadata', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message: 'this is the message',
            zipCode: '96161',
            userInfo: {
                password: 'Password1',
                firstname: 'Jonathan',
            },
        });
        assert.include(scrubbedData, { zipCode: '96161' });
        assert.notNestedInclude(scrubbedData, {
            'userInfo.password': 'Password1',
        });
        assert.notNestedInclude(scrubbedData, {
            'userInfo.firstname': 'Jonathan',
        });
        assert.nestedInclude(scrubbedData, {
            'userInfo.password': '[REDACTED]',
        });
        assert.nestedInclude(scrubbedData, {
            'userInfo.firstname': '[REDACTED]',
        });
    });
    it('should redact nested sensitive metadata in an array', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message: 'this is the message',
            zipCode: '96161',
            users: [
                {
                    password: 'Password1',
                    firstname: 'Jonathan',
                },
                {
                    password: 'Password321',
                    firstname: 'Jeff',
                },
            ],
        });
        assert.include(scrubbedData, { zipCode: '96161' });
        assert.notNestedInclude(scrubbedData, {
            'users[0].password': 'Password1',
        });
        assert.notNestedInclude(scrubbedData, {
            'users[0].firstname': 'Jonathan',
        });
        assert.nestedInclude(scrubbedData, {
            'users[0].password': '[REDACTED]',
        });
        assert.nestedInclude(scrubbedData, {
            'users[0].firstname': '[REDACTED]',
        });
        assert.notNestedInclude(scrubbedData, {
            'users[1].password': 'Password321',
        });
        assert.notNestedInclude(scrubbedData, { 'users[1].firstname': 'Jeff' });
        assert.nestedInclude(scrubbedData, {
            'users[1].password': '[REDACTED]',
        });
        assert.nestedInclude(scrubbedData, {
            'users[1].firstname': '[REDACTED]',
        });
    });
    it('should redact strings via regular expression', function () {
        const scrubbedData = scrubber.scrub({
            level: 'info',
            message:
                'Users X391 and x910 (but not x82) provided PINs AB1 and AB492 (not AA7)',
        });

        assert.include(scrubbedData, { level: 'info' });
        assert.include(scrubbedData, {
            message:
                'Users [REDACTED] and [REDACTED] (but not x82) provided PINs [REDACTED] and [REDACTED] (not AA7)',
        });
    });
    it('should not modify the object passed to it', function () {
        const input = {
            zipCode: '96161',
            users: [
                {
                    password: 'Password1',
                    firstname: 'Jonathan',
                },
                {
                    password: 'Password321',
                    firstname: 'Jeff',
                },
            ],
        };
        scrubber.scrub(
            Object.assign(input, {
                level: 'info',
                message: 'this is the message',
            }),
        );

        assert.nestedInclude(input, { 'users[0].password': 'Password1' });
        assert.nestedInclude(input, { 'users[0].firstname': 'Jonathan' });

        assert.nestedInclude(input, { 'users[1].password': 'Password321' });
        assert.nestedInclude(input, { 'users[1].firstname': 'Jeff' });
    });
});
