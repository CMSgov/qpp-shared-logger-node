import http = require('http');

export interface Request extends http.IncomingMessage {
    baseUrl: string;
    query: string;
}
