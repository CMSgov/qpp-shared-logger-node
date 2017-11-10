'use strict';

const logger = require('./log');

logger.warn('example warning', { status: 502 });
logger.info('example info', {
    pizza: true,
    toppings: ['mushrooms, olives'],
    pepper: 'hot'
});
