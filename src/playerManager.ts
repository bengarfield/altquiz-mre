/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import AltQuiz from './app';
import { Player } from './player';

export default class PlayerManager {
	public connectedUsers: MRE.User[] = [];
	public currentMod: string;
	public playerList: Player[] = [];

	private assets: MRE.AssetContainer;

	public constructor(public app: AltQuiz) {
		this.assets = new MRE.AssetContainer(this.app.context);
	}

	public userJoined(user: MRE.User) {
		console.log(`user-joined: ${user.name}, ${user.id}`);
		this.connectedUsers.push(user);
		console.log(`Players Connected: ${this.connectedUsers.length}`);
		console.log(this.connectedUsers);
		user.groups.add('notJoined');
		this.checkForMod();
	}

	public userLeft(user: MRE.User) {
		console.log(`user-left: ${user.name}, ${user.id}`);
		this.connectedUsers.splice(this.connectedUsers.findIndex(u => u.id === user.id), 1);
		console.log(`Players Connected: ${this.connectedUsers.length}`);
		this.checkForMod();
	}

	public isMod(user: MRE.User) {
		let appMod = false;
		if (user.properties['altspacevr-roles']) {
			if (user.properties['altspacevr-roles'].includes('moderator')) {
				appMod = true;
			}
		}
		return user.id === this.currentMod || appMod;
	}

	private checkForMod() {
		let mods = 0;
		for (const u of this.connectedUsers) {
			if (u.properties['altspacevr-roles']) {
				if (u.properties['altspacevr-roles'].includes('moderator')) {
					mods++;
				}
			}
		}
		console.log(`${mods} moderators connected.`);
		// if (mods > 0) {
		//     this.currentMod = '';
		// } else if (this.connectedUsers.length > 0) {
		//     this.currentMod = this.connectedUsers[0].id;
		//     console.log(`Moderator is ${this.connectedUsers[0].name}`);
		// }
		if (this.connectedUsers.length > 0) {
			if (this.currentMod !== this.connectedUsers[0].id) {
				this.currentMod = this.connectedUsers[0].id;
				console.log(`Moderator is ${this.connectedUsers[0].name}`);
				this.createModPopup(this.connectedUsers[0].id);
			}
		}
	}

	private createModPopup(userId: string) {
		const prompt = MRE.Actor.CreatePrimitive(this.assets, {
			definition: {
				shape: MRE.PrimitiveShape.Box,
				dimensions: {x: 1, y: 0.5, z: 0}
			},
			actor: {
				exclusiveToUser: userId,
				attachment: {
					userId: userId,
					attachPoint: 'spine-middle'
				},
				transform: {local: {
					position: {y: 0.2, z: 2}
				}},
				appearance: {
					materialId: this.app.colors.black.id
				}
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				parentId: prompt.id,
				transform: {local: {
					position: {y: 0.075, z: -0.001}
				}},
				text: {
					contents: 'You are the new\ngame moderator.',
					justify: MRE.TextJustify.Center,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.075
				}
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				parentId: prompt.id,
				transform: {local: {
					position: {y: -0.21, z: -0.001}
				}},
				text: {
					contents: 'OK',
					justify: MRE.TextJustify.Center,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.0375
				}
			}
		});
		const button = MRE.Actor.CreatePrimitive(this.assets, {
			definition: {
				shape: MRE.PrimitiveShape.Box,
				dimensions: {x: 0.1, y: 0.1, z: 0}
			},
			addCollider: true,
			actor: {
				parentId: prompt.id,
				transform: {local: {
					position: {y: -0.125, z: -0.005}
				}},
				appearance: {
					materialId: this.app.colors.blue.id
				}
			}
		});
		button.setBehavior(MRE.ButtonBehavior).onClick(() => {
			prompt.destroy();
		});
	}
}
