export interface Options {
    environment?: string;
    projectSlug: string;
    format?: string;
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
