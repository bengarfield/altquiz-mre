/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRESDK from '@microsoft/mixed-reality-extension-sdk';
import {
    Actor,
    AnimationEaseCurves,
    AnimationKeyframe,
    AnimationWrapMode,
    AssetContainer,
    ButtonBehavior,
    Color3,
    Context,
    DegreesToRadians,
    GroupMask,
    Material,
    ParameterSet,
    PrimitiveShape,
    Quaternion,
    ScaledTransformLike,
    TextAnchorLocation,
    TextJustify,
    TransformLike,
    User,
    Vector3
} from '@microsoft/mixed-reality-extension-sdk';
import {QueryResult} from 'pg';
import pgescape from 'pg-escape';
import {loadQuestions, query, questionManager} from './db';

interface Podium {
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
interface Player {
    id: string;
    name: string;
    score: number;
    answered: boolean;
    answer: number;
    timeToAnswer: number;
    screen: Actor;
    icon: Actor;
}
interface Category {
    id: number;
    name: string;
}
interface Question {
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
export default class AltQuiz {
    private connectedUsers: User[] = [];
    private scene: Actor = null;
    private gamemode: string;
    private modIds: [string] = [''];
    private currentMod = '';
    private playerList: Player[] = [];
    private playerIcons: Actor = null;
    private podiumList: Podium[] = [
        {id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
        {id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
        {id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
        {id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null},
        {id: null, name: null, score: null, scoreVal: 0, button: null, hasBuzzed: false, joinButton: null, leaveButton: null, screen: null, spotLight: null, model: null}
    ];
    private podiumPressed = -1;
    private camera: Actor = null;
    private currentRound = 0;
    private currentHost: User = null;
    private categories: {easy: Category[], medium: Category[], hard: Category[]} = {easy: [], medium: [], hard: []};
    private categoryRef: {[id: string]: string} = {};
    private mode = 'title';
    private answerLocked = 0;
    private scoresOnScreen = false;
    private assets: AssetContainer = new AssetContainer(this.context);

    constructor(private context: Context, private params: ParameterSet, private baseUrl: string) {
        this.context.onUserJoined(user => this.userJoined(user));
        this.context.onUserLeft(user => this.userLeft(user));
        this.context.onStarted(() => this.started());
    }

    private userJoined(user: MRESDK.User) {
        console.log(`user-joined: ${user.name}, ${user.id}`);
        this.connectedUsers.push(user);
        console.log(`Players Connected: ${this.connectedUsers.length}`);
        console.log(this.connectedUsers);
        user.groups.add('notJoined');
        this.checkForMod();
    }

    private userLeft(user: MRESDK.User) {
        console.log(`user-left: ${user.name}, ${user.id}`);
        for (const u of this.connectedUsers) {
            if (u.id === user.id) {
                this.connectedUsers.splice(this.connectedUsers.indexOf(u), 1);
            }
        }
        console.log(`Players Connected: ${this.connectedUsers.length}`);
        this.checkForMod();
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
        const prompt = Actor.CreatePrimitive(this.context, {
            definition: {
                shape: PrimitiveShape.Box,
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
                    materialId: this.assets.createMaterial('black', {color: Color3.Black()}).id
                }
            }
        });
        Actor.CreateEmpty(this.context, {
            actor: {
                parentId: prompt.id,
                transform: {local: {
                    position: {y: 0.075, z: -0.001}
                }},
                text: {
                    contents: 'You are the new\ngame moderator.',
                    justify: TextJustify.Center,
                    anchor: TextAnchorLocation.MiddleCenter,
                    height: 0.075
                }
            }
        });
        Actor.CreateEmpty(this.context, {
            actor: {
                parentId: prompt.id,
                transform: {local: {
                    position: {y: -0.21, z: -0.001}
                }},
                text: {
                    contents: 'OK',
                    justify: TextJustify.Center,
                    anchor: TextAnchorLocation.MiddleCenter,
                    height: 0.0375
                }
            }
        });
        const button = Actor.CreatePrimitive(this.context, {
            definition: {
                shape: PrimitiveShape.Box,
                dimensions: {x: 0.1, y: 0.1, z: 0}
            },
            addCollider: true,
            actor: {
                parentId: prompt.id,
                transform: {local: {
                    position: {y: -0.125, z: -0.005}
                }},
                appearance: {
                    materialId: this.assets.createMaterial('blue', {color: Color3.Blue()}).id
                }
            }
        });
        button.setBehavior(ButtonBehavior).onButton('pressed', () => {
            prompt.destroy();
        });
    }

    private started = async () => {
        const app = this;
        // console.log(app.params);
        if (app.params.questions !== undefined) {
            await questionManager(app);
            return;
        }
        const colors = {
            black: app.assets.createMaterial('black', {color: Color3.Black()}),
            blue: app.assets.createMaterial('black', {color: Color3.Blue()}),
            darkGrey: app.assets.createMaterial('grey', {color: new Color3(0.2, 0.2, 0.2)}),
            green: app.assets.createMaterial('green', {color: Color3.Green()}),
            grey: app.assets.createMaterial('grey', {color: new Color3(0.4, 0.4, 0.4)}),
            red: app.assets.createMaterial('red', {color: new Color3(0.6, 0, 0)}),
            darkRed: app.assets.createMaterial('darkRed', {color: new Color3(0.2, 0, 0)}),
            teal: app.assets.createMaterial('black', {color: Color3.Teal()}),
            white: app.assets.createMaterial('black', {color: Color3.White()}),
            yellow: app.assets.createMaterial('green', {color: Color3.Yellow()})
        };
        const podiumColors = [
            app.assets.createMaterial('1', {color: {r: 0, g: 0.2, b: 0.5, a: 1}}),
            app.assets.createMaterial('2', {color: {r: 0, g: 0.5, b: 0, a: 1}}),
            app.assets.createMaterial('3', {color: {r: 0.6, g: 0.6, b: 0, a: 1}}),
            app.assets.createMaterial('4', {color: {r: 0.7, g: 0.3, b: 0, a: 1}}),
            app.assets.createMaterial('5', {color: {r: 0.6, g: 0, b: 0, a: 1}})
        ];
        const answerColors = [
            app.assets.createMaterial('a', {color: Color3.White()}),
            app.assets.createMaterial('b', {color: Color3.White()}),
            app.assets.createMaterial('c', {color: Color3.White()}),
            app.assets.createMaterial('d', {color: Color3.White()})
        ];
        let extrasEnabled = false;
        let questionAnswered = false;
        let loadedQuestions: QueryResult;
        let currentQuestion = -1;
        let selectedAnswer = -1;
        let podiums: Actor;
        let hostPodium: Actor;
        let mainScreen: Actor;
        let hostScreen: Actor;

        app.scene = Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});

        const screenModel = new AssetContainer(app.context);
        await screenModel.loadGltf(app.baseUrl + '/screen.glb');
        const answerButtonModel = new AssetContainer(app.context);
        await answerButtonModel.loadGltf(app.baseUrl + '/answerButton.glb', 'mesh');
        const answerButtonModel2 = new AssetContainer(app.context);
        await answerButtonModel2.loadGltf(app.baseUrl + '/answerButton2.glb', 'none');
        const squareButtonModel = new AssetContainer(app.context);
        await squareButtonModel.loadGltf(app.baseUrl + '/menuButtonSquare.glb', 'mesh');
        const podiumModel = new AssetContainer(app.context);
        await podiumModel.loadGltf(app.baseUrl + '/podium.glb');
        const podiumButtonModel = new AssetContainer(app.context);
        await podiumButtonModel.loadGltf(app.baseUrl + '/button.glb', 'mesh');
        const crownModel = new AssetContainer(app.context);
        await crownModel.loadGltf(app.baseUrl + '/crown.glb');
        const logoTex = app.assets.createTexture('logo', {uri: app.baseUrl + '/textures/logo.png'});
        const logoMat = app.assets.createMaterial('logo', {mainTextureId: logoTex.id});

        if (app.params.big !== undefined) {
            extrasEnabled = true;
            startClassic().catch();
        } else if (app.params.classic !== undefined) {
            startClassic().catch();
        } else if (app.params.party !== undefined) {
            createMenu('party');
        } else {
            createMenu();
        }

        function createMenu(mode = 'default') {
            screenModel.materials[1].mainTextureOffset.set(0.5, 0);
            screenModel.materials[1].color = colors.white.color;
            const screen = Actor.CreateFromPrefab(app.context, {
                prefabId: screenModel.prefabs[0].id,
                actor: {
                    name: 'screen',
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {y: 2, z: 0.025},
                        scale: {x: 0.5, y: 0.5, z: 0.5},
                        rotation: Quaternion.RotationAxis(Vector3.Up(), 180 * DegreesToRadians)
                    }}
                }
            });

