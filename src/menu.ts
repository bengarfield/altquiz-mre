/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import AltQuiz from './app';
import { Player } from './player';
import Screen from './screen';

import convert = require('color-convert');

export default class Menu {
	private assets: MRE.AssetContainer;
	private screen: Screen;
	private root: MRE.Actor;
	private playerIconRoot: MRE.Actor;

	private iconOuter: MRE.Mesh;
	private iconInner: MRE.Mesh;

	private started = false;

	public constructor(
		private app: AltQuiz,
		private onStartClassic: () => void,
		private onStartParty: () => void
	) {
		if (!this.app.screen) {
			this.app.screen = new Screen(this.app, this.app.scene);
		}
		this.app.screen.setBorderProgress(0);
		this.app.screen.setBorderColor(this.app.colors.white.color);
		this.app.screen.actor.transform.local.position.set(0, 2, 0.025);
		this.app.screen.actor.transform.local.scale.setAll(0.5);

		this.assets = new MRE.AssetContainer(this.app.context);

		this.root = MRE.Actor.Create(this.app.context, {
			actor: {
				name: 'menu',
				parentId: this.app.scene.id,
				transform: { local: { position: { y: 2 } } }
			}
		});

		MRE.Actor.CreatePrimitive(this.assets, {
			definition: {
				shape: MRE.PrimitiveShape.Plane,
				dimensions: {x: 2.4, y: 1, z: 1.2}
			},
			actor: {
				name: 'logo',
				parentId: this.root.id,
				transform: {
					local: {
						position: { y: 0.4, z: -0.01 },
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Right(), -90 * MRE.DegreesToRadians)
					}
				},
				appearance: {
					materialId: this.app.sharedAssets.logo.id
				}
			}
		});

