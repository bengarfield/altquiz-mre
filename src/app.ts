/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { QueryResult } from 'pg';
import pgescape from 'pg-escape';

import ColorMaterials from './colorMaterials';
import Database from './db';
import Menu from './menu';
import PlayerManager from './playerManager';
import QuestionManager from './questionManager';
import Screen from './screen';
import SharedAssets from './sharedAssets';
import { Category, Podium, Question } from './types';

export default class AltQuiz {
	public colors: ColorMaterials;
	public playerManager: PlayerManager;
	public scene: MRE.Actor;
	public screen: Screen;
	public sharedAssets: SharedAssets;
	public db: Database;
	public get playerList() { return this.playerManager.playerList; }

	private gamemode: string;
	private podiumList: Podium[] = [
		{id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
		{id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
		{id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
		{id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
		{id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null}
	];
	private podiumPressed = -1;
	private camera: MRE.Actor = null;
	private currentRound = 0;
	private currentHost: MRE.User = null;
	private categories: {easy: Category[], medium: Category[], hard: Category[]} = {easy: [], medium: [], hard: []};
	private categoryRef: {[id: string]: string} = {};
	private mode = 'title';
	private answerLocked = 0;
	private scoresOnScreen = false;
	public assets: MRE.AssetContainer = new MRE.AssetContainer(this.context);

	public constructor(public context: MRE.Context, public params: MRE.ParameterSet, public baseUrl: string) {
		this.colors = new ColorMaterials(context);
		this.playerManager = new PlayerManager(this);
		this.sharedAssets = new SharedAssets();
		this.db = new Database();

		this.context.onUserJoined(user => this.playerManager.userJoined(user));
		this.context.onUserLeft(user => this.playerManager.userLeft(user));
		this.context.onStarted(() => this.started());
		this.context.onStopped(() => {
			if (this.db) {
				this.db.disconnect().then(() => console.log('db disconnected')).catch();
			}
		});
	}

	private async started() {
		const app = this;
		// console.log(app.params);
		if (app.params.questions !== undefined) {
			const qm = new QuestionManager(this.db);
			await qm.questionManager(app);
			return;
		}
		const colors = this.colors;
		const podiumColors = [
			app.assets.createMaterial('1', {color: {r: 0, g: 0.2, b: 0.5, a: 1}}),
			app.assets.createMaterial('2', {color: {r: 0, g: 0.5, b: 0, a: 1}}),
			app.assets.createMaterial('3', {color: {r: 0.6, g: 0.6, b: 0, a: 1}}),
			app.assets.createMaterial('4', {color: {r: 0.7, g: 0.3, b: 0, a: 1}}),
			app.assets.createMaterial('5', {color: {r: 0.6, g: 0, b: 0, a: 1}})
		];
		const answerColors = [
			app.assets.createMaterial('a', {color: MRE.Color3.White()}),
			app.assets.createMaterial('b', {color: MRE.Color3.White()}),
			app.assets.createMaterial('c', {color: MRE.Color3.White()}),
			app.assets.createMaterial('d', {color: MRE.Color3.White()})
		];
		let extrasEnabled = false;
		let questionAnswered = false;
		let loadedQuestions: QueryResult;
		let currentQuestion = -1;
		let selectedAnswer = -1;
		let podiums: MRE.Actor;
		let hostPodium: MRE.Actor;
		let mainScreen: MRE.Actor;
		let hostScreen: MRE.Actor;

		app.scene = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});

		await this.sharedAssets.load(this.context, this.baseUrl);

		const answerButtonModel = new MRE.AssetContainer(app.context);
		await answerButtonModel.loadGltf(app.baseUrl + '/answerButton.glb', 'mesh');
		const answerButtonModel2 = new MRE.AssetContainer(app.context);
		await answerButtonModel2.loadGltf(app.baseUrl + '/answerButton2.glb');

		const podiumModel = new MRE.AssetContainer(app.context);
		await podiumModel.loadGltf(app.baseUrl + '/podium.glb');
		const podiumButtonModel = new MRE.AssetContainer(app.context);
		await podiumButtonModel.loadGltf(app.baseUrl + '/button.glb', 'mesh');
		const crownModel = new MRE.AssetContainer(app.context);
		await crownModel.loadGltf(app.baseUrl + '/crown.glb');

		if (app.params.big !== undefined) {
			extrasEnabled = true;
			startClassic().catch();
		} else if (app.params.classic !== undefined) {
			startClassic().catch();
		} else {
			const menu = new Menu(this, () => startClassic().catch(), () => startNew().catch());
		}

		async function startNew() {
			app.screen.actor.children[1].appearance.material = app.assets.createMaterial('borderFix', {
				mainTextureId: app.sharedAssets.screenBorderMat.mainTextureId,
				mainTextureOffset: {x: 0.5, y: 0}
			});
			app.gamemode = 'new';
			let timeLeft = 0;
			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 3.2, y: 1.8, z: 0}
				},
				actor: {
					parentId: app.scene.id,
					transform: {local: {
						position: {y: 2}
					}},
					appearance: {
						materialId: colors.black.id
					}
				}
			});
			const roundBeginText1 = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: app.scene.id,
					transform: {local: {
						position: {y: 2.5, z: -0.01}
					}},
					text: {
						height: 0.3,
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						justify: MRE.TextJustify.Center
					}
				}
			});
			const roundBeginText2 = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: app.scene.id,
					transform: {local: {
						position: {y: 2, z: -0.01}
					}},
					text: {
						height: 0.2,
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						justify: MRE.TextJustify.Center
					}
				}
			});
			const roundBeginText3 = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: app.scene.id,
					transform: {local: {
						position: {y: 1.6, z: -0.01}
					}},
					text: {
						height: 0.2,
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						justify: MRE.TextJustify.Center
					}
				}
			});
			mainScreen = createScreen(app.scene, {
				position: {y: 2, z: -0.04},
				scale: MRE.Vector3.One().scale(0.0001)
			});
			const letters = ['A', 'B', 'C', 'D'];
			for (let i = 0; i < 4; i ++) {
				mainScreen.findChildrenByName(`answer${i}Button`, true)[0].setBehavior(MRE.ButtonBehavior).onButton("pressed", (user: MRE.User) => {
					for (const p of app.playerList) {
						if (p.id === user.id) {
							if (!p.answered) {
								p.answered = true;
								p.answer = i;
								p.timeToAnswer = timeLeft;
								p.icon.appearance.material = colors.yellow;
								user.groups.clear();
								user.groups.add(`answered${letters[i]}`);
							}
						}
					}
				});
			}

			const numOfQs = 5;

			const timeText = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'time',
					parentId: app.scene.id,
					transform: {local: {
						position: {x: 1.5, y: 1.28, z: -0.01}
					}},
					text: {
						contents: '',
						height: 0.2
					}
				}
			});
			let currentRound = 0;
			startRound(app.categories.easy, 'easy', numOfQs).catch();
			async function startRound(catList: Category[], diff: string, questions: number) {
				shuffleArray(catList);
				currentRound++;
				currentQuestion = -1;
				roundBeginText1.text.contents = `Round ${currentRound}: ${diff.charAt(0).toUpperCase() + diff.substr(1, diff.length - 1)}`;
				roundBeginText3.text.contents = `${questions} Question${questions > 1 ? 's' : ''}`;
				let clickTime = (Math.random() * 45) + 5;
				let count = 0;
				const tick = async () => {
					playSound('click');
					roundBeginText2.text.contents = catList[count].name;
					// console.log(count, clickTime);
					if (clickTime > 1000) {
						playSound('correct');
						console.log(catList[count]);
						const sql = pgescape(`SELECT * FROM questionsTest WHERE categoryId = ${catList[count].id} AND difficulty = %L ORDER BY RANDOM() LIMIT ${questions}`, diff);
						console.log(sql);
						loadedQuestions = await app.db.query(sql);
						for (let i = 0; i < numOfQs; i++) {
							loadedQuestions.rows[i].question = `${i + 1}: ${loadedQuestions.rows[i].question}`;
						}
						app.removeCategory(catList[count].id);
						time(5, 'start');
					} else {
						if (count === app.categories.easy.length - 1) {
							count = -1;
						}
						count++;
						clickTime *= 1.2;
						setTimeout(tick, clickTime);
					}
				};
				setTimeout(tick, clickTime);
			}
			function time(count: number, next: string) {
				if (next === 'reveal') {
					setTimeout(() => {
						playSound('ticktock');
					}, (count - 3) * 1000);
				}
				timeLeft = count;
				const timer = setInterval(() => {
					if (next === 'reveal') {
						// app.sharedAssets.screenBorderMat.mainTextureOffset.set(-0.497 * ((count - timeLeft) / count), 0);
						app.screen.actor.children[1].appearance.material.mainTextureOffset.set(-0.5 * ((count - timeLeft) / count), 0);
						timeText.text.contents = timeLeft.toString().substr(0, 3);
					} else if (next !== 'scores') {
						// app.sharedAssets.screenBorderMat.mainTextureOffset.set(-0.497 * ((count - timeLeft) / count) - 0.5, 0);
						app.screen.actor.children[1].appearance.material.mainTextureOffset.set(-0.5 * ((count - timeLeft) / count) - 0.5, 0);
					}
					timeLeft -= 0.05;
					if (timeLeft <= 0) {
						clearInterval(timer);
						timeText.text.contents = '';
						if (next === 'start') {
							roundBeginText1.text.contents = '';
							roundBeginText2.text.contents = '';
							roundBeginText3.text.contents = '';
							const questionText = wrapText(loadedQuestions.rows[0].question, 30);
							let textHeight = 0.2;
							if (questionText.lines > 3) {
								for (let i = 0; i < questionText.lines - 3; i++) {
									textHeight -= 0.025;
								}
							}
							mainScreen.findChildrenByName('question', true)[0].text.contents = questionText.text;
							mainScreen.findChildrenByName('question', true)[0].text.height = textHeight;
							mainScreen.transform.local.scale.setAll(1);
							time(0, 'next');
						} else if (next === 'reveal') {
							revealAnswer();
							playSound('buzz');
							if (currentQuestion !== numOfQs - 1) {
								time(5, 'next');
							} else {
								time(3, 'scores');
							}
						} else if (next === 'next') {
							currentQuestion++;
							displayQuestion(loadedQuestions.rows[currentQuestion]);
							timeText.text.contents = '10';
							setTimeout(() => {
								time(10, 'reveal');
							}, 2000);
						} else if (next === 'scores') {
							showScores();
							setTimeout(() => {
								let nextButton: MRE.Actor;
								if (app.categories.hard.length > 0) {
									nextButton = MRE.Actor.CreateFromPrefab(app.context, {
										prefabId: app.sharedAssets.sqaureButton.id,
										actor: {
											parentId: app.scene.id,
											name: 'nextButton',
											transform: {local: {
												position: {x: 1.55, y: 1.8, z: -0.001}
											}}
										}
									});
									nextButton.created().then(() => {
										nextButton.findChildrenByName('inner', false)[0].appearance.material = app.sharedAssets.back;
										nextButton.findChildrenByName('inner', false)[0].transform.local.scale.x *= -1;
									}).catch();
									MRE.Actor.CreateEmpty(app.context, {
										actor: {
											parentId: nextButton.id,
											transform: {local: {
												position: {y: -0.22}
											}},
											text: {
												contents: 'Next Round',
												height: 0.1,
												anchor: MRE.TextAnchorLocation.MiddleCenter
											}
										}
									});
									nextButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
										if (app.playerManager.isMod(user)) {
											for (const p of app.playerList) {
												p.icon.findChildrenByName('scoreBar', true)[0].destroy();
												p.icon.findChildrenByName('scoreText', true)[0].destroy();
												p.icon.findChildrenByName('nameText', true)[0].destroy();
											}
											let difficulty = 'easy';
											let catList = app.categories.easy;
											if (currentRound > 9) {
												difficulty = 'hard';
												catList = app.categories.hard;
											} else if (currentRound > 4) {
												difficulty = 'medium';
												catList = app.categories.medium;
											}
											startRound(catList, difficulty, numOfQs).catch();
											nextButton.destroy();
											endButton.destroy();
										}
									});
								}
								const endButton = MRE.Actor.CreateFromPrefab(app.context, {
									prefabId: app.sharedAssets.sqaureButton.id,
									actor: {
										parentId: app.scene.id,
										name: 'endButton',
										transform: {local: {
											position: {x: 1.55, y: 1.25, z: -0.001}
										}}
									}
								});
								MRE.Actor.CreateEmpty(app.context, {
									actor: {
										parentId: endButton.id,
										transform: {local: {
											position: {y: -0.22}
										}},
										text: {
											contents: 'End Game',
											height: 0.1,
											anchor: MRE.TextAnchorLocation.MiddleCenter
										}
									}
								});
								let endClicked = false;
								endButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
									if (app.playerManager.isMod(user)) {
										if (!endClicked) {
											for (const p of app.playerList) {
												p.icon.findChildrenByName('scoreBar', true)[0].destroy();
												p.icon.findChildrenByName('scoreText', true)[0].destroy();
												p.icon.findChildrenByName('nameText', true)[0].destroy();
											}
											let winner = app.playerList[0];
											for (const p of app.playerList) {
												if (p.score > winner.score) {
													winner = p;
												}
											}
											console.log(`Winner: ${winner.name}`);
											roundBeginText2.text.height = 0.3;
											roundBeginText2.text.contents = `Winner: ${winner.name}`;
											giveCrown(winner.id);
											if (app.categories.hard.length > 0) {
												nextButton.destroy();
											}
											endButton.children[0].text.contents = 'Back to Menu';
											endClicked = true;
										} else {
											app.playerManager.playerList = [];
											app.scene.destroy();
											app.scene = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});
											soundPlayer = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
											app.screen = new Screen(app, app.scene);
											const menu = new Menu(app, () => startClassic(), () => startNew());
										}
									}
								});
							}, 3000);
						}
					}
				}, 50);
			}
		}
		async function startClassic() {
			if (app.screen) {
				app.screen.unload();
			}
			app.gamemode = 'classic';
			for (const u of app.context.users) {
				u.groups.clear();
				u.groups.add('notJoined');
			}
			if (extrasEnabled) {
				app.scene.transform.local.position = new MRE.Vector3(0, 0, 7);
			} else {
				app.scene.transform.local.position = new MRE.Vector3(0, -0.25, 0);
				MRE.Actor.CreateFromPrefab(app.context, {
					prefabId: app.sharedAssets.screen.id,
					actor: {
						parentId: app.scene.id,
						name: 'screenModel',
						transform: {local: {
							position: {y: 4.5, z: 1.5},
							rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 180 * MRE.DegreesToRadians)
						}}
					}
				});
				app.sharedAssets.screenBorderMat.mainTextureOffset.set(0, 0);
				app.sharedAssets.screenBorderMat.color = colors.black.color;
			}
			podiums = await MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: app.scene.id,
					name: 'podiums',
					transform: {
						local: {
							position: {x: -1.6, y: 0.06, z: -1},
							rotation: MRE.Quaternion.FromEulerAngles(0, -45 * MRE.DegreesToRadians, 0)
						}
					}
				}
			});
			hostPodium = await MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: app.scene.id,
					name: 'hostPodium',
					transform: {local: {
						position: {x: 2.3, z: -1},
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), -95 * MRE.DegreesToRadians)
					}}
				}
			});

			// Create podiums
			for (let i = 0; i < 5; i++) {
				createPodium(i, {position: {x: 1.6 - (i * 0.8), y: 0.19}}).catch();
			}
			mainScreen = createScreen(app.scene, {
				position: extrasEnabled ? {x: -2.3, y: 3.5, z: 1.81} : {y: 4.5, z: 1.44},
				scale: extrasEnabled ? {x: 1, y: 1, z: 1} : {x: 2.2, y: 2.2, z: 2.2}
			});
			await createHostPodium();
			hostScreen = hostPodium.findChildrenByName('main', true)[0];
			for (let i = 0; i < 4; i ++) {
				hostScreen.findChildrenByName(`answer${i}Button`, true)[0].setBehavior(MRE.ButtonBehavior).onButton("pressed", (user: MRE.User) => {
					if (app.podiumPressed !== -1 || app.mode === 'category') {
						if (user.id === app.currentHost.id && !questionAnswered && app.answerLocked !== 2) {
							if (app.podiumPressed !== -1) {
								if (app.podiumList[app.podiumPressed].screen.findChildrenByName('confirm', true).length !== 0) {
									app.podiumList[app.podiumPressed].screen.findChildrenByName('confirm', true)[0].destroy();
									selectedAnswer = -1;
									currentSelected = -1;
								}
							}
							selectedAnswer = selectAnswer(i, true, false);
							if (selectedAnswer === -1) {
								app.answerLocked = 0;
							} else {
								app.answerLocked = 1;
							}
						}
					}
				});
			}
			// let questionsLoaded = false;

			app.getCategories().catch();

			// set up cameras
			if (extrasEnabled) {
				MRE.Actor.CreateFromLibrary(app.context, {
					resourceId: 'artifact:1133003364485824632',
					actor: {
						parentId: app.scene.id,
						transform: {
							local: {
								position: {x: 0, y: 4.75, z: 1.82},
								scale: {x: 4.85, y: 4.85, z: 4.85}
							}
						}
					}
				});
				app.camera = await MRE.Actor.CreateFromLibrary(app.context, {
					resourceId: 'artifact:1133153428512440970',
					actor: {
						parentId: podiums.id,
						transform: {
							local: {
								position: {x: 0, y: 1.75, z: -2.5}
							}
						}
					}
				});
			}
		}

		function moveCamera(dest: number, cam: MRE.Actor) {
			if (extrasEnabled) {
				if (dest === -1) {
					cam.animateTo({
						transform: {
							local: {
								position: {x: 0, y: 1.75, z: -2.5}
							}
						}
					}, 1, MRE.AnimationEaseCurves.EaseOutQuadratic);
				} else {
					cam.animateTo({
						transform: {
							local: {
								position: {x: 1.6 - (dest * 0.8), y: 1.6, z: -0.7}
							}
						}
					}, 1, MRE.AnimationEaseCurves.EaseOutQuadratic);
				}
			}
		}

		function leaveGame(pod: Podium) {
			if (pod.id !== null) {
				if (app.context.user(pod.id)) {
					app.context.user(pod.id).groups.add('notJoined');
					pod.leaveButton.destroy();
				}
				pod.id = null;
				pod.name.text.contents = '';
				pod.score.text.contents = '';
				pod.scoreVal = 0;
				pod.joinButton.transform.local.position.y = 2;
				resetScreen(pod.screen);
				updateScores();
			}
		}
		function clearHost() {
			app.currentHost = null;
			hostPodium.findChildrenByName('hostJoinText', true)[0].text.contents = 'Host: None';
			hostPodium.findChildrenByName('hostJoinButton', true)[0].appearance.materialId = colors.green.id;
		}

		function resetGame() {
			for (const pod of app.podiumList) {
				leaveGame(pod);
			}
			hideScores();
			clearHost();
			showLogo();
			app.mode = 'title';
			selectAnswer(-1, true, false);
			app.getCategories().catch();
		}

		function giveCrown(userId: string) {
			const crownC = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'crown',
					attachment: {
						userId: userId,
						attachPoint: 'spine-top'
					},
					transform: {local: {
						position: {y: 0.5}
					}}
				}
			});
			const crown = MRE.Actor.CreateFromPrefab(app.context, {
				prefabId: crownModel.prefabs[0].id,
				actor: {
					parentId: crownC.id,
					transform: {local: {
						scale: {x: 0.15, y: 0.15, z: 0.15},
					}}
				}
			});
			crown.createAnimation('spin', {
				keyframes: [{
					time: 0,
					value: {transform: {local: {rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 0)}}}
				}, {
					time: 0.5,
					value: {transform: {local: {rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 180 * MRE.DegreesToRadians)}}}
				}, {
					time: 1,
					value: {transform: {local: {rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 360 * MRE.DegreesToRadians)}}}
				}],
				wrapMode: MRE.AnimationWrapMode.Loop,
				initialState: {
					enabled: true,
					speed: 0.025
				}
			});
			crown.createAnimation('hover', {
				keyframes: [{
					time: 0,
					value: {transform: {local: {position: {y: 0}}}}
				}, {
					time: 0.5,
					value: {transform: {local: {position: {y: 0.025}}}}
				}, {
					time: 1,
					value: {transform: {local: {position: {y: 0.05}}}}
				}],
				wrapMode: MRE.AnimationWrapMode.PingPong,
				initialState: {
					enabled: true,
					speed: 0.1
				}
			});
		}

		function assignMat(actor: MRE.Actor, mat: MRE.Material) {
			actor.appearance.material = mat;
			actor.children.forEach(c => assignMat(c, mat));
		}
		function assignColor(actor: MRE.Actor, color: string) {
			if (color === 'green') {
				actor.appearance.material.color.set(0, 1, 0, 0);
			}
			actor.children.forEach(c => assignColor(c, color));
		}
		function checkIfJoined(list: any, id: string) {
			let bool = false;
			for (let i = 0; i < 5; i++) {
				if (list[i].id === id) {
					bool = true;
				}
			}
			return bool;
		}

		async function createPodium(num: number, transform: Partial<MRE.TransformLike>) {
			const pod = app.podiumList[num];
			const root = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: `podium ${num + 1}`,
					parentId: podiums.id,
					transform: {
						local: transform
					}
				}
			});
			pod.model = MRE.Actor.CreateFromPrefab(app.context, {
				prefabId: podiumModel.prefabs[0].id,
				actor: {
					parentId: root.id,
					transform: {local: {
						position: {y: 0.1}
					}}
				}
			});
			await pod.model.created();
			pod.model.findChildrenByName('base', true)[0].appearance.material = podiumColors[num];
			setStripes(num, 'black');
			pod.joinButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Sphere,
					dimensions: {x: 0.5, y: 0.5, z: 0.5}
				},
				addCollider: true,
				actor: {
					parentId: root.id,
					name: 'joinButton',
					transform: {
						local: {
							position: {x: 0, y: 2, z: 0}
						}
					},
					appearance: {
						enabled: new MRE.GroupMask(app.context, ['notJoined']),
						materialId: podiumColors[num].id
					}
				}
			});
			pod.joinButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
				if (!checkIfJoined(app.podiumList, user.id)) {
					pod.joinButton.transform.local.position.y = -1;
					pod.id = user.id;
					pod.name.text.contents = user.name.length < 10 ? user.name : user.name.substr(0, 10) + '...';
					pod.score.text.contents = '0';
					user.groups.delete('notJoined');
					pod.leaveButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
						definition: {
							shape: MRE.PrimitiveShape.Sphere,
							dimensions: {x: 0.05, y: 0.05, z: 0.05}
						},
						addCollider: true,
						actor: {
							exclusiveToUser: user.id,
							parentId: root.id,
							name: 'leaveButton',
							transform: {
								local: {
									position: {x: 0, y: 1, z: 0.235}
								}
							},
							appearance: {
								materialId: colors.red.id
							}
						}
					});
					pod.leaveButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', () => {
						leaveGame(pod);
					});
					loadScreen(pod.screen);
					updateScores();
				}
			});
			pod.screen = createScreen(root, {
				position: {x: 0, y: 1.52, z: -0.25},
				scale: {x: 0.2, y: 0.2, z: 0.2},
				rotation: MRE.Quaternion.FromEulerAngles(20 * MRE.DegreesToRadians, 180 * MRE.DegreesToRadians, 0)
			});

			MRE.Actor.CreateFromPrefab(app.context, {
				prefabId: app.sharedAssets.screen.id,
				actor: {
					parentId: pod.screen.id,
					name: 'screenModel',
					transform: {local: {
						position: {z: 0.023},
						scale: {x: 0.45, y: 0.45, z: 0.45},
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 180 * MRE.DegreesToRadians)
					}}
				}
			});

			let confirmButton: MRE.Actor = null;
			for (let x = 0; x < 4; x ++) {
				pod.screen.findChildrenByName(`answer${x}Button`, true)[0].setBehavior(MRE.ButtonBehavior).onButton("pressed", user => {
					if (app.podiumPressed !== -1) {
						if (user.id === app.podiumList[app.podiumPressed].id && !questionAnswered && app.answerLocked === 0) {
							selectedAnswer = selectAnswer(x, false, false);
							if (selectedAnswer > -1 && pod.screen.findChildrenByName('confirm', true).length === 0) {
								confirmButton = createConfirmButton(pod.screen, user);

								confirmButton.setBehavior(MRE.ButtonBehavior).onButton("pressed", (user3: MRE.User) => {
									selectAnswer(selectedAnswer, false, true);
									app.answerLocked = 2;
									confirmButton.destroy();
								});
							} else if (selectedAnswer === -1) {
								confirmButton.destroy();
							}
						}
					}
				});
			}

			const score = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'score',
					parentId: root.id,
					transform: {
						local: {
							position: {x: 0, y: 1, z: -0.24},
							rotation: MRE.Quaternion.FromEulerAngles(-8 * MRE.DegreesToRadians, 0, 0)
						}
					},
					text: {
						contents: '',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						color: {r: 0, g: 0, b: 0},
						height: 0.25
					}
				}
			});
			pod.score = score;
			const name = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'name',
					parentId: root.id,
					transform: {
						local: {
							position: {x: 0, y: 1.225, z: -0.27},
							rotation: MRE.Quaternion.FromEulerAngles(-8 * MRE.DegreesToRadians, 0, 0)
						}
					},
					text: {
						contents: '',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						color: {r: 0, g: 0, b: 0},
						height: 0.075
					}
				}
			});
			pod.name = name;
			const buttonModel = MRE.Actor.CreateFromPrefab(app.context, {
				prefabId: podiumButtonModel.prefabs[0].id,
				actor: {
					parentId: root.id,
					transform: {
						local: {
							position: {x: 0, y: .1, z: 0},
							scale: {x: .5, y: .5, z: .5},
							rotation: MRE.Quaternion.FromEulerAngles(0, -90 * MRE.DegreesToRadians, 0)
						}
					}
				}
			});
			await buttonModel.created();
			assignMat(buttonModel, colors.darkRed);
			pod.button = buttonModel;
			const buttonBackup = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 0.3, y: 0.05, z: 0.35}
				},
				addCollider: true,
				actor: {
					parentId: root.id,
					transform: {
						local: {
							position: {x: 0, y: 1.245, z: -.045},
							rotation: MRE.Quaternion.FromEulerAngles(0, -90 * MRE.DegreesToRadians, -18.45 * MRE.DegreesToRadians)
						}
					}
				}
			});
			const podButton = buttonModel.setBehavior(MRE.ButtonBehavior);
			podButton.onButton('pressed', (user: MRE.User) => {
				if (app.podiumPressed === -1 && pod.id === user.id && !pod.hasBuzzed && app.mode === 'question') {
					buzz(user);
				}
			});
			const podButton2 = buttonBackup.setBehavior(MRE.ButtonBehavior);
			podButton2.onButton('pressed', (user: MRE.User) => {
				if (app.podiumPressed === -1 && pod.id === user.id && !pod.hasBuzzed && app.mode === 'question') {
					buzz(user);
				}
			});
			function buzz(user: MRE.User) {
				console.log(`Button ${num} pressed.`);
				app.podiumPressed = num;
				pod.hasBuzzed = true;
				for (let x = 0; x < 5; x++) {
					if (app.podiumList[x].id === user.id) {
						assignMat(app.podiumList[x].button, colors.green);
						app.podiumList[x].model.findChildrenByName('panels', true)[0].appearance.material = colors.white;
						app.sharedAssets.screenBorderMat.color = podiumColors[x].color;
					} else {
						assignMat(app.podiumList[x].button, colors.darkRed);
						app.podiumList[x].model.findChildrenByName('panels', true)[0].appearance.material = colors.grey;
					}
				}
				playSound('buzz');
				moveCamera(num, app.camera);
				pod.spotLight.light.color = new MRE.Color3(.3, .3, .3);
				pod.spotLight.light.enabled = true;
				setStripes(num, 'white');
			}

			pod.spotLight = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: root.id,
					name: 'spotLight',
					light: {
						type: 'spot',
						enabled: false,
						intensity: 5
					},
					transform: {local: {
						position: {y: 3, z: -1},
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Right(), 45 * MRE.DegreesToRadians)
					}}
				}
			});
		}

		async function createHostPodium() {
			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Cylinder,
					dimensions: {x: 0.025, y: 1.15, z: 0.025}
				},
				actor: {
					parentId: hostPodium.id,
					transform: {local: {
						position: {y: 0.825}
					}},
					appearance: {
						materialId: colors.black.id
					}
				}
			});

			const screenHolder = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: hostPodium.id,
					name: 'screens',
					transform: {local: {
						position: {y: 1.5},
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Right(), 20 * MRE.DegreesToRadians)
					}}
				}
			});
			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 0.64, y: 0.36, z: 0.01}
				},
				actor: {
					parentId: screenHolder.id,
					transform: {local: {
						position: {z: 0.005}
					}},
					appearance: {
						materialId: colors.black.id
					}
				}
			});
			const screen2 = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screenHolder.id,
					name: 'main'
				}
			});
			createScreen(screen2, {
				position: {z: -0.001},
				scale: {x: 0.2, y: 0.2, z: 0.2}
			});

			const screen1Cont = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screenHolder.id,
					name: 'left',
					transform: {local: {
						position: {x: 0.32, z: 0.01}
					}}
				}
			});
			const screen3Cont = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screenHolder.id,
					name: 'right',
					transform: {local: {
						position: {x: -0.32, z: 0.01}
					}}
				}
			});
			const screen1 = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 3.2, y: 1.8, z: 0}
				},
				actor: {
					parentId: screen1Cont.id,
					transform: {local: {
						position: {x: -0.32},
						scale: {x: 0.2, y: 0.2, z: 0.2}
					}},
					appearance: {
						materialId: colors.black.id
					}
				}
			});
			const screen3 = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 3.2, y: 1.8, z: 0}
				},
				actor: {
					parentId: screen3Cont.id,
					transform: {local: {
						position: {x: 0.32},
						scale: {x: 0.2, y: 0.2, z: 0.2}
					}},
					appearance: {
						materialId: colors.black.id
					}
				}
			});

			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screen1.id,
					name: 'scoreText',
					transform: {local: {
						position: {x: -1.4, y: 0.84, z: -0.01},
					}},
					text: {
						contents: 'Scores',
						height: 0.15
					}
				}
			});
			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .2, y: .2, z: .02}
				},
				addCollider: true,
				actor: {
					parentId: screen1.id,
					transform: {
						local: {
							position: {y: -0.7, z: -.02}
						}
					},
					appearance: {
						materialId: colors.blue.id
					}
				}
			}).setBehavior(MRE.ButtonBehavior).onButton('pressed', async (user: MRE.User) => {
				if (user.id === app.currentHost.id) {
					if (!app.scoresOnScreen) {
						console.log('Show Scroes');
						showScores();
					} else {
						hideScores();
					}
				}
			});
			const hostJoinSphere = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Sphere,
					dimensions: { x: 0.25, y: 0.25, z: 0.25 }
				},
				addCollider: true,
				actor: {
					parentId: hostPodium.id,
					transform: {
						local: {
							position: {y: 2}
						}
					},
					appearance: {
						materialId: colors.darkGrey.id
					}
				}
			});
			hostJoinSphere.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
				if (app.currentHost === null) {
					hostJoinSphere.transform.local.scale.setAll(0);
					app.currentHost = user;
					hostText.text.contents = `Host: ${app.currentHost.name}`;
					hostPodium.findChildrenByName('hostJoinButton', true)[0].appearance.materialId = colors.red.id;
				}
			});

			const hostButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .2, y: .2, z: .02}
				},
				addCollider: true,
				actor: {
					parentId: screen3.id,
					name: 'hostJoinButton',
					transform: {
						local: {
							position: {x: -1, y: -0.6, z: -.02}
						}
					},
					appearance: {
						materialId: colors.green.id
					}
				}
			}).setBehavior(MRE.ButtonBehavior).onButton('pressed', async (user: MRE.User) => {
				if (app.currentHost === null) {
					hostJoinSphere.transform.local.scale.setAll(0);
					app.currentHost = user;
					hostText.text.contents = `Host: ${app.currentHost.name}`;
					hostPodium.findChildrenByName('hostJoinButton', true)[0].appearance.materialId = colors.red.id;
				} else if (app.currentHost.id === user.id || app.playerManager.isMod(user)) {
					clearHost();
					hostJoinSphere.transform.local.scale.setAll(1);
					if (!leftHidden) slideHostPanel('left', 0);
					if (!rightHidden) slideHostPanel('right', 0);
					leftHidden = true;
					rightHidden = true;
				}
			});
			const hostText = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screen3.id,
					name: 'hostJoinText',
					text: {
						contents: 'Host: None',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					},
					transform: {
						local: {
							position: {x: -1, y: -0.4, z: -.02}
						}
					}
				}
			});

			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .2, y: .2, z: .02}
				},
				addCollider: true,
				actor: {
					parentId: screen3.id,
					transform: {
						local: {
							position: {x: -0.25, y: -0.6, z: -.02}
						}
					},
					appearance: {
						materialId: colors.red.id
					}
				}
			}).setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
				if (user.id === app.currentHost.id || app.playerManager.isMod(user)) {
					resetGame();
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screen3.id,
					text: {
						contents: 'Reset All',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					},
					transform: {
						local: {
							position: {x: -0.25, y: -0.4, z: -.02}
						}
					}
				}
			});

			if (app.params.classic === undefined) {
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Box,
						dimensions: {x: .2, y: .2, z: .02}
					},
					addCollider: true,
					actor: {
						parentId: screen3.id,
						transform: {
							local: {
								position: {x: 0.5, y: -0.6, z: -.02}
							}
						},
						appearance: {}
					}
				}).setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
					if (user.id === app.currentHost.id || app.playerManager.isMod(user)) {
						resetGame();
						app.scene.destroy();
						app.scene = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});
						soundPlayer = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
						const menu = new Menu(app, () => startClassic().catch(), () => startNew().catch());
					}
				});
				MRE.Actor.CreateEmpty(app.context, {
					actor: {
						parentId: screen3.id,
						text: {
							contents: 'Back to menu',
							anchor: MRE.TextAnchorLocation.MiddleCenter,
							height: 0.1
						},
						transform: {
							local: {
								position: {x: 0.5, y: -0.4, z: -.02}
							}
						}
					}
				});
			}

			const podButtons = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: screen3.id,
					name: 'podiumButtons',
					transform: {local: {
						position: {x: -1.4, y: 0.5, z: -0.005}
					}}
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: podButtons.id,
					transform: {local: {
						position: {x: 0.2, y: 0.12},
					}},
					text: {
						contents: '-',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					}
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: podButtons.id,
					transform: {local: {
						position: {x: 0.4, y: 0.12},
					}},
					text: {
						contents: '+',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.1
					}
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: podButtons.id,
					transform: {local: {
						position: {x: 0.6, y: 0.12},
					}},
					text: {
						contents: 'Kick',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.05
					}
				}
			});
			for (let i = 0; i < 5; i++) {
				const container = MRE.Actor.CreateEmpty(app.context, {
					actor: {
						parentId: podButtons.id,
						transform: {local: {
							position: {y: i * -0.15}
						}}
					}
				});
				MRE.Actor.CreateEmpty(app.context, {
					actor: {
						parentId: container.id,
						text: {
							contents: (i + 1).toString(),
							height: 0.1,
							justify: MRE.TextJustify.Center,
							anchor: MRE.TextAnchorLocation.MiddleCenter
						}
					}
				});
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Plane,
						dimensions: {x: .8, y: 1, z: .15}
					},
					actor: {
						parentId: container.id,
						transform: {
							local: {
								position: {x: 0.3, z: 0.004},
								rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Right(), -90 * MRE.DegreesToRadians)
							}
						},
						appearance: {
							materialId: podiumColors[i].id
						}
					}
				});
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Box,
						dimensions: {x: .1, y: .1, z: .01}
					},
					addCollider: true,
					actor: {
						parentId: container.id,
						name: '-Button',
						transform: {
							local: {
								position: {x: 0.2}
							}
						}
					}
				}).setBehavior(MRE.ButtonBehavior).onClick((user: MRE.User) => {
					if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
						if (app.podiumList[i].id !== null) {
							app.podiumList[i].scoreVal--;
							app.podiumList[i].score.text.contents = app.podiumList[i].scoreVal.toString();
							updateScores();
						}
					}
				});
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Box,
						dimensions: {x: .1, y: .1, z: .01}
					},
					addCollider: true,
					actor: {
						parentId: container.id,
						name: '+Button',
						transform: {
							local: {
								position: {x: 0.4}
							}
						}
					}
				}).setBehavior(MRE.ButtonBehavior).onClick((user: MRE.User) => {
					if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
						if (app.podiumList[i].id !== null) {
							app.podiumList[i].scoreVal++;
							app.podiumList[i].score.text.contents = app.podiumList[i].scoreVal.toString();
							updateScores();
						}
					}
				});
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Box,
						dimensions: {x: .1, y: .1, z: .01}
					},
					addCollider: true,
					actor: {
						parentId: container.id,
						name: 'kickButton',
						transform: {
							local: {
								position: {x: 0.6}
							}
						}
					}
				}).setBehavior(MRE.ButtonBehavior).onClick((user: MRE.User) => {
					if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
						if (app.podiumList[i].id !== null) {
							leaveGame(app.podiumList[i]);
						}
					}
				});
			}

			const hostButtons = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: hostPodium.id,
					name: 'buttons',
					transform: {local: {
						position: {y: 1.35},
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Left(), 16 * MRE.DegreesToRadians)
					}}
				}
			});
			MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .64, y: 0, z: .2}
				},
				actor: {
					parentId: hostButtons.id,
					name: 'panel',
					transform: {
						local: {
							position: {z: -0.15}
						}
					},
					appearance: {
						materialId: colors.black.id
					}
				}
			});
			const showLeftButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Sphere,
					uSegments: 3,
					dimensions: {x: .025, y: .025, z: .025}
				},
				addCollider: true,
				actor: {
					parentId: hostButtons.id,
					name: 'showLeft',
					transform: {
						local: {
							position: {x: -0.25, z: -0.1},
							rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), -90 * MRE.DegreesToRadians)
						}
					},
					appearance: {
						materialId: colors.blue.id
					}
				}
			});
			let leftHidden = true;
			showLeftButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
				if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
					if (leftHidden) {
						slideHostPanel('left', 1);
					} else {
						slideHostPanel('left', 0);
					}
					leftHidden = !leftHidden;
				}
			});
			const showRightButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Sphere,
					uSegments: 3,
					dimensions: {x: .025, y: .025, z: .025}
				},
				addCollider: true,
				actor: {
					parentId: hostButtons.id,
					name: 'showRight',
					transform: {
						local: {
							position: {x: 0.25, z: -0.1},
							rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 90 * MRE.DegreesToRadians)
						}
					},
					appearance: {
						materialId: colors.blue.id
					}
				}
			});
			let rightHidden = true;
			showRightButton.setBehavior(MRE.ButtonBehavior).onButton('pressed', (user: MRE.User) => {
				if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
					if (rightHidden) {
						slideHostPanel('right', 1);
					} else {
						slideHostPanel('right', 0);
					}
					rightHidden = !rightHidden;
				}
			});
			function slideHostPanel(side: string, state: number) {
				const panel = side === 'left' ? screen1Cont : screen3Cont;
				const button = side === 'left' ? showLeftButton : showRightButton;
				if (state === 1) {
					panel.animateTo({
						transform: {local: {
							position: {x: side === 'left' ? -0.32 : 0.32}
						}}
					}, 1, MRE.AnimationEaseCurves.EaseOutQuadratic);
					setTimeout(() => {
						panel.animateTo({
							transform: {local: {
								position: {z: 0},
								rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), (side === 'left' ? -25 : 25) * MRE.DegreesToRadians)
							}}
						}, 1, MRE.AnimationEaseCurves.EaseInOutQuadratic);
					}, 1000);
					button.transform.local.rotation = MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), (side === 'left' ? 90 : -90) * MRE.DegreesToRadians);
				} else {
					panel.animateTo({
						transform: {local: {
							position: {z: 0.01},
							rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 0)
						}}
					}, 1, MRE.AnimationEaseCurves.EaseInOutQuadratic);
					setTimeout(() => {
						panel.animateTo({
							transform: {local: {
								position: {x: side === 'left' ? 0.32 : -0.32}
							}}
						}, 1, MRE.AnimationEaseCurves.EaseOutQuadratic);
					}, 1000);
					button.transform.local.rotation = MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), (side === 'left' ? -90 : 90) * MRE.DegreesToRadians);
				}
			}
			const resetButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .04, y: .02, z: .04}
				},
				addCollider: true,
				actor: {
					parentId: hostButtons.id,
					name: 'reset',
					transform: {
						local: {
							position: {x: -0.15, z: -0.175}
						}
					},
					appearance: {
						materialId: colors.yellow.id
					}
				}
			});
			const reset = resetButton.setBehavior(MRE.ButtonBehavior);
			reset.onButton('pressed', (user: MRE.User) => {
				if (user.id === app.currentHost.id && app.podiumPressed !== -1) {
					assignMat(app.podiumList[app.podiumPressed].button, colors.darkRed);
					setStripes(app.podiumPressed, 'black');
					if (app.podiumList[app.podiumPressed].screen.findChildrenByName('confirm', true).length !== 0) {
						app.podiumList[app.podiumPressed].screen.findChildrenByName('confirm', true)[0].destroy();
					}
					for (const pod of app.podiumList) {
						if (!pod.hasBuzzed) {
							assignMat(pod.button, colors.red);
						}
						pod.model.findChildrenByName('panels', true)[0].children[0].appearance.material = colors.white;
					}
					app.podiumPressed = -1;
					moveCamera(-1, app.camera);
					selectAnswer(-1, true, false);
					app.sharedAssets.screenBorderMat.color = colors.black.color;
				}
			});
			const nextButton = await MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: .06, y: .02, z: .06}
				},
				addCollider: true,
				actor: {
					parentId: hostButtons.id,
					name: 'next',
					transform: {
						local: {
							position: {x: 0, z: -0.175}
						}
					},
					appearance: {
						materialId: colors.green.id
					}
				}
			});
			const diffs = {0: 'easy', 5: 'medium', 10: 'hard'};
			const next = nextButton.setBehavior(MRE.ButtonBehavior);
			next.onButton('pressed', async (user: MRE.User) => {
				// let catList = app.categories.easy;
				if (app.playerManager.isMod(user) || user.id === app.currentHost.id) {
					if (app.mode === 'title') {
						hideLogo();
						app.currentRound++;
						// tslint:disable-next-line:no-string-literal
						categorySelect(currentDifficulty().cats);
						app.mode = 'category';
					} else if (app.scoresOnScreen) {
						mainScreen.findChildrenByName('scoreText', true)[0].text.contents = '';
						hideScores();
					} else if (app.mode === 'category') {
						if (selectedAnswer !== -1) {
							// Select category and load questions
							console.log(`Load questions for category: ${currentDifficulty().cats[selectedAnswer].name}`);
							loadedQuestions = await app.db.query(pgescape("SELECT * FROM questionsTest WHERE category = %L AND difficulty = %L ORDER BY RANDOM() LIMIT 5", currentDifficulty().cats[selectedAnswer].name, currentDifficulty().diff));
							console.log(loadedQuestions);
							app.removeCategory(currentDifficulty().cats[selectedAnswer].id);
							// app.categories.splice(selectedAnswer, 1);
							app.mode = 'question';
							currentQuestion = 0;
							selectedAnswer = -1;
							app.answerLocked = 0;
							displayQuestion(loadedQuestions.rows[0]);
							for (let i = 0; i < 5; i++) {
								assignMat(app.podiumList[i].button, colors.red);
								app.podiumList[i].hasBuzzed = false;
							}
						} else {
							hideScores();
							categorySelect(currentDifficulty().cats);
						}
					} else if (app.mode === 'question') {
						if (!questionAnswered) {
							const correct = revealAnswer();
							if (app.podiumPressed !== -1) {
								app.podiumList[app.podiumPressed].scoreVal += correct ? 1 : -1;
								app.podiumList[app.podiumPressed].score.text.contents = app.podiumList[app.podiumPressed].scoreVal.toString();
								setStripes(app.podiumPressed, correct ? 'green' : 'red');
								console.log(correct, app.podiumList[app.podiumPressed]);
								playSound(correct ? 'correct' : 'wrong');
								app.podiumList[app.podiumPressed].spotLight.light.color = correct ? MRE.Color3.Green() : MRE.Color3.Red();
							}
							for (let i = 0; i < 5; i++) {
								if (i !== app.podiumPressed) {
									assignMat(app.podiumList[i].button, colors.darkRed);
								}
							}
							if (extrasEnabled) {
								moveCamera(-1, app.camera);
							}
						} else {
							app.podiumPressed = -1;
							app.answerLocked = 0;
							app.sharedAssets.screenBorderMat.color = colors.black.color;
							if (currentQuestion === 4) {
								// Next round
								app.currentRound++;
								app.mode = 'category';
								selectedAnswer = -1;
								categorySelect(currentDifficulty().cats);
								for (let i = 0; i < 5; i++) {
									assignMat(app.podiumList[i].button, colors.darkRed);
									app.podiumList[i].hasBuzzed = true;
								}
							} else {
								// Next question
								currentQuestion++;
								displayQuestion(loadedQuestions.rows[currentQuestion]);
								for (let i = 0; i < 5; i++) {
									assignMat(app.podiumList[i].button, colors.red);
									app.podiumList[i].hasBuzzed = false;
									app.podiumList[i].spotLight.light.enabled = false;
									setStripes(i, 'black');
									app.podiumList[i].model.findChildrenByName('panels', true)[0].appearance.material = colors.white;
								}
							}
						}
						questionAnswered = !questionAnswered;
					}
					updateScores();
				}
			});
		}

		function currentDifficulty(): {diff: string, cats: Category[]} {
			let diff = 'easy';
			let cats = app.categories.easy;
			if (app.currentRound > 10) {
				diff = 'hard';
				cats = app.categories.hard;
			} else if (app.currentRound > 5) {
				diff = 'medium';
				cats = app.categories.medium;
			}
			return {diff: diff, cats: cats};
		}
		function setStripes(pod: number, color: string) {
			let c = null;
			if (color === 'black') {
				c = colors.black;
			} else if (color === 'white') {
				c = colors.white;
			} else if (color === 'green') {
				c = colors.green;
			} else if (color === 'red') {
				c = colors.red;
			}
			app.podiumList[pod].model.findChildrenByName('stripes', true)[0].appearance.material = c;
		}

		function createScreen(parent: MRE.Actor, transform: Partial<MRE.ScaledTransformLike>): MRE.Actor {
			const cont = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: parent.id,
					name: 'screenContainer',
					transform: {
						local: transform
					}
				}
			});
			if (app.gamemode === 'classic') {
				MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Plane,
						dimensions: {x: 3, y: 1, z: 1.5}
					},
					actor: {
						parentId: cont.id,
						name: 'logo',
						transform: {local: {
							rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Right(), -90 * MRE.DegreesToRadians)
						}},
						appearance: {
							materialId: app.sharedAssets.logo.id
						}
					}
				});
			}

			const screen = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'screen',
					parentId: cont.id,
					transform: {
						local: {
							position: {z: 0.03},
							scale: MRE.Vector3.One().scale(app.gamemode === 'classic' ? 0.0001 : 1)
						}
					}
				}
			});

			const scores = MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: cont.id,
					name: 'scoreText',
					transform: {local: {
						position: {x: -1.4, y: 0.84, z: -0.01}
					}},
					text: {
						contents: '',
						height: 0.2
					}
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					name: 'question',
					parentId: screen.id,
					transform: {
							local: {
							position: {x: 0, y: 0.45, z: 0}
						}
					},
					text: {
						contents: 'Question?',
						anchor: MRE.TextAnchorLocation.MiddleCenter,
						height: 0.2,
						justify: MRE.TextJustify.Center
					}
				}
			});
			const letters = ['A:', 'B:', 'C:', 'D:'];
			for (let i = 0; i < 4; i++) {
				const x = i % 2 ? 0.75 : -0.75;
				const y = i > 1 ? -0.6 : -0.2;

				const container = MRE.Actor.CreateEmpty(app.context, {
					actor: {
						name: `answer${i}`,
						parentId: screen.id,
						transform: {
							local: {
								position: {x: x, y: y}
							}
						}
					}
				});
				MRE.Actor.CreateEmpty(app.context, {
					actor: {
						parentId: container.id,
						transform: {
							local: {
								position: {x: -0.6, z: -0.002}
							}
						},
						text: {
							contents: letters[i],
							anchor: MRE.TextAnchorLocation.MiddleLeft,
							height: 0.125,
							justify: MRE.TextJustify.Left
						}
					}
				});
				MRE.Actor.CreateEmpty(app.context, {
					actor: {
						name: `answer${i}Text`,
						parentId: container.id,
						transform: {
							local: {
								position: {x: -0.45, z: -0.002}
							}
						},
						text: {
							contents: '',
							anchor: MRE.TextAnchorLocation.MiddleLeft,
							height: 0.125,
							justify: MRE.TextJustify.Left
						}
					}
				});
				const button = MRE.Actor.CreateFromPrefab(app.context, {
					prefabId: app.sharedAssets.answerButton.id,
					actor: {
						parentId: container.id,
						name: `answer${i}Button`
					}
				});
				button.created().then(() => {
					button.children[1].appearance.material = answerColors[i];
				}).catch();
				if (app.gamemode === 'new') {
					const selectedBorder = MRE.Actor.CreateFromPrefab(app.context, {
						prefabId: answerButtonModel2.prefabs[0].id,
						actor: {
							parentId: container.id,
							name: `answer${i}BorderSelected`,
							transform: {local: {
								position: {z: -0.0005}
							}}
						}
					});
					selectedBorder.created().then(() => {
						selectedBorder.children[0].appearance.enabled = new MRE.GroupMask(app.context, [`answered${letters[i].substr(0, 1)}`]);
						selectedBorder.children[0].appearance.material.color = colors.teal.color;
					}).catch();
				}
			}

			return cont;
		}

		function loadScreen(screen: MRE.Actor) {
			if (app.gamemode === 'classic') {
				screen.findChildrenByName('logo', false)[0].transform.local = mainScreen.findChildrenByName('logo', false)[0].transform.local;
			}
			screen.findChildrenByName('scoreText', false)[0].transform.local = mainScreen.findChildrenByName('scoreText', false)[0].transform.local;
			screen.findChildrenByName('screen', false)[0].transform.local = mainScreen.findChildrenByName('screen', true)[0].transform.local;
			screen.findChildrenByName('question', true)[0].text.contents = mainScreen.findChildrenByName('question', true)[0].text.contents;
			screen.findChildrenByName('question', true)[0].text.height = mainScreen.findChildrenByName('question', true)[0].text.height;
			for (let i = 0; i < 4; i++) {
				screen.findChildrenByName(`answer${i}Text`, true)[0].text.contents = mainScreen.findChildrenByName(`answer${i}Text`, true)[0].text.contents;
				screen.findChildrenByName(`answer${i}Text`, true)[0].text.height = mainScreen.findChildrenByName(`answer${i}Text`, true)[0].text.height;
			}
		}

		function resetScreen(screen: MRE.Actor) {
			screen.findChildrenByName('logo', true)[0].transform.local.position.z = 0;
			screen.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
			screen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
			screen.findChildrenByName('scoreText', false)[0].text.contents = '';
		}

		function categorySelect(categories: any) {
			console.log(`Round: ${app.currentRound}`);
			shuffleArray(categories);
			console.log(categories[0], categories[1], categories[2], categories[3]);
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					pod.screen.findChildrenByName('question', true)[0].text.contents = 'Select category';
					pod.screen.findChildrenByName('question', true)[0].text.height = 0.2;
				}
			}
			hostScreen.findChildrenByName('question', true)[0].text.contents = 'Select category';
			hostScreen.findChildrenByName('question', true)[0].text.height = 0.2;
			mainScreen.findChildrenByName('question', true)[0].text.contents = 'Select category';
			mainScreen.findChildrenByName('question', true)[0].text.height = 0.2;
			for (let i = 0; i < 4; i++) {
				for (const pod of app.podiumList) {
					if (pod.id !== null) {
						const text = pod.screen.findChildrenByName(`answer${i}Text`, true)[0];
						text.text.contents = categories[i].name;
						scaleText(categories[i].name, text);
					}
				}

				const text2 = hostScreen.findChildrenByName(`answer${i}Text`, true)[0];
				text2.text.contents = categories[i].name;
				scaleText(categories[i].name, text2);

				const text3 = mainScreen.findChildrenByName(`answer${i}Text`, true)[0];
				text3.text.contents = categories[i].name;
				scaleText(categories[i].name, text3);
				answerColors[i].color = colors.white.color;
			}
		}

		let currentSelected = -1;
		function selectAnswer(selected: number, isHost: boolean, lock: boolean): number {
			console.log(selected, isHost, lock);
			let color;
			currentSelected = (currentSelected === selected && !lock) ? -1 : selected;
			isHost || lock ? color = colors.teal : color = colors.yellow;

			for (let i = 0; i < 4; i++) {
				answerColors[i].color = (i === currentSelected) ? color.color : colors.white.color;
			}
			return currentSelected;
		}

		let correctAnswer = -1;
		function displayQuestion(question: Question) {
			currentSelected = -1;
			console.log(question.question);
			console.log(question.answer);
			if (app.gamemode === 'new') {
				mainScreen.findChildrenByName('answer0BorderSelected', true)[0].children[0].appearance.material = colors.teal;
				mainScreen.findChildrenByName('answer1BorderSelected', true)[0].children[0].appearance.material = colors.teal;
				mainScreen.findChildrenByName('answer2BorderSelected', true)[0].children[0].appearance.material = colors.teal;
				mainScreen.findChildrenByName('answer3BorderSelected', true)[0].children[0].appearance.material = colors.teal;
				for (const p of app.playerList) {
					setTimeout(() => {
						p.answered = false;
					}, 2000);
					p.answer = null;
					p.icon.appearance.material = colors.white;
					if (app.context.user(p.id)) {
						app.context.user(p.id).groups.clear();
					}
				}
			}

			const questionText = wrapText(question.question, 30);
			let textHeight = 0.2;
			if (questionText.lines > 3) {
				for (let i = 0; i < questionText.lines - 3; i++) {
					textHeight -= 0.025;
				}
			}
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					pod.screen.findChildrenByName('question', true)[0].text.contents = questionText.text;
					pod.screen.findChildrenByName('question', true)[0].text.height = textHeight;
				}
			}
			if (app.gamemode === 'classic') {
				hostScreen.findChildrenByName('question', true)[0].text.contents = questionText.text;
				hostScreen.findChildrenByName('question', true)[0].text.height = textHeight;
			}
			mainScreen.findChildrenByName('question', true)[0].text.contents = questionText.text;
			mainScreen.findChildrenByName('question', true)[0].text.height = textHeight;

			const answers = [question.answer, question.incorrect1, question.incorrect2, question.incorrect3];
			shuffleArray(answers);
			correctAnswer = answers.indexOf(question.answer);

			for (let i = 0; i < 4; i++) {
				for (const pod of app.podiumList) {
					if (pod.id !== null) {
						const text = pod.screen.findChildrenByName(`answer${i}Text`, true)[0];
						text.text.contents = answers[i];
						scaleText(answers[i], text);
					}
				}

				if (app.gamemode === 'classic') {
					const text2 = hostScreen.findChildrenByName(`answer${i}Text`, true)[0];
					text2.text.contents = answers[i];
					scaleText(answers[i], text2);
				} else if (app.gamemode === 'new') {
					mainScreen.findChildrenByName(`answer${i}Text`, true)[0].text.contents = '';
				}

				answerColors[i].color = colors.white.color;

				setTimeout(() => {
					const answerText = wrapText(answers[i], 20);
					let answerHeight = 0.125;
					if (answerText.lines > 1) {
						for (let x = 0; x < answerText.lines - 1; x++) {
							answerHeight -= 0.025;
						}
					}
					const text3 = mainScreen.findChildrenByName(`answer${i}Text`, true)[0];
					text3.text.contents = answerText.text;
					text3.text.height = answerHeight;
					answerColors[i].color = colors.white.color;
				}, app.gamemode === 'new' ? 2000 : 0);
			}
			console.log(answers, correctAnswer);
		}

		function revealAnswer(): boolean {
			for (let i = 0; i < 4; i++) {
				let color: MRE.Material = colors.white;
				if (i === correctAnswer) {
					color = colors.green;
				} else if (i === currentSelected) {
					color = colors.red;
				}
				answerColors[i].color = color.color;
			}

			if (app.gamemode === 'new') {
				mainScreen.findChildrenByName('answer0BorderSelected', true)[0].children[0].appearance.material = colors.red;
				mainScreen.findChildrenByName('answer1BorderSelected', true)[0].children[0].appearance.material = colors.red;
				mainScreen.findChildrenByName('answer2BorderSelected', true)[0].children[0].appearance.material = colors.red;
				mainScreen.findChildrenByName('answer3BorderSelected', true)[0].children[0].appearance.material = colors.red;
				for (const p of app.playerList) {
					if (p.answered) {
						if (p.answer === correctAnswer) {
							p.score += 100 + Math.round(p.timeToAnswer * 10);
							console.log(`Correct. Bonus: ${Math.round(p.timeToAnswer * 10)}`);
							p.icon.appearance.material = colors.green;
							app.context.user(p.id).groups.clear();
						} else {
							p.score -= 100;
							p.icon.appearance.material = colors.red;
						}
						const scoreText = MRE.Actor.CreateEmpty(app.context, {
							actor: {
								parentId: p.icon.id,
								name: 'scoreText',
								transform: {local: {
									position: {y: 0.1}
								}},
								text: {
									contents: p.answer === correctAnswer ? `+${100 + Math.round(p.timeToAnswer * 10)}` : '-100',
									height: 0.075,
									anchor: MRE.TextAnchorLocation.MiddleCenter
								}
							}
						});
						setTimeout(() => {
							scoreText.destroy();
						}, 3000);
					}
				}
			}

			let win = false;
			if (currentSelected === correctAnswer) {
				win = true;
			}
			currentSelected = -1;
			return win;
		}

		function createConfirmButton(screen: MRE.Actor, user: MRE.User): MRE.Actor {
			const button = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
				definition: {
					shape: MRE.PrimitiveShape.Box,
					dimensions: {x: 0.15, y: 0.15, z: 0.02}
				},
				addCollider: true,
				actor: {
					name: 'confirm',
					parentId: screen.id,
					exclusiveToUser: user.id,
					appearance: {
						materialId: colors.green.id
					},
					transform: {local: {
						position: {x: -0.2, y: -0.815}
					}}
				}
			});
			MRE.Actor.CreateEmpty(app.context, {
				actor: {
					parentId: button.id,
					text: {
						contents: '    Confirm',
						height: 0.125,
						anchor: MRE.TextAnchorLocation.MiddleLeft
					}
				}
			});
			return button;
		}

		function updateScores() {
			const scores = [];
			for (const p of app.playerList) {
				console.log(`${p.name}: ${p.score}`);
				scores.push({name: p.name, score: p.score});
			}
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					console.log(`${pod.name.text.contents}: ${pod.scoreVal}`);
					scores.push({name: pod.name.text.contents, score: pod.scoreVal});
				}
			}
			sortByKey(scores, 'score');
			scores.reverse();
			console.log(scores);
			let txt = 'Scores\n\n';
			for (const score of scores) {
				txt += `${scores.indexOf(score) + 1}: ${score.name}  -  ${score.score}\n`;
			}

			if (app.gamemode === 'classic') {
				if (!app.scoresOnScreen) {
					hostPodium.findChildrenByName('scoreText', true)[1].text.contents = txt;
					txt = '';
				} else {
					hostPodium.findChildrenByName('scoreText', true)[1].text.contents = '';
				}
				hostPodium.findChildrenByName('scoreText', true)[0].text.contents = txt;
				mainScreen.findChildrenByName('scoreText', true)[0].text.contents = txt;
			} else if (app.gamemode === 'new') {
				app.scene.findChildrenByName('scoreScreen', true)[0].children[0].text.contents = txt;
			}
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					pod.screen.findChildrenByName('scoreText', true)[0].text.contents = txt;
				}
			}
		}
		function showScores() {
			if (app.gamemode === 'classic') {
				mainScreen.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
				mainScreen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
				hostPodium.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
				hostPodium.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
				for (const pod of app.podiumList) {
					if (pod.id !== null) {
						pod.screen.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
						pod.screen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
					}
				}
				app.scoresOnScreen = true;
				updateScores();
			} else if (app.gamemode === 'new') {
				// mainScreen.destroy();
				mainScreen.transform.local.scale.setAll(0.0001);
				for (const p of app.playerList) {
					p.icon.appearance.material = colors.white;
				}
				newScoreScreen();
			}
		}
		function hideScores() {
			mainScreen.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
			mainScreen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
			if (app.gamemode === 'classic') {
				hostPodium.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
				hostPodium.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
				for (const pod of app.podiumList) {
					if (pod.id !== null) {
						pod.screen.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
						pod.screen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
					}
				}
				app.scoresOnScreen = false;
				updateScores();
			}
		}
		function showLogo() {
			mainScreen.findChildrenByName('logo', true)[0].transform.local.position.z = 0;
			mainScreen.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
			mainScreen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
			hostPodium.findChildrenByName('logo', true)[0].transform.local.position.z = 0;
			hostPodium.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
			hostPodium.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					pod.screen.findChildrenByName('logo', true)[0].transform.local.position.z = 0;
					pod.screen.findChildrenByName('screen', true)[0].transform.local.position.z = 0.02;
					pod.screen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(0.0001);
				}
			}
		}
		function hideLogo() {
			mainScreen.findChildrenByName('logo', true)[0].transform.local.position.z = 0.02;
			mainScreen.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
			mainScreen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
			hostPodium.findChildrenByName('logo', true)[0].transform.local.position.z = 0.02;
			hostPodium.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
			hostPodium.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
			for (const pod of app.podiumList) {
				if (pod.id !== null) {
					pod.screen.findChildrenByName('logo', true)[0].transform.local.position.z = 0.02;
					pod.screen.findChildrenByName('screen', true)[0].transform.local.position.z = 0;
					pod.screen.findChildrenByName('screen', true)[0].transform.local.scale.setAll(1);
				}
			}
		}
		function newScoreScreen() {
			let highScore = 0;
			for (const p of app.playerList) {
				if (p.score > highScore) {
					highScore = p.score;
				}
			}
			for (const p of app.playerList) {
				const scoreVal = p.score > 0 ? p.score : 1;
				const bar = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
					definition: {
						shape: MRE.PrimitiveShape.Box,
						dimensions: {x: 0.1, y: 1, z: 0.001}
					},
					actor: {
						parentId: p.icon.id,
						name: 'scoreBar',
						transform: {local: {
							position: {y: 0.1},
							scale: {y: 0}
						}},
						appearance: {
							materialId: p.icon.findChildrenByName('iconInner', true)[0].appearance.materialId
						}
					}
				});
				bar.animateTo({transform: {local: {
					position: {y: 0.1 + (0.8 * (scoreVal / highScore))},
					scale: {y: 1.6 * (scoreVal / highScore)}
				}}}, 3 * (scoreVal / highScore), MRE.AnimationEaseCurves.Linear);
				setTimeout(() => {
					MRE.Actor.CreateEmpty(app.context, {
						actor: {
							parentId: p.icon.id,
							name: 'scoreText',
							transform: {local: {
								position: {y: 1.6 * (scoreVal / highScore) + 0.175}
							}},
							text: {
								contents: p.score.toString(),
								height: 0.15,
								anchor: MRE.TextAnchorLocation.MiddleCenter,
								color: p.color
							}
						}
					});
					MRE.Actor.CreateEmpty(app.context, {
						actor: {
							parentId: p.icon.id,
							name: 'nameText',
							transform: {local: {
								position: {y: 1.6 * (scoreVal / highScore) + 0.275}
							}},
							text: {
								contents: p.name,
								height: 0.075,
								anchor: MRE.TextAnchorLocation.MiddleCenter,
								color: p.color
							}
						}
					});
					playSound(scoreVal === highScore ? 'correct' : 'buzz', (scoreVal / highScore) - 1);
				}, 3000 * (scoreVal / highScore));
			}
			playSound('rise');
		}

		let soundPlayer = MRE.Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
		const sounds: {[key: string]: MRE.Sound} = {
				buzz: app.assets.createSound('buzz', {uri: app.baseUrl + '/sounds/ding.ogg'}),
				correct: app.assets.createSound('correct', {uri: app.baseUrl + '/sounds/correct.ogg'}),
				wrong: app.assets.createSound('wrong', {uri: app.baseUrl + '/sounds/wrong.ogg'}),
				rise: app.assets.createSound('rise', {uri: app.baseUrl + '/sounds/rise.ogg'}),
				ticktock: app.assets.createSound('tick', {uri: app.baseUrl + '/sounds/ticktock.ogg'}),
				click: app.assets.createSound('click', {uri: app.baseUrl + '/sounds/click.ogg'})
		};
		function playSound(sound: string, pitch = 0) {
			console.log(`Playing sound: ${sound}`);
			soundPlayer.startSound(sounds[sound].id, {
				volume: 0.2,
				doppler: 0,
				rolloffStartDistance: 20,
				pitch: pitch
			});
		}

		function shuffleArray(array: any[]) {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				const temp = array[i];
				array[i] = array[j];
				array[j] = temp;
			}
			return array;
		}
		function sortByKey(array: any[], key: string) {
			return array.sort((a: any, b: any) => {
				const x = a[key]; const y = b[key];
				return ((x < y) ? -1 : ((x > y) ? 1 : 0));
			});
		}
		function scaleText(text: string, actor: MRE.Actor) {
			let height = 0.125;
			if (text.length > 15) {
				for (let i = 15; i < text.length; i++) {
					if (height > 0.05) {
						height -= 0.005;
					}
				}
			}
			actor.text.height = height;
		}
		function wrapText(input: string, lineLength: number): {text: string, lines: number} {
			const words: string[] = input.split(' ');
			let result = '';
			let line = '';
			let lines = 1;

			for (const s of words) {
				const temp = line + ' ' + s;
				if (temp.length > lineLength) {
					result += line + '\n';
					if (s.length > lineLength) {
						const parts = Math.ceil(s.length / lineLength);
						for (let i = 0; i < parts; i++) {
							const part = s.substring(i * lineLength, (i + 1) * lineLength > s.length ? s.length : (i + 1) * lineLength);
							if (part.length < lineLength) {
								line = part;
							} else {
								result += part + '-\n';
							}
							lines++;
						}
					} else {
						line = s;
						lines++;
					}
				} else {
					line = temp;
				}
			}

			result += line;
			return {text: result.substring(1, result.length), lines: lines};
		}
	}

	public async getCategories() {
		const cats = await this.db.query('SELECT DISTINCT categoryid, category FROM questionsTest ORDER BY categoryid');
		const counts = await this.db.query('SELECT categoryid, category, difficulty, count(*) FROM questionsTest GROUP by categoryid, category, difficulty ORDER BY count DESC');
		console.log(cats.rows, cats.rowCount, counts.rows);
		this.categories.easy = [];
		this.categories.medium = [];
		this.categories.hard = [];
		for (const cat of cats.rows) {
			this.categoryRef[cat.categoryid] = cat.category;
		}
		for (const cat of counts.rows) {
			if (Number(cat.count) > 9) {
				if (cat.difficulty === 'easy') {
					this.categories.easy.push({id: cat.categoryid, name: cat.category});
				} else if (cat.difficulty === 'medium') {
					this.categories.medium.push({id: cat.categoryid, name: cat.category});
				} else if (cat.difficulty === 'hard') {
					this.categories.hard.push({id: cat.categoryid, name: cat.category});
				}
			}
		}
		this.removeCategory(10);
		console.log(this.categories);
		console.log(this.categoryRef);
	}

	public removeCategory(catId: number) {
		for (const cat of this.categories.easy) {
			if (cat.id === catId) {
				this.categories.easy.splice(this.categories.easy.indexOf(cat), 1);
			}
		}
		for (const cat of this.categories.medium) {
			if (cat.id === catId) {
				this.categories.medium.splice(this.categories.medium.indexOf(cat), 1);
			}
		}
		for (const cat of this.categories.hard) {
			if (cat.id === catId) {
				this.categories.hard.splice(this.categories.hard.indexOf(cat), 1);
			}
		}
	}
}
