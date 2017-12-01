'use strict';

const log = require('./log');
const logger = log.logger;
const logger2 = log.contextLogger({ id: 222222 });
const logger3 = log.contextLogger({ id: 333333, server: 'test-a' });

logger.warn('example warning', { status: 502 });
logger.info('example info', {
    pizza: true,
    toppings: ['mushrooms, olives'],
    pepper: 'hot'
});
logger2.info('example info', { pizza: false });
logger3.info('example info', { pizza: true, toppings: [] });
logger2.info('example info', { pizza: false, status: 404 });
