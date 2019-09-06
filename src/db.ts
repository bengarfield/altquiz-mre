/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import {Client, QueryResult} from 'pg';

export default class Database {
	private client: Client;
	private connected = false;

	private async checkConnection() {
		if (this.connected) return;
		try {
			console.log('Connecting to DB over SSL');
			this.client = new Client({ ssl: true });
			await this.client.connect();
		} catch (e) {
			console.log(e);
			console.log('Failed to connect to DB over SSL; Retrying unencrypted!');
			this.client = new Client({ ssl: false });
			try {
				await this.client.connect();
			} catch {
				console.error(e);
				console.error('Could not connect to database!');
				this.connected = false;
				throw new Error('Could not connect to database!');
			}
		}
		console.log('Connected');
		this.connected = true;
	}

	public async query(str: string): Promise<QueryResult> {
		await this.checkConnection();
		return this.client.query(str);
	}

	public disconnect(): Promise<void> {
		return this.client.end();
	}
}

// async function getToken(): Promise<string> {
//     request('https://opentdb.com/api_token.php?command=request', {json: true}, function callback(err, res, body) {
//         console.log(body);
//         return '123';
//     });
// }