		if (this.app.params.party !== undefined) {
			this.createPartyMenu();
		} else {
			this.createDefaultMenu();
		}
	}

	private createDefaultMenu() {
		// create party menu button
		const menuButton1c = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toPartyMenu',
				parentId: this.root.id,
				transform: { local: { position: { y: -0.35, z: -0.001 } } }
			}
		});
		const menuButton1 = MRE.Actor.CreateFromPrefab(this.app.context, {
			prefabId: this.app.sharedAssets.answerButton.id,
			actor: {
				name: 'toPartyMenuButton',
				parentId: menuButton1c.id
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toPartyMenuLabel',
				parentId: menuButton1c.id,
				transform: { local: { position: { y: 0.04, z: -0.005 } } },
				text: {
					contents: 'Party Mode',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.1
				}
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toPartyMenuSublabel',
				parentId: menuButton1c.id,
				transform: { local: { position: { y: -0.06, z: -0.005 } } },
				text: {
					contents: '10+ Players, No Host',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.04
				}
			}
		});

		// create classic mode button
		const menuButton2c = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toClassicMenu',
				parentId: this.root.id,
				transform: {local: {
					position: {y: -0.7, z: -0.001}
				}}
			}
		});
		const menuButton2 = MRE.Actor.CreateFromPrefab(this.app.context, {
			prefabId: this.app.sharedAssets.answerButton.id,
			actor: {
				name: 'toClassicMenuButton',
				parentId: menuButton2c.id
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toClassicMenuLabel',
				parentId: menuButton2c.id,
				transform: { local: { position: { y: 0.04, z: -0.005 } } },
				text: {
					contents: 'Classic Mode',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.1
				}
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'toClassicMenuSubLabel',
				parentId: menuButton2c.id,
				transform: { local: { position: { y: -0.06, z: -0.005 } } },
				text: {
					contents: 'Gameshow Experience. 5 Players, 1 Host',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.04
				}
			}
		});

		menuButton1.setBehavior(MRE.ButtonBehavior).onClick(user => {
			if (this.app.playerManager.isMod(user)) {
				this.clearMenu();
				this.createPartyMenu();
			}
		});

		menuButton2.setBehavior(MRE.ButtonBehavior).onClick(user => {
			if (this.app.playerManager.isMod(user)) {
				this.app.screen.unload();
				this.unload();
				this.onStartClassic();
			}
		});
	}

	private createPartyMenu() {
		// create back button
		if (this.app.params.party === undefined) {
			const backButton = MRE.Actor.CreateFromPrefab(this.app.context, {
				prefabId: this.app.sharedAssets.sqaureButton.id,
				actor: {
					name: 'backButton',
					parentId: this.root.id,
					transform: { local: { position: { x: -1.55, y: 0.7, z: -0.001 } } }
				}
			});
			backButton.created().then(() => {
				backButton.findChildrenByName('inner', false)[0].appearance.material = this.app.sharedAssets.back;
			}).catch();

			backButton.setBehavior(MRE.ButtonBehavior).onClick(user => {
				if (this.app.playerManager.isMod(user)) {
					this.clearMenu();
					this.app.playerManager.playerList = [];
					this.createDefaultMenu();
				}
			});
		}

		// create player join button
		const menuButton1c = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'join',
				parentId: this.root.id,
				transform: { local: { position: { y: -0.35, z: -0.001 } } }
			}
		});
		const menuButton1 = MRE.Actor.CreateFromPrefab(this.app.context, {
			prefabId: this.app.sharedAssets.answerButton.id,
			actor: {
				name: 'joinButton',
				parentId: menuButton1c.id
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'joinButtonLabel',
				parentId: menuButton1c.id,
				transform: {local: {
					position: {y: 0.04, z: -0.005}
				}},
				text: {
					contents: 'Join Game',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.1
				}
			}
		});
		const playerCountLabel = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'playerCount',
				parentId: menuButton1c.id,
				transform: {local: {
					position: {y: -0.06, z: -0.005}
				}},
				text: {
					contents: 'Players joined: 0',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.04
				}
			}
		});

		// create start game button
		const menuButton2c = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'startGame',
				parentId: this.root.id,
				transform: { local: { position: { y: -0.675, z: -0.001 } } }
			}
		});
		const menuButton2 = MRE.Actor.CreateFromPrefab(this.app.context, {
			prefabId: this.app.sharedAssets.answerButton.id,
			actor: {
				name: 'startGameButton',
				parentId: menuButton2c.id
			}
		});
		MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'startGameLabel',
				parentId: menuButton2c.id,
				transform: { local: { position: { z: -0.005 } } },
				text: {
					contents: 'Start Game',
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: 0.1
				}
			}
		});

		// create container for player icons
		this.playerIconRoot = MRE.Actor.CreateEmpty(this.app.context, {
			actor: {
				name: 'playerIcons',
				parentId: this.app.scene.id,
				transform: {local: {
					position: {y: 1.09, z: 0.009}
				}}
			}
		});

		// wire up buttons
		menuButton1.setBehavior(MRE.ButtonBehavior).onClick(user => {
			console.log('join');
			const joined = this.app.playerManager.playerList.some(p => p.id === user.id);
			if (!joined) {
				const color = this.randomColor();
				const icon = this.createPlayerIcon(user.name, user.id, color);
				this.app.playerList.push(new Player(user.id, user.name, icon, color));

				playerCountLabel.text.contents = `Players joined: ${this.app.playerList.length}`;
			}
		});

		menuButton2.setBehavior(MRE.ButtonBehavior).onClick(user => {
			if (this.app.playerManager.isMod(user) && this.app.playerList.length > 0) {
				this.unload();
				this.onStartParty();
				this.started = true;
			}
		});

		// start preloading categories so it's ready once play is clicked
		this.app.getCategories().catch();
	}

	private createPlayerIcon(name: string, id: string, color: MRE.Color3): MRE.Actor {
		// re-layout icons
		let offset = 0.5;
		this.playerIconRoot.transform.local.position.x = this.app.playerList.length * offset * -0.65;
		if (this.app.playerList.length > 5) {
			this.playerIconRoot.transform.local.position.x = -1.75;
			offset = 2.9 / this.app.playerList.length;
			for (let i = 0; i < this.playerIconRoot.children.length; i++) {
				const icon = this.playerIconRoot.children[i];
				icon.transform.local.position.x = i * offset;
			}
		}

		// create border meshes
		if (!this.iconOuter) {
			this.iconOuter = this.app.assets.createCylinderMesh('iconOuter', 0.001, 0.06, 'z');
		}
		if (!this.iconInner) {
			this.iconInner = this.app.assets.createCylinderMesh('iconInner', 0.001, 0.05, 'z');
		}

		// create player icon
		const iconBase = MRE.Actor.Create(this.app.context, {
			actor: {
				name: 'iconOuter',
				parentId: this.playerIconRoot.id,
				transform: { local: { position: { x: this.app.playerList.length * offset, z: -0.01 } } },
				appearance: {
					meshId: this.iconOuter.id,
					materialId: this.app.colors.white.id
				},
				collider: { geometry: { shape: 'auto' } }
			}
		});
		const inner = MRE.Actor.Create(this.app.context, {
			actor: {
				name: 'iconInner',
				parentId: iconBase.id,
				transform: { local: { position: { z: -0.001 } } },
				appearance: {
					meshId: this.iconInner.id,
					materialId: this.app.assets.createMaterial('playerColor', {color: color}).id
				}
			}
		});
		const label = MRE.Actor.Create(this.app.context, {
			actor: {
				name: 'iconLabel',
				parentId: iconBase.id,
				transform: { local: { position: { z: -0.002 } } },
				text: {
					contents: name.substr(0, 1),
					height: 0.075,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					justify: MRE.TextJustify.Center
				}
			}
		});

		// set up hover label
		const hoverLabels: {[id: string]: MRE.Actor} = {};
		const iconHover = iconBase.setBehavior(MRE.ButtonBehavior);
		iconHover.onHover('enter', user => {
			if (hoverLabels[user.id] === undefined) {
				hoverLabels[user.id] = MRE.Actor.CreateEmpty(this.app.context, {
					actor: {
						parentId: iconBase.id,
						exclusiveToUser: user.id,
						transform: { local: { position: { y: -0.09 } } },
						text: {
							contents: name,
							height: 0.04,
							anchor: MRE.TextAnchorLocation.MiddleCenter,
							justify: MRE.TextJustify.Center
						}
					}
				});
			}
		});
		iconHover.onHover('exit', user => {
			if (hoverLabels[user.id] !== undefined) {
				hoverLabels[user.id].destroy();
				delete hoverLabels[user.id];
			}
		});

		iconHover.onButton('pressed', user => {
			if (user.id === id && !this.started) {
				const newColor = this.randomColor();
				inner.appearance.material.color = newColor.toColor4();
				for (const p of this.app.playerList) {
					if (p.id === user.id) {
						p.color = newColor;
					}
				}
			}
		});

		return iconBase;
	}

	private randomColor(): MRE.Color3 {
		// HSL 0-360, 75-100, 20-40
		const rand = convert.hsl.rgb([Math.random() * 360, Math.random() * 25 + 50, Math.random() * 20 + 20]).map(x => x / 255);
		return new MRE.Color3(rand[0], rand[1], rand[2]);
	}

	private clearMenu() {
		while (this.root.children.length) {
			this.root.children[0].destroy();
		}
	}

	private unload() {
		this.root.destroy();
		this.assets.unload();
	}
}
