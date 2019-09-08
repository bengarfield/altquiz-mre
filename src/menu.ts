/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import AltQuiz from './app';
import { Player } from './player';
import Screen from './screen';

export default class Menu {
	private assets: MRE.AssetContainer;
	private screen: Screen;
	private root: MRE.Actor;
	private playerIconRoot: MRE.Actor;

	private iconOuter: MRE.Mesh;
	private iconInner: MRE.Mesh;

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

		this.root = MRE.Actor.CreatePrimitive(this.assets, {
			definition: {
				shape: MRE.PrimitiveShape.Box,
				dimensions: {x: 3.2, y: 1.8, z: 0}
			},
			actor: {
				name: 'menu',
				parentId: this.app.scene.id,
				transform: { local: { position: { y: 2 } } },
				appearance: {
					materialId: this.app.colors.black.id
				}
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
			const backButton = MRE.Actor.CreateFromGltf(this.assets, {
				uri: this.app.baseUrl + '/menuButtonSquare.glb',
				colliderType: 'mesh',
				actor: {
					name: 'backButton',
					parentId: this.root.id,
					transform: { local: { position: { x: -1.55, y: 0.7, z: -0.001 } } }
				}
			});
			MRE.Actor.CreateEmpty(this.app.context, {
				actor: {
					name: 'backButtonLabel',
					parentId: backButton.id,
					transform: {
						local: {
							position: { x: -0.02, z: -0.005 },
							scale: { y: 1.5 }
						}
					},
					text: {
						contents: '<',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					}
				}
			});
			MRE.Actor.CreateEmpty(this.app.context, {
				actor: {
					name: 'backButtonLabel2',
					parentId: backButton.id,
					transform: {
						local: {
							position: { y: 0.002, z: -0.005 },
							scale: { x: 3, y: 1.5 }
						}
					},
					text: {
						contents: '-',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					}
				}
			});

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
				transform: { local: { position: { y: -0.7, z: -0.001 } } }
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
				const icon = this.createPlayerIcon(user.name);
				this.app.playerList.push(new Player(user.id, user.name, icon));
				playerCountLabel.text.contents = `Players joined: ${this.app.playerList.length}`;
			}
		});

		menuButton2.setBehavior(MRE.ButtonBehavior).onClick(user => {
			if (this.app.playerManager.isMod(user) && this.app.playerList.length > 0) {
				this.unload();
				this.onStartParty();
			}
		});

		// start preloading categories so it's ready once play is clicked
		this.app.getCategories().catch();
	}

	private createPlayerIcon(name: string): MRE.Actor {
		// re-layout icons
		let offset = 0.5;
		this.playerIconRoot.transform.local.position.x = this.app.playerList.length * offset * -0.5;
		if (this.app.playerList.length > 7) {
			this.playerIconRoot.transform.local.position.x = -1.75;
			offset = 3.5 / this.app.playerList.length;
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
		MRE.Actor.Create(this.app.context, {
			actor: {
				name: 'iconInner',
				parentId: iconBase.id,
				transform: { local: { position: { z: -0.001 } } },
				appearance: {
					meshId: this.iconInner.id,
					materialId: this.app.colors.black.id
				}
			}
		});
		MRE.Actor.Create(this.app.context, {
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

		return iconBase;
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
