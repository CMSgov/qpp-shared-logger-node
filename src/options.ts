import { Format } from 'logform';

export interface Options {
    environment?: string;
    projectSlug: string;
    format?: string;
    addlFormats?: Format[];
    logLevel?: string;
    logColorize?: boolean;
    logDirectory?: string;
    logFilenamePrefix?: string;
    logFileExtension?: string;
    logTimestamps?: boolean;
    splunkSettings?: {
        url: string;
        token: string;
        source?: string;
        index?: string;
    };
    datePattern?: string;
    redactKeys?: string[];
    maxDays?: number;
    rotationMaxsize?: number | string;
    accessLog?: {
        logDirectory?: string;
        logFilenamePrefix?: string;
        format?: string;
        rotationMaxsize?: number | string;
        maxFiles?: number;
    };
}
