/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import { Actor } from '@microsoft/mixed-reality-extension-sdk';

export interface Podium {
	id: string;
	name: Actor;
	score: Actor;
	scoreVal: number;
	button: Actor;
	hasBuzzed: boolean;
	joinButton: Actor;
	leaveButton: Actor;
	screen: Actor;
	spotLight: Actor;
	model: Actor;
}

export interface Category {
	id: number;
	name: string;
}

export interface Question {
	id: number;
	source: string;
	type: string;
	categoryId: number;
	category: string;
	difficulty: string;
	question: string;
	answer: string;
	incorrect1: string;
	incorrect2: string;
	incorrect3: string;
}
