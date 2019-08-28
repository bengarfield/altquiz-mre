/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */

import { WebHost } from '@microsoft/mixed-reality-extension-sdk';
import { resolve as resolvePath } from 'path';
import AltQuiz from './app';

process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));

// Start listening for connections, and serve static files
const server = new WebHost({
	baseDir: resolvePath(__dirname, '../public'),
	// baseUrl: 'http://ec66ed80.eu.ngrok.io'
});

// Handle new application sessions
server.adapter.onConnection((context, params) => new AltQuiz(context, params, server.baseUrl));
