'use strict';

const assert = require('chai').assert;
const scrubber = require('../src/scrubber');

describe('scrubber', function() {
    const rewriter = scrubber(['password', 'firstname', 'CamelCaseKey']);

    it('should allow safe metadata', function() {
        const logMeta = rewriter('info', 'this is the message', {
            zipCode: '96161'
        });
        assert.include(logMeta, { zipCode: '96161' });
    });
    it('should redact sensitive metadata', function() {
        const logMeta = rewriter('info', 'this is the message', {
            zipCode: '96161',
            password: 'Password1',
            firstname: 'Jonathan'
        });
        assert.include(logMeta, { zipCode: '96161' });
        assert.notInclude(logMeta, { password: 'Password1' });
        assert.notInclude(logMeta, { firstname: 'Jonathan' });
        assert.include(logMeta, { password: '[REDACTED]' });
        assert.include(logMeta, { firstname: '[REDACTED]' });
    });
    it('should redact sensitive metadata case-insensitively', function() {
        const logMeta = rewriter('info', 'this is the message', {
            camelcaseKEY: 'secret'
        });
        assert.notInclude(logMeta, { camelcaseKEY: 'secret' });
        assert.include(logMeta, { camelcaseKEY: '[REDACTED]' });
    });
    it('should redact nested sensitive metadata', function() {
        const logMeta = rewriter('info', 'this is the message', {
            zipCode: '96161',
            userInfo: {
                password: 'Password1',
                firstname: 'Jonathan'
            }
        });
        assert.include(logMeta, { zipCode: '96161' });
        assert.notNestedInclude(logMeta, { 'userInfo.password': 'Password1' });
        assert.notNestedInclude(logMeta, { 'userInfo.firstname': 'Jonathan' });
        assert.nestedInclude(logMeta, { 'userInfo.password': '[REDACTED]' });
        assert.nestedInclude(logMeta, { 'userInfo.firstname': '[REDACTED]' });
    });
    it('should redact nested sensitive metadata in an array', function() {
        const logMeta = rewriter('info', 'this is the message', {
            zipCode: '96161',
            users: [
                {
                    password: 'Password1',
                    firstname: 'Jonathan'
                },
                {
                    password: 'Password321',
                    firstname: 'Jeff'
                }
            ]
        });
        assert.include(logMeta, { zipCode: '96161' });
        assert.notNestedInclude(logMeta, { 'users[0].password': 'Password1' });
        assert.notNestedInclude(logMeta, { 'users[0].firstname': 'Jonathan' });
        assert.nestedInclude(logMeta, { 'users[0].password': '[REDACTED]' });
        assert.nestedInclude(logMeta, { 'users[0].firstname': '[REDACTED]' });
        assert.notNestedInclude(logMeta, {
            'users[1].password': 'Password321'
        });
        assert.notNestedInclude(logMeta, { 'users[1].firstname': 'Jeff' });
        assert.nestedInclude(logMeta, { 'users[1].password': '[REDACTED]' });
        assert.nestedInclude(logMeta, { 'users[1].firstname': '[REDACTED]' });
    });
    it('should not modify the object passed to it', function() {
        const input = {
            zipCode: '96161',
            users: [
                {
                    password: 'Password1',
                    firstname: 'Jonathan'
                },
                {
                    password: 'Password321',
                    firstname: 'Jeff'
                }
            ]
        };
        rewriter('info', 'this is the message', input);

        assert.nestedInclude(input, { 'users[0].password': 'Password1' });
        assert.nestedInclude(input, { 'users[0].firstname': 'Jonathan' });

        assert.nestedInclude(input, { 'users[1].password': 'Password321' });
        assert.nestedInclude(input, { 'users[1].firstname': 'Jeff' });
    });
});