            const menu = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
                    dimensions: {x: 3.2, y: 1.8, z: 0}
                },
                actor: {
                    name: 'menu',
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {y: 2}
                    }},
                    appearance: {
                        materialId: colors.black.id
                    }
                }
            });
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Plane,
                    dimensions: {x: 2.4, y: 1, z: 1.2}
                },
                actor: {
                    parentId: menu.id,
                    transform: {local: {
                        position: {y: 0.4, z: -0.01},
                        rotation: Quaternion.RotationAxis(Vector3.Right(), -90 * DegreesToRadians)
                    }},
                    appearance: {
                        materialId: logoMat.id
                    }
                }
            });
            if (app.params.party !== undefined) {
                createPartyMenu();
            } else {
                createDefaultMenu();
            }

            function createDefaultMenu() {
                const menuButton1c = Actor.CreateEmpty(app.context, {
                    actor: {
                        name: 'button1',
                        parentId: menu.id,
                        transform: {local: {
                            position: {y: -0.35, z: -0.001}
                        }}
                    }
                });
                const menuButton1 = Actor.CreateFromPrefab(app.context, {
                    prefabId: answerButtonModel.prefabs[0].id,
                    actor: {
                        parentId: menuButton1c.id
                    }
                });
                const menuButton2c = Actor.CreateEmpty(app.context, {
                    actor: {
                        name: 'button2',
                        parentId: menu.id,
                        transform: {local: {
                            position: {y: -0.7, z: -0.001}
                        }}
                    }
                });
                const menuButton2 = Actor.CreateFromPrefab(app.context, {
                    prefabId: answerButtonModel.prefabs[0].id,
                    actor: {
                        parentId: menuButton2c.id
                    }
                });

                menuButton1.setBehavior(ButtonBehavior).onButton('pressed', async (user: User) => {
                    if (isMod(user)) {
                        menu.children[1].destroy();
                        menu.children[1].destroy();
                        createPartyMenu();
                    }
                });
                menuButton2.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                    if (isMod(user)) {
                        menu.destroy();
                        screen.destroy();
                        startClassic().catch();
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton1c.id,
                        transform: {local: {
                            position: {y: 0.04, z: -0.005}
                        }},
                        text: {
                            contents: 'Party Mode',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.1
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton1c.id,
                        transform: {local: {
                            position: {y: -0.06, z: -0.005}
                        }},
                        text: {
                            contents: '10+ Players, No Host',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.04
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton2c.id,
                        transform: {local: {
                            position: {y: 0.04, z: -0.005}
                        }},
                        text: {
                            contents: 'Classic Mode',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.1
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton2c.id,
                        transform: {local: {
                            position: {y: -0.06, z: -0.005}
                        }},
                        text: {
                            contents: 'Gameshow Experience. 5 Players, 1 Host',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.04
                        }
                    }
                });
            }
            function createPartyMenu() {
                if (app.params.party === undefined) {
                    const backButton = Actor.CreateFromPrefab(app.context, {
                        prefabId: squareButtonModel.prefabs[0].id,
                        actor: {
                            parentId: menu.id,
                            transform: {local: {
                                position: {x: -1.55, y: 0.7, z: -0.001}
                            }}
                        }
                    });
                    backButton.setBehavior(ButtonBehavior).onClick((user: User) => {
                        if (isMod(user)) {
                            backButton.destroy();
                            menuButton1c.destroy();
                            menuButton2c.destroy();
                            app.playerList = [];
                            app.playerIcons.destroy();
                            createDefaultMenu();
                        }
                    });
                    Actor.CreateEmpty(app.context, {
                        actor: {
                            parentId: backButton.id,
                            transform: {local: {
                                position: {x: -0.02, z: -0.005},
                                scale: {y: 1.5}
                            }},
                            text: {
                                contents: '<',
                                anchor: TextAnchorLocation.MiddleCenter,
                                height: 0.1
                            }
                        }
                    });
                    Actor.CreateEmpty(app.context, {
                        actor: {
                            parentId: backButton.id,
                            transform: {local: {
                                position: {y: 0.002, z: -0.005},
                                scale: {x: 3, y: 1.5}
                            }},
                            text: {
                                contents: '-',
                                anchor: TextAnchorLocation.MiddleCenter,
                                height: 0.1
                            }
                        }
                    });
                }
                const menuButton1c = Actor.CreateEmpty(app.context, {
                    actor: {
                        name: 'button1',
                        parentId: menu.id,
                        transform: {local: {
                            position: {y: -0.35, z: -0.001}
                        }}
                    }
                });
                const menuButton1 = Actor.CreateFromPrefab(app.context, {
                    prefabId: answerButtonModel.prefabs[0].id,
                    actor: {
                        parentId: menuButton1c.id
                    }
                });
                const menuButton2c = Actor.CreateEmpty(app.context, {
                    actor: {
                        name: 'button2',
                        parentId: menu.id,
                        transform: {local: {
                            position: {y: -0.7, z: -0.001}
                        }}
                    }
                });
                const menuButton2 = Actor.CreateFromPrefab(app.context, {
                    prefabId: answerButtonModel.prefabs[0].id,
                    actor: {
                        parentId: menuButton2c.id
                    }
                });
                app.playerIcons = Actor.CreateEmpty(app.context, {
                    actor: {
                        name: 'playerIcons',
                        parentId: app.scene.id,
                        transform: {local: {
                            position: {y: 1.09, z: 0.009}
                        }}
                    }
                });
                menuButton1.setBehavior(ButtonBehavior).onButton('pressed', (user2: User) => {
                    console.log('join');
                    let joined = false;
                    for (const p of app.playerList) {
                        if (p.id === user2.id) {
                            joined = true;
                        }
                    }
                    if (!joined) {
                        const icon = createPlayerIcon(user2.name);
                        app.playerList.push({id: user2.id, name: user2.name, score: 0, answered: false, answer: null, timeToAnswer: 0, screen: null, icon: icon});
                        // const icon2 = createPlayerIcon('2');
                        // app.playerList.push({id: '123', name: '2', score: 123, answered: false, answer: null, timeToAnswer: 0, screen: null, icon: icon2});
                        // const icon3 = createPlayerIcon('3');
                        // app.playerList.push({id: '1234', name: '3', score: 234, answered: false, answer: null, timeToAnswer: 0, screen: null, icon: icon3});
                        // const icon4 = createPlayerIcon('4');
                        // app.playerList.push({id: '12345', name: '4', score: 10, answered: false, answer: null, timeToAnswer: 0, screen: null, icon: icon4});
                        menuButton1c.children[2].text.contents = `Players joined: ${app.playerList.length}`;
                    }
                });
                menuButton2.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                    if (isMod(user) && app.playerList.length > 0) {
                        menu.destroy();
                        startNew().catch();
                    }
                });
                getCategories().catch();
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton1c.id,
                        transform: {local: {
                            position: {y: 0.04, z: -0.005}
                        }},
                        text: {
                            contents: 'Join Game',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.1
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton1c.id,
                        transform: {local: {
                            position: {y: -0.06, z: -0.005}
                        }},
                        text: {
                            contents: 'Players joined: 0',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.04
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: menuButton2c.id,
                        transform: {local: {
                            position: {z: -0.005}
                        }},
                        text: {
                            contents: 'Start Game',
                            anchor: TextAnchorLocation.MiddleCenter,
                            height: 0.1
                        }
                    }
                });
            }
        }

        async function startNew() {
            app.gamemode = 'new';
            let timeLeft = 0;
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
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
            const roundBeginText1 = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {y: 2.5, z: -0.01}
                    }},
                    text: {
                        height: 0.3,
                        anchor: TextAnchorLocation.MiddleCenter,
                        justify: TextJustify.Center
                    }
                }
            });
            const roundBeginText2 = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {y: 2, z: -0.01}
                    }},
                    text: {
                        height: 0.2,
                        anchor: TextAnchorLocation.MiddleCenter,
                        justify: TextJustify.Center
                    }
                }
            });
            const roundBeginText3 = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {y: 1.6, z: -0.01}
                    }},
                    text: {
                        height: 0.2,
                        anchor: TextAnchorLocation.MiddleCenter,
                        justify: TextJustify.Center
                    }
                }
            });
            mainScreen = createScreen(app.scene, {
                position: {y: 2, z: -0.04},
                scale: Vector3.One().scale(0.0001)
            }, undefined, true);
            const letters = ['A', 'B', 'C', 'D'];
            for (let i = 0; i < 4; i ++) {
                mainScreen.findChildrenByName(`answer${i}Button`, true)[0].setBehavior(ButtonBehavior).onButton("pressed", (user: User) => {
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

            // await getCategories();
            const numOfQs = 5;
            // loadedQuestions = await query(pgescape("SELECT * FROM questionsTest ORDER BY RANDOM() LIMIT " + numOfQs));

            // displayQuestion(loadedQuestions.rows[currentQuestion]);

            const timeText = Actor.CreateEmpty(app.context, {
                actor: {
                    name: 'time',
                    parentId: app.scene.id,
                    transform: {local: {
                        position: {x: 1.5, y: 1.28, z: -0.01}
                    }},
                    text: {
                        contents: '0',
                        height: 0.2
                    }
                }
            });
            let currentRound = 0;
            startRound(9, 'easy', numOfQs).catch();
            async function startRound(catId: number, diff: string, questions: number) {
                currentRound++;
                currentQuestion = -1;
                // numOfQs = questions;
                roundBeginText1.text.contents = `Round ${currentRound}`;
                roundBeginText2.text.contents = `${app.categoryRef[catId.toString()]} - ${diff.charAt(0).toUpperCase() + diff.substr(1, diff.length - 1)}`;
                roundBeginText3.text.contents = `${questions} Question${questions > 1 ? 's' : ''}`;
                const sql = pgescape(`SELECT * FROM questionsTest WHERE categoryId = ${catId} AND difficulty = %L ORDER BY RANDOM() LIMIT ${questions}`, diff);
                console.log(sql);
                loadedQuestions = await query(sql);
                // app.categories.splice(0, 1);
                removeCategory(catId);
                time(5, 'start');
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
                        screenModel.materials[1].mainTextureOffset.set(-0.497 * ((count - timeLeft) / count), 0);
                    } else {
                        screenModel.materials[1].mainTextureOffset.set(-0.497 * ((count - timeLeft) / count) - 0.5, 0);
                    }
                    timeText.text.contents = timeLeft.toString().substr(0, 3);
                    timeLeft -= 0.05;
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        timeText.text.contents = '';
                        if (next === 'start') {
                            roundBeginText1.text.contents = '';
                            roundBeginText2.text.contents = '';
                            roundBeginText3.text.contents = '';
                            // mainScreen = createScreen(app.scene, {
                            //     position: {y: 2, z: -0.04}
                            // }, undefined, true);
                            // const letters = ['A', 'B', 'C', 'D'];
                            // for (let i = 0; i < 4; i ++) {
                            //     mainScreen.findChildrenByName(`answer${i}Button`, true)[0].setBehavior(ButtonBehavior).onButton("pressed", (user: User) => {
                            //         for (const p of app.playerList) {
                            //             if (p.id === user.id) {
                            //                 if (!p.answered) {
                            //                     p.answered = true;
                            //                     p.answer = i;
                            //                     p.timeToAnswer = timeLeft;
                            //                     p.icon.appearance.material = colors.yellow;
                            //                     user.groups.clear();
                            //                     user.groups.add(`answered${letters[i]}`);
                            //                 }
                            //             }
                            //         }
                            //     });
                            // }
                            mainScreen.findChildrenByName('question', true)[0].text.contents = wrapText(loadedQuestions.rows[0].question, 30);
                            mainScreen.transform.local.scale.setAll(1);
                            time(0, 'next');
                        } else if (next === 'reveal') {
                            revealAnswer();
                            playSound('buzz');
                            if (currentQuestion !== numOfQs - 1) {
                                time(5, 'next');
                            } else {
                                time(5, 'scores');
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
                                let nextButton: Actor;
                                if (app.categories.hard.length > 0) {
                                    nextButton = Actor.CreatePrimitive(app.context, {
                                        definition: {
                                            shape: PrimitiveShape.Box,
                                            dimensions: {x: 0.2, y: 0.2, z: 0.01}
                                        },
                                        addCollider: true,
                                        actor: {
                                            parentId: app.scene.id,
                                            name: 'nextButton',
                                            transform: {local: {
                                                position: {x: 1.55, y: 1.8}
                                            }}
                                        }
                                    });
                                    Actor.CreateEmpty(app.context, {
                                        actor: {
                                            parentId: nextButton.id,
                                            transform: {local: {
                                                position: {y: -0.18, z: -0.001}
                                            }},
                                            text: {
                                                contents: 'Next Round',
                                                height: 0.1,
                                                anchor: TextAnchorLocation.MiddleCenter
                                            }
                                        }
                                    });
                                    nextButton.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                                        if (isMod(user)) {
                                            for (const p of app.playerList) {
                                                p.icon.findChildrenByName('scoreBar', true)[0].destroy();
                                                p.icon.findChildrenByName('scoreText', true)[0].destroy();
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
                                            shuffleArray(catList);
                                            startRound(catList[0].id, difficulty, numOfQs).catch();
                                            nextButton.destroy();
                                            endButton.destroy();
                                        }
                                    });
                                }
                                const endButton = Actor.CreatePrimitive(app.context, {
                                    definition: {
                                        shape: PrimitiveShape.Box,
                                        dimensions: {x: 0.2, y: 0.2, z: 0.01}
                                    },
                                    addCollider: true,
                                    actor: {
                                        parentId: app.scene.id,
                                        name: 'endButton',
                                        transform: {local: {
                                            position: {x: 1.55, y: 1.25}
                                        }}
                                    }
                                });
                                Actor.CreateEmpty(app.context, {
                                    actor: {
                                        parentId: endButton.id,
                                        transform: {local: {
                                            position: {y: -0.18, z: -0.001}
                                        }},
                                        text: {
                                            contents: 'End Game',
                                            height: 0.1,
                                            anchor: TextAnchorLocation.MiddleCenter
                                        }
                                    }
                                });
                                endButton.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                                    if (isMod(user)) {
                                        for (const p of app.playerList) {
                                            p.icon.findChildrenByName('scoreBar', true)[0].destroy();
                                            p.icon.findChildrenByName('scoreText', true)[0].destroy();
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
                                        endButton.setBehavior(ButtonBehavior).onButton('pressed', (user2: User) => {
                                            if (isMod(user2)) {
                                                app.playerList = [];
                                                app.scene.destroy();
                                                app.scene = Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});
                                                soundPlayer = Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
                                                createMenu();
                                            }
                                        });
                                    }
                                });
                            }, 3000);
                        }
                    }
                }, 50);
            }
        }
        async function startClassic() {
            app.gamemode = 'classic';
            for (const u of app.context.users) {
                u.groups.clear();
                u.groups.add('notJoined');
            }
            if (extrasEnabled) {
                app.scene.transform.local.position = new Vector3(0, 0, 7);
            } else {
                app.scene.transform.local.position = new Vector3(0, -0.25, 0);
                Actor.CreateFromPrefab(app.context, {
                    prefabId: screenModel.prefabs[0].id,
                    actor: {
                        parentId: app.scene.id,
                        name: 'screenModel',
                        transform: {local: {
                            position: {y: 4.5, z: 1.5},
                            rotation: Quaternion.RotationAxis(Vector3.Up(), 180 * DegreesToRadians)
                        }}
                    }
                });
                screenModel.materials[1].mainTextureOffset.set(0, 0);
                screenModel.materials[1].color = colors.black.color;
            }
            podiums = await Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: app.scene.id,
                    name: 'podiums',
                    transform: {
                        local: {
                            position: {x: -1.6, y: 0.06, z: -1},
                            rotation: Quaternion.FromEulerAngles(0, -45 * DegreesToRadians, 0)
                        }
                    }
                }
            });
            hostPodium = await Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: app.scene.id,
                    name: 'hostPodium',
                    transform: {local: {
                        position: {x: 2.3, z: -1},
                        rotation: Quaternion.RotationAxis(Vector3.Up(), -95 * DegreesToRadians)
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
            }, undefined, true);
            await createHostPodium();
            hostScreen = hostPodium.findChildrenByName('main', true)[0];
            for (let i = 0; i < 4; i ++) {
                hostScreen.findChildrenByName(`answer${i}Button`, true)[0].setBehavior(ButtonBehavior).onButton("pressed", (user: User) => {
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

            getCategories().catch();

            // set up cameras
            if (extrasEnabled) {
                Actor.CreateFromLibrary(app.context, {
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
                app.camera = await Actor.CreateFromLibrary(app.context, {
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

        function createPlayerIcon(name: string): Actor {
            let offset = 0.5;
            app.playerIcons.transform.local.position.x = app.playerList.length * offset * -0.5;
            if (app.playerList.length > 7) {
                app.playerIcons.transform.local.position.x = -1.75;
                offset = 3.5 / app.playerList.length;
                for (const icon of app.playerIcons.children) {
                    icon.transform.local.position.x = app.playerIcons.children.indexOf(icon) * offset;
                }
            }
            const iconBase = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Cylinder,
                    dimensions: {x: 0, y: 0, z: 0.001},
                    radius: 0.06
                },
                addCollider: true,
                actor: {
                    parentId: app.playerIcons.id,
                    transform: {local: {
                        position: {x: app.playerList.length * offset, z: -0.01}
                    }}
                }
            });
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Cylinder,
                    dimensions: {x: 0, y: 0, z: 0.001},
                    radius: 0.05
                },
                actor: {
                    parentId: iconBase.id,
                    transform: {local: {
                        position: {z: -0.001}
                    }},
                    appearance: {
                        materialId: colors.black.id
                    }
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: iconBase.id,
                    transform: {local: {
                        position: {z: -0.002}
                    }},
                    text: {
                        contents: name.substr(0, 1),
                        height: 0.075,
                        anchor: TextAnchorLocation.MiddleCenter,
                        justify: TextJustify.Center
                    }
                }
            });
            const hoverLabels: {[id: string]: Actor} = {};
            const iconHover = iconBase.setBehavior(ButtonBehavior);
            iconHover.onHover('enter', (user: User) => {
                if (hoverLabels[user.id] === undefined) {
                    hoverLabels[user.id] = Actor.CreateEmpty(app.context, {
                        actor: {
                            parentId: iconBase.id,
                            exclusiveToUser: user.id,
                            transform: {local: {
                                position: {y: -0.09}
                            }},
                            text: {
                                contents: name,
                                height: 0.04,
                                anchor: TextAnchorLocation.MiddleCenter,
                                justify: TextJustify.Center
                            }
                        }
                    });
                }
            });
            iconHover.onHover('exit', (user: User) => {
                if (hoverLabels[user.id] !== undefined) {
                    hoverLabels[user.id].destroy();
                    delete hoverLabels[user.id];
                }
            });
            return iconBase;
        }

        function moveCamera(dest: number, cam: Actor) {
            if (extrasEnabled) {
                if (dest === -1) {
                    cam.animateTo({
                        transform: {
                            local: {
                                position: {x: 0, y: 1.75, z: -2.5}
                            }
                        }
                    }, 1, AnimationEaseCurves.EaseOutQuadratic);
                } else {
                    cam.animateTo({
                        transform: {
                            local: {
                                position: {x: 1.6 - (dest * 0.8), y: 1.6, z: -0.7}
                            }
                        }
                    }, 1, AnimationEaseCurves.EaseOutQuadratic);
                }
            }
        }

        function isMod(user: User) {
            let appMod = false;
            if (user.properties['altspacevr-roles']) {
                if (user.properties['altspacevr-roles'].includes('moderator')) {
                    appMod = true;
                }
            }
            return user.id === app.currentMod || appMod;
        }

        async function getCategories() {
            const cats = await query('SELECT DISTINCT categoryid, category FROM questionsTest ORDER BY categoryid');
            const counts = await query('SELECT categoryid, category, difficulty, count(*) FROM questionsTest GROUP by categoryid, category, difficulty ORDER BY count DESC');
            console.log(cats.rows, cats.rowCount, counts.rows);
            app.categories.easy = [];
            app.categories.medium = [];
            app.categories.hard = [];
            for (const cat of cats.rows) {
                app.categoryRef[cat.categoryid] = cat.category;
            }
            for (const cat of counts.rows) {
                if (Number(cat.count) > 9) {
                    if (cat.difficulty === 'easy') {
                        app.categories.easy.push({id: cat.categoryid, name: cat.category});
                    } else if (cat.difficulty === 'medium') {
                        app.categories.medium.push({id: cat.categoryid, name: cat.category});
                    } else if (cat.difficulty === 'hard') {
                        app.categories.hard.push({id: cat.categoryid, name: cat.category});
                    }
                }
            }
            removeCategory(10);
            console.log(app.categories);
            console.log(app.categoryRef);
        }

        function removeCategory(catId: number) {
            for (const cat of app.categories.easy) {
                if (cat.id === catId) {
                    app.categories.easy.splice(app.categories.easy.indexOf(cat), 1);
                }
            }
            for (const cat of app.categories.medium) {
                if (cat.id === catId) {
                    app.categories.medium.splice(app.categories.medium.indexOf(cat), 1);
                }
            }
            for (const cat of app.categories.hard) {
                if (cat.id === catId) {
                    app.categories.hard.splice(app.categories.hard.indexOf(cat), 1);
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
                pod.screen.destroy();
                pod.name.text.contents = '';
                pod.score.text.contents = '';
                pod.scoreVal = 0;
                pod.joinButton.transform.local.position.y = 2;
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
            getCategories().catch();
        }

        function giveCrown(userId: string) {
            const crownC = Actor.CreateEmpty(app.context, {
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
            const crown = Actor.CreateFromPrefab(app.context, {
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
                    value: {transform: {local: {rotation: Quaternion.RotationAxis(Vector3.Up(), 0)}}}
                }, {
                    time: 0.5,
                    value: {transform: {local: {rotation: Quaternion.RotationAxis(Vector3.Up(), 180 * DegreesToRadians)}}}
                }, {
                    time: 1,
                    value: {transform: {local: {rotation: Quaternion.RotationAxis(Vector3.Up(), 360 * DegreesToRadians)}}}
                }],
                wrapMode: AnimationWrapMode.Loop,
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
                wrapMode: AnimationWrapMode.PingPong,
                initialState: {
                    enabled: true,
                    speed: 0.1
                }
            });
        }

        function assignMat(actor: MRESDK.Actor, mat: MRESDK.Material) {
            actor.appearance.material = mat;
            actor.children.forEach(c => assignMat(c, mat));
        }
        function assignColor(actor: MRESDK.Actor, color: string) {
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

        async function createPodium(num: number, transform: Partial<TransformLike>) {
            const pod = Actor.CreateEmpty(app.context, {
                actor: {
                    name: `podium ${num + 1}`,
                    parentId: podiums.id,
                    transform: {
                        local: transform
                    }
                }
            });
            // if (!extrasEnabled) {
            app.podiumList[num].model = Actor.CreateFromPrefab(app.context, {
                prefabId: podiumModel.prefabs[0].id,
                actor: {
                    parentId: pod.id,
                    transform: {local: {
                        position: {y: 0.1}
                    }}
                }
            });
            await app.podiumList[num].model.created();
            app.podiumList[num].model.findChildrenByName('base', true)[0].children[0].appearance.material = podiumColors[num];
            setStripes(num, 'black');
            // }
            app.podiumList[num].joinButton = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Sphere
                },
                addCollider: true,
                actor: {
                    parentId: pod.id,
                    transform: {
                        local: {
                            position: {x: 0, y: 2, z: 0},
                            scale: {x: 0.5, y: 0.5, z: 0.5}
                        }
                    },
                    appearance: {
                        enabled: new GroupMask(app.context, ['notJoined']),
                        materialId: podiumColors[num].id
                    }
                }
            });
            app.podiumList[num].joinButton.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                if (!checkIfJoined(app.podiumList, user.id)) {
                    app.podiumList[num].joinButton.transform.local.position.y = -1;
                    app.podiumList[num].id = user.id;
                    app.podiumList[num].name.text.contents = user.name.length < 10 ? user.name : user.name.substr(0, 10) + '...';
                    app.podiumList[num].score.text.contents = '0';
                    user.groups.delete('notJoined');
                    app.podiumList[num].leaveButton = Actor.CreatePrimitive(app.context, {
                        definition: {
                            shape: PrimitiveShape.Sphere
                        },
                        addCollider: true,
                        actor: {
                            exclusiveToUser: user.id,
                            parentId: pod.id,
                            transform: {
                                local: {
                                    position: {x: 0, y: 1, z: 0.235},
                                    scale: {x: 0.05, y: 0.05, z: 0.05}
                                }
                            },
                            appearance: {
                                materialId: colors.red.id
                            }
                        }
                    });
                    app.podiumList[num].leaveButton.setBehavior(ButtonBehavior).onButton('pressed', () => {
                        leaveGame(app.podiumList[num]);
                    });
                    const screen = createScreen(app.scene, {
                        position: {x: 1, y: 1.55, z: -3.6},
                        rotation: Quaternion.FromEulerAngles(10 * DegreesToRadians, 135 * DegreesToRadians, 0)
                    }, user.id, false);

                    Actor.CreateFromPrefab(app.context, {
                        prefabId: screenModel.prefabs[0].id,
                        actor: {
                            parentId: screen.id,
                            name: 'screenModel',
                            transform: {local: {
                                position: {z: 0.023},
                                scale: {x: 0.45, y: 0.45, z: 0.45},
                                rotation: Quaternion.RotationAxis(Vector3.Up(), 180 * DegreesToRadians)
                            }}
                        }
                    });

                    updateScores();
                    let confirmButton: Actor = null;
                    // let buttonCreated = app.podiumList[num].screen.findChildrenByName('confirm', true).length;
                    for (let x = 0; x < 4; x ++) {
                        screen.findChildrenByName(`answer${x}Button`, true)[0].setBehavior(ButtonBehavior).onButton("pressed", (user2: User) => {
                            if (app.podiumPressed !== -1) {
                                if (user2.id === app.podiumList[app.podiumPressed].id && !questionAnswered && app.answerLocked === 0) {
                                    selectedAnswer = selectAnswer(x, false, false);
                                    if (selectedAnswer > -1 && app.podiumList[num].screen.findChildrenByName('confirm', true).length === 0) {
                                        console.log('Create button');
                                        confirmButton = createConfirmButton(screen);

                                        confirmButton.setBehavior(ButtonBehavior).onButton("pressed", (user3: User) => {
                                            selectAnswer(selectedAnswer, false, true);
                                            app.answerLocked = 2;
                                            // buttonCreated = false;
                                            confirmButton.destroy();
                                        });
                                        // buttonCreated = true;
                                    } else if (selectedAnswer === -1) {
                                        console.log('Remove button');
                                        confirmButton.destroy();
                                        // buttonCreated = false;
                                    }
                                }
                            }
                        });
                    }
                }
            });
            const score = Actor.CreateEmpty(app.context, {
                actor: {
                    name: 'score',
                    parentId: pod.id,
                    transform: {
                        local: {
                            position: {x: 0, y: 1, z: -0.24},
                            rotation: Quaternion.FromEulerAngles(-8 * DegreesToRadians, 0, 0)
                        }
                    },
                    text: {
                        contents: '',
                        anchor: TextAnchorLocation.MiddleCenter,
                        color: {r: 0, g: 0, b: 0},
                        height: 0.25
                    }
                }
            });
            app.podiumList[num].score = score;
            const name = Actor.CreateEmpty(app.context, {
                actor: {
                    name: 'name',
                    parentId: pod.id,
                    transform: {
                        local: {
                            position: {x: 0, y: 1.225, z: -0.27},
                            rotation: Quaternion.FromEulerAngles(-8 * DegreesToRadians, 0, 0)
                        }
                    },
                    text: {
                        contents: '',
                        anchor: TextAnchorLocation.MiddleCenter,
                        color: {r: 0, g: 0, b: 0},
                        height: 0.075
                    }
                }
            });
            app.podiumList[num].name = name;
            const buttonModel = Actor.CreateFromPrefab(app.context, {
                prefabId: podiumButtonModel.prefabs[0].id,
                actor: {
                    parentId: pod.id,
                    transform: {
                        local: {
                            position: {x: 0, y: .1, z: 0},
                            scale: {x: .5, y: .5, z: .5},
                            rotation: Quaternion.FromEulerAngles(0, -90 * DegreesToRadians, 0)
                        }
                    }
                }
            });
            await buttonModel.created();
            assignMat(buttonModel, colors.darkRed);
            app.podiumList[num].button = buttonModel;
            const buttonBackup = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
                    dimensions: {x: 0.3, y: 0.05, z: 0.35}
                },
                addCollider: true,
                actor: {
                    parentId: pod.id,
                    transform: {
                        local: {
                            position: {x: 0, y: 1.245, z: -.045},
                            rotation: Quaternion.FromEulerAngles(0, -90 * DegreesToRadians, -18.45 * DegreesToRadians)
                        }
                    }
                }
            });
            const podButton = buttonModel.setBehavior(ButtonBehavior);
            podButton.onButton('pressed', (user: User) => {
                if (app.podiumPressed === -1 && app.podiumList[num].id === user.id && !app.podiumList[num].hasBuzzed && app.mode === 'question') {
                    buzz(user);
                }
            });
            const podButton2 = buttonBackup.setBehavior(ButtonBehavior);
            podButton2.onButton('pressed', (user: User) => {
                if (app.podiumPressed === -1 && app.podiumList[num].id === user.id && !app.podiumList[num].hasBuzzed && app.mode === 'question') {
                    buzz(user);
                }
            });
            function buzz(user: User) {
                console.log(`Button ${num} pressed.`);
                app.podiumPressed = num;
                app.podiumList[num].hasBuzzed = true;
                for (let x = 0; x < 5; x++) {
                    if (app.podiumList[x].id === user.id) {
                        assignMat(app.podiumList[x].button, colors.green);
                        app.podiumList[x].model.findChildrenByName('panels', true)[0].children[0].appearance.material = colors.white;
                        screenModel.materials[1].color = podiumColors[x].color;
                    } else {
                        assignMat(app.podiumList[x].button, colors.darkRed);
                        app.podiumList[x].model.findChildrenByName('panels', true)[0].children[0].appearance.material = colors.grey;
                    }
                }
                playSound('buzz');
                moveCamera(num, app.camera);
                app.podiumList[num].spotLight.light.color = new Color3(.3, .3, .3);
                app.podiumList[num].spotLight.light.enabled = true;
                setStripes(num, 'white');
            }

            app.podiumList[num].spotLight = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: pod.id,
                    name: 'spotLight',
                    light: {
                        type: 'spot',
                        enabled: false,
                        intensity: 5
                    },
                    transform: {local: {
                        position: {y: 3, z: -1},
                        rotation: Quaternion.RotationAxis(Vector3.Right(), 45 * DegreesToRadians)
                    }}
                }
            });
        }

        async function createHostPodium() {
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Cylinder,
                    radius: 0.025,
                    dimensions: {x: 0, y: 1.15, z: 0}
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

            const screenHolder = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: hostPodium.id,
                    name: 'screens',
                    transform: {local: {
                        position: {y: 1.5},
                        rotation: Quaternion.RotationAxis(Vector3.Right(), 20 * DegreesToRadians)
                    }}
                }
            });
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
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
            const screen2 = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screenHolder.id,
                    name: 'main'
                }
            });
            createScreen(screen2, {
                position: {z: -0.001},
                scale: {x: 0.2, y: 0.2, z: 0.2}
            }, undefined, false);

            const screen1Cont = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screenHolder.id,
                    name: 'left',
                    transform: {local: {
                        position: {x: 0.32, z: 0.01}
                    }}
                }
            });
            const screen3Cont = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screenHolder.id,
                    name: 'right',
                    transform: {local: {
                        position: {x: -0.32, z: 0.01}
                    }}
                }
            });
            const screen1 = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
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
            const screen3 = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
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

            Actor.CreateEmpty(app.context, {
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
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            }).setBehavior(ButtonBehavior).onButton('pressed', async (user: User) => {
                if (user.id === app.currentHost.id) {
                    if (!app.scoresOnScreen) {
                        console.log('Show Scroes');
                        showScores();
                    } else {
                        hideScores();
                    }
                }
            });
            const hostJoinShere = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Sphere,
                    radius: 0.25
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
            hostJoinShere.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                if (app.currentHost === null) {
                    hostJoinShere.transform.local.scale.setAll(0);
                    app.currentHost = user;
                    hostText.text.contents = `Host: ${app.currentHost.name}`;
                    hostPodium.findChildrenByName('hostJoinButton', true)[0].appearance.materialId = colors.red.id;
                }
            });

            const hostButton = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            }).setBehavior(ButtonBehavior).onButton('pressed', async (user: User) => {
                if (app.currentHost === null) {
                    hostJoinShere.transform.local.scale.setAll(0);
                    app.currentHost = user;
                    hostText.text.contents = `Host: ${app.currentHost.name}`;
                    hostPodium.findChildrenByName('hostJoinButton', true)[0].appearance.materialId = colors.red.id;
                } else if (app.currentHost.id === user.id || isMod(user)) {
                    clearHost();
                    hostJoinShere.transform.local.scale.setAll(1);
                    if (!leftHidden) slideHostPanel('left', 0);
                    if (!rightHidden) slideHostPanel('right', 0);
                    leftHidden = true;
                    rightHidden = true;
                }
            });
            const hostText = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screen3.id,
                    name: 'hostJoinText',
                    text: {
                        contents: 'Host: None',
                        anchor: MRESDK.TextAnchorLocation.MiddleCenter,
                        height: 0.1
                    },
                    transform: {
                        local: {
                            position: {x: -1, y: -0.4, z: -.02}
                        }
                    }
                }
            });

            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            }).setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                if (user.id === app.currentHost.id || isMod(user)) {
                    resetGame();
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screen3.id,
                    text: {
                        contents: 'Reset All',
                        anchor: MRESDK.TextAnchorLocation.MiddleCenter,
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
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: MRESDK.PrimitiveShape.Box,
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
                }).setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                    if (user.id === app.currentHost.id || isMod(user)) {
                        resetGame();
                        app.scene.destroy();
                        app.scene = Actor.CreateEmpty(app.context, {actor: {name: 'scene'}});
                        soundPlayer = Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
                        createMenu();
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: screen3.id,
                        text: {
                            contents: 'Back to menu',
                            anchor: MRESDK.TextAnchorLocation.MiddleCenter,
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

            const podButtons = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: screen3.id,
                    name: 'podiumButtons',
                    transform: {local: {
                        position: {x: -1.4, y: 0.5, z: -0.005}
                    }}
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: podButtons.id,
                    transform: {local: {
                        position: {x: 0.2, y: 0.12},
                    }},
                    text: {
                        contents: '-',
                        anchor: TextAnchorLocation.MiddleCenter,
                        height: 0.1
                    }
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: podButtons.id,
                    transform: {local: {
                        position: {x: 0.4, y: 0.12},
                    }},
                    text: {
                        contents: '+',
                        anchor: TextAnchorLocation.MiddleCenter,
                        height: 0.1
                    }
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: podButtons.id,
                    transform: {local: {
                        position: {x: 0.6, y: 0.12},
                    }},
                    text: {
                        contents: 'Kick',
                        anchor: TextAnchorLocation.MiddleCenter,
                        height: 0.05
                    }
                }
            });
            for (let i = 0; i < 5; i++) {
                const container = Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: podButtons.id,
                        transform: {local: {
                            position: {y: i * -0.15}
                        }}
                    }
                });
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: container.id,
                        text: {
                            contents: (i + 1).toString(),
                            height: 0.1,
                            justify: TextJustify.Center,
                            anchor: TextAnchorLocation.MiddleCenter
                        }
                    }
                });
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: MRESDK.PrimitiveShape.Plane,
                        dimensions: {x: .8, y: 1, z: .15}
                    },
                    actor: {
                        parentId: container.id,
                        transform: {
                            local: {
                                position: {x: 0.3, z: 0.004},
                                rotation: Quaternion.RotationAxis(Vector3.Right(), -90 * DegreesToRadians)
                            }
                        },
                        appearance: {
                            materialId: podiumColors[i].id
                        }
                    }
                });
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: MRESDK.PrimitiveShape.Box,
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
                }).setBehavior(ButtonBehavior).onClick((user: User) => {
                    if (isMod(user) || user.id === app.currentHost.id) {
                        if (app.podiumList[i].id !== null) {
                            app.podiumList[i].scoreVal--;
                            app.podiumList[i].score.text.contents = app.podiumList[i].scoreVal.toString();
                            updateScores();
                        }
                    }
                });
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: MRESDK.PrimitiveShape.Box,
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
                }).setBehavior(ButtonBehavior).onClick((user: User) => {
                    if (isMod(user) || user.id === app.currentHost.id) {
                        if (app.podiumList[i].id !== null) {
                            app.podiumList[i].scoreVal++;
                            app.podiumList[i].score.text.contents = app.podiumList[i].scoreVal.toString();
                            updateScores();
                        }
                    }
                });
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: MRESDK.PrimitiveShape.Box,
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
                }).setBehavior(ButtonBehavior).onClick((user: User) => {
                    if (isMod(user) || user.id === app.currentHost.id) {
                        if (app.podiumList[i].id !== null) {
                            leaveGame(app.podiumList[i]);
                        }
                    }
                });
            }

            const hostButtons = Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: hostPodium.id,
                    name: 'buttons',
                    transform: {local: {
                        position: {y: 1.35},
                        rotation: Quaternion.RotationAxis(Vector3.Left(), 16 * DegreesToRadians)
                    }}
                }
            });
            Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            const showLeftButton = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Cylinder,
                    uSegments: 3,
                    dimensions: {x: .001, y: .01, z: .001},
                    radius: 0.025
                },
                addCollider: true,
                actor: {
                    parentId: hostButtons.id,
                    name: 'showLeft',
                    transform: {
                        local: {
                            position: {x: -0.25, z: -0.1},
                            rotation: Quaternion.RotationAxis(Vector3.Up(), -90 * DegreesToRadians)
                        }
                    },
                    appearance: {
                        materialId: colors.blue.id
                    }
                }
            });
            let leftHidden = true;
            showLeftButton.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                if (isMod(user) || user.id === app.currentHost.id) {
                    if (leftHidden) {
                        slideHostPanel('left', 1);
                    } else {
                        slideHostPanel('left', 0);
                    }
                    leftHidden = !leftHidden;
                }
            });
            const showRightButton = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Cylinder,
                    uSegments: 3,
                    dimensions: {x: .001, y: .01, z: .001},
                    radius: 0.025
                },
                addCollider: true,
                actor: {
                    parentId: hostButtons.id,
                    name: 'showRight',
                    transform: {
                        local: {
                            position: {x: 0.25, z: -0.1},
                            rotation: Quaternion.RotationAxis(Vector3.Up(), 90 * DegreesToRadians)
                        }
                    },
                    appearance: {
                        materialId: colors.blue.id
                    }
                }
            });
            let rightHidden = true;
            showRightButton.setBehavior(ButtonBehavior).onButton('pressed', (user: User) => {
                if (isMod(user) || user.id === app.currentHost.id) {
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
                    }, 1, AnimationEaseCurves.EaseOutQuadratic);
                    setTimeout(() => {
                        panel.animateTo({
                            transform: {local: {
                                position: {z: 0},
                                rotation: Quaternion.RotationAxis(Vector3.Up(), (side === 'left' ? -25 : 25) * DegreesToRadians)
                            }}
                        }, 1, AnimationEaseCurves.EaseInOutQuadratic);
                    }, 1000);
                    button.transform.local.rotation = Quaternion.RotationAxis(Vector3.Up(), (side === 'left' ? 90 : -90) * DegreesToRadians);
                } else {
                    panel.animateTo({
                        transform: {local: {
                            position: {z: 0.01},
                            rotation: Quaternion.RotationAxis(Vector3.Up(), 0)
                        }}
                    }, 1, AnimationEaseCurves.EaseInOutQuadratic);
                    setTimeout(() => {
                        panel.animateTo({
                            transform: {local: {
                                position: {x: side === 'left' ? 0.32 : -0.32}
                            }}
                        }, 1, AnimationEaseCurves.EaseOutQuadratic);
                    }, 1000);
                    button.transform.local.rotation = Quaternion.RotationAxis(Vector3.Up(), (side === 'left' ? -90 : 90) * DegreesToRadians);
                }
            }
            const resetButton = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            const reset = resetButton.setBehavior(ButtonBehavior);
            reset.onButton('pressed', (user: User) => {
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
                    screenModel.materials[1].color = colors.black.color;
                }
            });
            const nextButton = await Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: MRESDK.PrimitiveShape.Box,
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
            const next = nextButton.setBehavior(ButtonBehavior);
            next.onButton('pressed', async (user: User) => {
                // let catList = app.categories.easy;
                if (isMod(user) || user.id === app.currentHost.id) {
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
                            loadedQuestions = await query(pgescape("SELECT * FROM questionsTest WHERE category = %L AND difficulty = %L ORDER BY RANDOM() LIMIT 5", currentDifficulty().cats[selectedAnswer].name, currentDifficulty().diff));
                            console.log(loadedQuestions);
                            removeCategory(currentDifficulty().cats[selectedAnswer].id);
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
                                app.podiumList[app.podiumPressed].spotLight.light.color = correct ? Color3.Green() : Color3.Red();
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
                            screenModel.materials[1].color = colors.black.color;
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
                                    app.podiumList[i].model.findChildrenByName('panels', true)[0].children[0].appearance.material = colors.white;
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
            app.podiumList[pod].model.findChildrenByName('stripes', true)[0].children[0].appearance.material = c;
        }

        function createScreen(parent: Actor, transform: Partial<ScaledTransformLike>, user: string, first: boolean): Actor {
            const cont = Actor.CreateEmpty(app.context, {
                actor: {
                    exclusiveToUser: user,
                    parentId: parent.id,
                    name: 'screenContainer',
                    transform: {
                        local: transform
                    }
                }
            });
            if (app.gamemode === 'classic') {
                Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: PrimitiveShape.Plane,
                        dimensions: {x: 3, y: 1, z: 1.5}
                    },
                    actor: {
                        parentId: cont.id,
                        name: 'logo',
                        transform: {local: {
                            rotation: Quaternion.RotationAxis(Vector3.Right(), -90 * DegreesToRadians)
                        }},
                        appearance: {
                            materialId: logoMat.id
                        }
                    }
                });
            }

            const screen = Actor.CreateEmpty(app.context, {
                actor: {
                    name: 'screen',
                    parentId: cont.id,
                    transform: {
                        local: {
                            position: {z: 0.03},
                            scale: Vector3.One().scale(app.gamemode === 'classic' ? 0.0001 : 1)
                        }
                    }
                }
            });
            for (const pod of app.podiumList) {
                if (pod.id === user) {
                    pod.screen = cont;
                }
            }

            const scores = Actor.CreateEmpty(app.context, {
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
            Actor.CreateEmpty(app.context, {
                actor: {
                    name: 'question',
                    parentId: screen.id,
                    transform: {
                            local: {
                            position: {x: 0, y: 0.4, z: 0}
                        }
                    },
                    text: {
                        contents: 'Question?',
                        anchor: TextAnchorLocation.MiddleCenter,
                        height: 0.2,
                        justify: TextJustify.Center
                    }
                }
            });
            const letters = ['A:', 'B:', 'C:', 'D:'];
            for (let i = 0; i < 4; i++) {
                const x = i % 2 ? 0.75 : -0.75;
                const y = i > 1 ? -0.6 : -0.2;

                const container = Actor.CreateEmpty(app.context, {
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
                Actor.CreateEmpty(app.context, {
                    actor: {
                        parentId: container.id,
                        transform: {
                            local: {
                                position: {x: -0.6, z: -0.002}
                            }
                        },
                        text: {
                            contents: letters[i],
                            anchor: TextAnchorLocation.MiddleLeft,
                            height: 0.125,
                            justify: TextJustify.Left
                        }
                    }
                });
                Actor.CreateEmpty(app.context, {
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
                            anchor: TextAnchorLocation.MiddleLeft,
                            height: 0.125,
                            justify: TextJustify.Left
                        }
                    }
                });
                const button = Actor.CreateFromPrefab(app.context, {
                    prefabId: answerButtonModel.prefabs[0].id,
                    actor: {
                        parentId: container.id,
                        name: `answer${i}Button`
                    }
                });
                button.created().then(() => {
                    button.children[1].children[0].appearance.material = answerColors[i];
                }).catch();
                if (app.gamemode === 'new') {
                    const selectedBorder = Actor.CreateFromPrefab(app.context, {
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
                        selectedBorder.children[0].children[0].appearance.enabled = new GroupMask(app.context, [`answered${letters[i].substr(0, 1)}`]);
                        selectedBorder.children[0].children[0].appearance.material.color = colors.teal.color;
                    }).catch();
                }
            }

            // console.log(screen);
            // screen.value.findChildrenByName('question', false)[0].text.contents = 'Hello';
            if (!first) {
                if (app.gamemode === 'classic') {
                    cont.findChildrenByName('logo', true)[0].transform.local = mainScreen.findChildrenByName('logo', true)[0].transform.local;
                }
                scores.transform.local = mainScreen.findChildrenByName('scoreText', true)[0].transform.local;
                screen.transform.local = mainScreen.findChildrenByName('screen', true)[0].transform.local;
                screen.findChildrenByName('question', true)[0].text.contents = mainScreen.findChildrenByName('question', true)[0].text.contents;
                for (let i = 0; i < 4; i++) {
                    screen.findChildrenByName(`answer${i}Text`, true)[0].text.contents = mainScreen.findChildrenByName(`answer${i}Text`, true)[0].text.contents;
                    screen.findChildrenByName(`answer${i}Text`, true)[0].text.height = mainScreen.findChildrenByName(`answer${i}Text`, true)[0].text.height;
                }
            }
            return cont;
        }

        function categorySelect(categories: any) {
            console.log(`Round: ${app.currentRound}`);
            shuffleArray(categories);
            console.log(categories[0], categories[1], categories[2], categories[3]);
            for (const pod of app.podiumList) {
                if (pod.id !== null) {
                    pod.screen.findChildrenByName('question', true)[0].text.contents = wrapText('Select category', 30);
                }
            }
            hostScreen.findChildrenByName('question', true)[0].text.contents = wrapText('Select category', 30);
            mainScreen.findChildrenByName('question', true)[0].text.contents = wrapText('Select category', 30);
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
                mainScreen.findChildrenByName('answer0BorderSelected', true)[0].children[0].children[0].appearance.material = colors.teal;
                mainScreen.findChildrenByName('answer1BorderSelected', true)[0].children[0].children[0].appearance.material = colors.teal;
                mainScreen.findChildrenByName('answer2BorderSelected', true)[0].children[0].children[0].appearance.material = colors.teal;
                mainScreen.findChildrenByName('answer3BorderSelected', true)[0].children[0].children[0].appearance.material = colors.teal;
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

            for (const pod of app.podiumList) {
                if (pod.id !== null) {
                    pod.screen.findChildrenByName('question', true)[0].text.contents = wrapText(question.question, 30);
                }
            }
            if (app.gamemode === 'classic') {
                hostScreen.findChildrenByName('question', true)[0].text.contents = wrapText(question.question, 30);
            }
            mainScreen.findChildrenByName('question', true)[0].text.contents = wrapText(question.question, 30);

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
                    const text3 = mainScreen.findChildrenByName(`answer${i}Text`, true)[0];
                    text3.text.contents = answers[i];
                    scaleText(answers[i], text3);
                    answerColors[i].color = colors.white.color;
                }, app.gamemode === 'new' ? 2000 : 0);
            }
            console.log(answers, correctAnswer);
        }

        function revealAnswer(): boolean {
            for (let i = 0; i < 4; i++) {
                let color: Material = colors.white;
                if (i === correctAnswer) {
                    color = colors.green;
                } else if (i === currentSelected) {
                    color = colors.red;
                }
                answerColors[i].color = color.color;
            }

            if (app.gamemode === 'new') {
                mainScreen.findChildrenByName('answer0BorderSelected', true)[0].children[0].children[0].appearance.material = colors.red;
                mainScreen.findChildrenByName('answer1BorderSelected', true)[0].children[0].children[0].appearance.material = colors.red;
                mainScreen.findChildrenByName('answer2BorderSelected', true)[0].children[0].children[0].appearance.material = colors.red;
                mainScreen.findChildrenByName('answer3BorderSelected', true)[0].children[0].children[0].appearance.material = colors.red;
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
                        const scoreText = Actor.CreateEmpty(app.context, {
                            actor: {
                                parentId: p.icon.id,
                                name: 'scoreText',
                                transform: {local: {
                                    position: {y: 0.12}
                                }},
                                text: {
                                    contents: p.answer === correctAnswer ? `+${100 + Math.round(p.timeToAnswer * 10)}` : '-100',
                                    height: 0.075,
                                    anchor: TextAnchorLocation.MiddleCenter
                                }
                            }
                        });
                        setTimeout(() => {
                            scoreText.destroy();
                        }, 5000);
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

        function createConfirmButton(screen: Actor): Actor {
            const button = Actor.CreatePrimitive(app.context, {
                definition: {
                    shape: PrimitiveShape.Box,
                    dimensions: {x: 0.15, y: 0.15, z: 0.02}
                },
                addCollider: true,
                actor: {
                    name: 'confirm',
                    parentId: screen.id,
                    appearance: {
                        materialId: colors.green.id
                    },
                    transform: {local: {
                        position: {x: -0.2, y: -0.815}
                    }}
                }
            });
            Actor.CreateEmpty(app.context, {
                actor: {
                    parentId: button.id,
                    text: {
                        contents: '    Confirm',
                        height: 0.125,
                        anchor: TextAnchorLocation.MiddleLeft
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
                const bar = Actor.CreatePrimitive(app.context, {
                    definition: {
                        shape: PrimitiveShape.Box,
                        dimensions: {x: 0.1, y: 1, z: 0.001}
                    },
                    actor: {
                        parentId: p.icon.id,
                        name: 'scoreBar',
                        transform: {local: {
                            position: {y: 0.1},
                            scale: {y: 0}
                        }}
                    }
                });
                bar.animateTo({transform: {local: {
                    position: {y: 0.1 + (0.8 * (scoreVal / highScore))},
                    scale: {y: 1.6 * (scoreVal / highScore)}
                }}}, 3 * (scoreVal / highScore), AnimationEaseCurves.Linear);
                setTimeout(() => {
                    Actor.CreateEmpty(app.context, {
                        actor: {
                            parentId: p.icon.id,
                            name: 'scoreText',
                            transform: {local: {
                                position: {y: 1.6 * (scoreVal / highScore) + 0.2}
                            }},
                            text: {
                                contents: p.score.toString(),
                                height: 0.15,
                                anchor: TextAnchorLocation.MiddleCenter
                            }
                        }
                    });
                    playSound(scoreVal === highScore ? 'correct' : 'buzz', (scoreVal / highScore) - 1);
                }, 3000 * (scoreVal / highScore));
            }
            playSound('rise');
        }

        let soundPlayer = Actor.CreateEmpty(app.context, {actor: {name: 'sound', parentId: app.scene.id}});
        const sounds: {[key: string]: MRESDK.Sound} = {
                buzz: app.assets.createSound('buzz', {uri: app.baseUrl + '/sounds/ding.ogg'}),
                correct: app.assets.createSound('correct', {uri: app.baseUrl + '/sounds/correct.ogg'}),
                wrong: app.assets.createSound('wrong', {uri: app.baseUrl + '/sounds/wrong.ogg'}),
                rise: app.assets.createSound('rise', {uri: app.baseUrl + '/sounds/rise.ogg'}),
                ticktock: app.assets.createSound('tick', {uri: app.baseUrl + '/sounds/ticktock.ogg'})
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
        function scaleText(text: string, actor: Actor) {
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
        function wrapText(input: string, lineLength: number) {
            const words: string[] = input.split(' ');
            let result = '';
            let line = '';

            for (const s of words) {
                const temp = line + ' ' + s;
                if (temp.length > lineLength) {
                    result += line + "\n";
                    line = s;
                } else {
                    line = temp;
                }
            }

            result += line;
            return result.substring(1, result.length);
        }
    }
}
