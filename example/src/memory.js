/**
 * Memory leak test of contextLogger.
 */

'use strict';

const v8 = require('v8');
const log = require('./log');
const logger = log.logger;

/**
 * Run the test.
 */
function main() {
    logger.info('starting memory usage test');
    let maxUsed = 0;
    let lastStats = v8.getHeapStatistics();
    let lastTime = Date.now();
    let rate = 1;
    for (let i = 0; i != 500000000; i++) {
        // Create and use a new contextLogger.
        const z = log.contextLogger({ id: i });
        z.silly('example log', { pizza: false });

        if (((i + 1) % 10000) == 0) {
            const now = Date.now();
            rate = Math.floor(10000 / ((now - lastTime) / 1000));
            lastTime = now;
        }

        // Examine heap statistics.
        const stats = v8.getHeapStatistics();
        if (stats.used_heap_size < lastStats.used_heap_size) {
            // The used size has just shrunk (garbage collection happened).
            // Log heap statistics before and after.
            if (maxUsed < lastStats.used_heap_size) {
                maxUsed = lastStats.used_heap_size;
                logHeapStats(i - 1, rate, lastStats, '    * new maximum reached *');
            } else {
                logHeapStats(i - 1, rate, lastStats, '    * local maximum *');
            }
            logHeapStats(i, rate, stats, '');
        } else if (i % 1000 == 0) {
            // Periodic logging of statistics.
            logHeapStats(i, rate, stats, '');
        }
        lastStats = stats;
    }
}

/**
 * Format a size as MB or KB.
 */
function formatSize(i) {
    if (1024 * 1024 <= i) {
        const mb = i / 1024 / 1024;
        return `${mb.toFixed(1)}M`;
    } else if (1024 <= i) {
        const kb = i / 1024;
        return `${kb.toFixed(1)}K`;
    }
    return i.toString();
}

/**
 * Format a size in MB with a bar graph.
 */
function formatBar(i) {
    const mb = i / 1024 / 1024;
    let s = '';
    for (let j = 0; j <= mb; j++) {
        s = s + '=';
    }
    return s + ' ' + formatSize(i);
}

/**
 * Log heap statistics.
 */
function logHeapStats(i, rate, stats, extra) {
    const info = `i ${i}, rate ${rate}/s, heap size ${formatSize(
        stats.total_heap_size
    )}, used ${formatBar(stats.used_heap_size)}`;
    logger.info(`${info} ${extra}`);
}

main();
