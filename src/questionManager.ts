/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { QueryResult } from 'pg';
import pgescape from 'pg-escape';
import request from 'request';

import AltQuiz from './app';
import Database from './db';

interface Category {
	id: number;
	name: string;
}

interface Question {
	category: string;
	type: string;
	difficulty: string;
	question: string;
	correct_answer: string;
	incorrect_answers: string[];
	answers: string[];
}

interface QuestionList {
	[key: string]: {
		[key: string]: Question[];
	};
}

const categories: Category[] = [
	{id: 9, name: 'General Knowledge'},
	{id: 10, name: 'Entertainment: Books'},
	{id: 11, name: 'Entertainment: Film'},
	{id: 12, name: 'Entertainment: Music'},
	{id: 13, name: 'Entertainment: Musicals & Theatres'},
	{id: 14, name: 'Entertainment: Television'},
	{id: 15, name: 'Entertainment: Video Games'},
	{id: 16, name: 'Entertainment: Board Games'},
	{id: 17, name: 'Science & Nature'},
	{id: 18, name: 'Science: Computers'},
	{id: 19, name: 'Science: Mathematics'},
	{id: 20, name: 'Mythology'},
	{id: 21, name: 'Sports'},
	{id: 22, name: 'Geography'},
	{id: 23, name: 'History'},
	{id: 24, name: 'Politics'},
	{id: 25, name: 'Art'},
	{id: 26, name: 'Celebrities'},
	{id: 27, name: 'Animals'},
	{id: 28, name: 'Vehicles'},
	{id: 29, name: 'Entertainment: Comics'},
	{id: 30, name: 'Science: Gadgets'},
	{id: 31, name: 'Entertainment: Japanese Anime & Manga'},
	{id: 32, name: 'Entertainment: Cartoon & Animations'}];

export default class QuestionManager {
	private questionCount = 0;
	private tempQuestons: Question[] = [];
	private updating = false;

	public constructor(private db: Database) { }

	public async questionManager(app: AltQuiz) {
		// const {Client} = require('pg');
		// console.log(pgescape('INSERT INTO %I VALUES(%L)', 'testing', "What breed of dog was 'Marley' in the film 'Marley & Me'?"));
		await this.db.query("CREATE TABLE IF NOT EXISTS questionsTest (" +
			"id SERIAL PRIMARY KEY," +
			"source varchar(10) NOT NULL," +
			"categoryId int NOT NULL," +
			"category varchar(255) NOT NULL," +
			"difficulty varchar(255) NOT NULL," +
			"question varchar(255) NOT NULL," +
			"answer varchar(255) NOT NULL," +
			"incorrect1 varchar(255) NOT NULL," +
			"incorrect2 varchar(255) NOT NULL," +
			"incorrect3 varchar(255) NOT NULL)");

		const token = 'a0fbccd6ffd7b378ae4fc7aaa4b4d8a16882f3fb48303c9185caca3957bee47b';
		const countText = MRE.Actor.CreateEmpty(app.context, {
			actor: {
				transform: {
					local: {
						position: {x: -1}
					}
				},
				text: {
					contents: 'Questions in database:',
					height: 0.1
				}
			}
		});
		const updateButton = MRE.Actor.CreatePrimitive(new MRE.AssetContainer(app.context), {
			definition: {
				shape: MRE.PrimitiveShape.Box,
				dimensions: {x: 0.1, y: 0.1, z: 0.1}
			},
			addCollider: true,
			actor: {
				transform: {
					local: {
						position: {x: -1, y: -1}
					}
				}
			}
		});
		const updateText = MRE.Actor.CreateEmpty(app.context, {
			actor: {
				transform: {
					local: {
						position: {x: -0.9, y: -1}
					}
				},
				text: {
					contents: 'Check for new questions',
					height: 0.1,
					anchor: MRE.TextAnchorLocation.MiddleLeft
				}
			}
		});
		const updateClick = updateButton.setBehavior(MRE.ButtonBehavior);
		updateClick.onButton("pressed", (user: MRE.User) => {
			if (!this.updating) {
				this.updating = true;
				this.tempQuestons.splice(0, this.tempQuestons.length);
				this.fillDB('', 50, updateText);
			}
		});
		const categoryCountText = MRE.Actor.CreateEmpty(app.context, {
			actor: {
				transform: {
					local: {
						position: {x: 1}
					}
				},
				text: {
					contents: 'Categories:',
					height: 0.1
				}
			}
		});
		const questionText = MRE.Actor.CreateEmpty(app.context, {
			actor: {
				transform: {
					local: {
						position: {x: 4}
					}
				},
				text: {
					contents: '',
					height: 0.1
				}
			}
		});

		this.db.query('SELECT source, count(source) FROM questionsTest GROUP by source')
		.then(res => {
			console.log(res);
			const count: {[key: string]: number} = {};
			for (const a of res.rows) {
				count[a.source] = Number(a.count);
			}
			if (!count.User) {
				count.User = 0;
			}
			console.log(count);
			countText.text.contents = `Questions in database:\n\nOpenTDB: ${count.OpenTDB}\nUser submitted: ${count.User}\nTotal: ${count.OpenTDB + count.User}`;
			this.questionCount = count.OpenTDB;
		})
		.catch(err => console.log(err));

		this.db.query('SELECT category, count(category) FROM questionsTest GROUP by category ORDER BY count DESC')
		.then(res => {
			console.log(res);
			const count: {[key: string]: number} = {};
			for (const a of res.rows) {
				count[a.category] = Number(a.count);
			}
			// console.log(count);
			this.db.query('SELECT category, difficulty, count(*) FROM questionsTest GROUP by category, difficulty ORDER BY count DESC')
			.then(res2 => {
				console.log(res2);
				let str2 = '';
				const obj: {
					[key: string]: any;
				} = {};
				for (const a of res2.rows) {
					if (!Object.keys(obj).includes(a.category)) {
						obj[a.category] = {easy: 0, medium: 0, hard: 0};
					}
					obj[a.category][a.difficulty] = Number(a.count);
				}
				// console.log(obj);
				for (const a of Object.keys(count)) {
					str2 += `${a}: ${count[a]} - (E: ${obj[a].easy}, M: ${obj[a].medium}, H: ${obj[a].hard})\n`;
				}
				// console.log(count);
				categoryCountText.text.contents =  'Categories:\n\n' + str2;
			})
			.catch(err2 => console.log(err2));
			// categoryCountText.value.text.contents =  'Categories:\n\n' + str;
		})
		.catch(err => console.log(err));
	}

	private fillDB(token: string, ammount: number, text: MRE.Actor) {
		console.log('Updating...');
		if (token === '') {
			console.log('No token.');
			request('https://opentdb.com/api_token.php?command=request', {json: true}, (err, res, body) => {
				console.log(body.token);
				this.fillDB(body.token, ammount, text);
			});
		} else {
			request(
				`https://opentdb.com/api.php?type=multiple&encode=url3986&amount=${ammount}&token=${token}&${Math.random().toString()}`,
				{json: true},
				(err, res, body) => {
				if (body.response_code === 0) {
					const results: Question[] = body.results;
					this.decode(results);
					console.log(results);
					for (const q of results) {
						this.tempQuestons.push(q);
						text.text.contents = `Questions loaded: ${this.tempQuestons.length}`;
						const sql = pgescape("INSERT INTO questionsTest " +
							"(source, categoryId, category, difficulty, question, answer, incorrect1, incorrect2, incorrect3)" +
							"VALUES('OpenTDB', " + this.findCategoryId(q.category) + ", %L, %L, %L, %L, %L, %L, %L)",
							q.category, q.difficulty, q.question, q.correct_answer, q.incorrect_answers[0], q.incorrect_answers[1], q.incorrect_answers[2]);
						this.db.query(sql).catch(err2 => {
							if (err2 !== null) {
								console.log(err2);
							}
						});
					}
					this.fillDB(token, ammount, text);
				} else if (body.response_code === 4 && ammount > 0) {
					console.log(`Not enough questions, trying ${Math.floor(ammount / 2)}`);
					this.fillDB(token, Math.floor(ammount / 2), text);
				} else if (ammount === 0) {
					console.log('All questions loaded');
					console.log(`Questions: ${this.tempQuestons.length}`);

					text.text.contents = this.tempQuestons.length > this.questionCount ? `${this.tempQuestons.length - this.questionCount} new questions.` : 'No new questions.';

					// text.text.contents = `Total questions: ${tempQuestons.length}`;
					console.log(this.tempQuestons);
					this.updating = false;
					this.compareResults(this.tempQuestons);
				}
			});
		}
	}

	private async loadQuestions(): Promise<QueryResult> {
		return this.db.query('SELECT * FROM questionsTest ORDER BY RANDOM() LIMIT 50');
	}

	private compareResults(newResults: Question[]) {
		const sql = pgescape("SELECT question FROM questionsTest WHERE source = %L", "OpenTDB");
		this.db.query(sql)
		.then(res => {
			console.log(res);
			const temp: string[] = [];
			for (const q of res.rows) {
				temp.push(pgescape('%I', q.question));
			}
			for (const q of newResults) {
				if (!temp.includes(pgescape('%I', q.question))) {
					console.log(q);
					console.log(pgescape('%s', q.question));
					console.log(pgescape('%I', q.question));
					console.log(pgescape('%L', q.question));
				}
			}
		})
		.catch(err => console.log(err));
	}

	private getAllQuestions(text: MRE.Text, screen: MRE.Actor) {
		request(`https://opentdb.com/api_token.php?command=request&${Math.random().toString()}`, {json: true}, (err, res, body) => {
			if (body.response_code === 0) {
				const token = body.token;
				let done = 0;
				const questions: QuestionList = {};
				console.log(`Token: ${token}`);

				categories.forEach((c) => {
					qGet(c, 'easy');
					qGet(c, 'medium');
					qGet(c, 'hard');
				});
				// qGet(categories[0], 'easy');
				const qGet = (cat: Category, diff: string) => {
					request(`https://opentdb.com/api.php?amount=5&difficulty=${diff}&type=multiple&encode=url3986&category=${cat.id}&token=${token}&${Math.random().toString()}`, {json: true}, (err2, res2, body2) => {
						const results: Question[] = body2.results;
						this.decode(results);
						this.sortAnswers(results);

						if (questions[cat.id.toString()]) {
							questions[cat.id.toString()][diff] = results;
						} else {
							questions[cat.id.toString()] = {};
							questions[cat.id.toString()][diff] = results;
						}

						done++;
						console.log(`Loading: ${Math.round((done * 100) / (categories.length * 3))}%`);
						text.contents = `Loading: ${Math.round((done * 100) / (categories.length * 3))}%`;
						if (done === categories.length * 3) {
							text.contents = 'Questions Loaded';
							console.log(questions);
							screen.findChildrenByName('question', false)[0].text.contents = this.ResolveTextSize(questions[categories[0].id].easy[0].question, 30);

							screen.findChildrenByName('a', false)[0].text.contents = `A: ${questions[categories[0].id].easy[0].answers[0]}`;
							screen.findChildrenByName('b', false)[0].text.contents = `B: ${questions[categories[0].id].easy[0].answers[1]}`;
							screen.findChildrenByName('c', false)[0].text.contents = `C: ${questions[categories[0].id].easy[0].answers[2]}`;
							screen.findChildrenByName('d', false)[0].text.contents = `D: ${questions[categories[0].id].easy[0].answers[3]}`;
						}
					});
				};
			}
		});
	}

	private findCategoryId(cat: string) {
		let id = 0;
		for (const c of categories) {
			if (c.name === cat) {
				id = c.id;
			}
		}
		return id;
	}

	private ResolveTextSize(input: string, lineLength: number) {
		// Split string by char " "
		const words: string[] = input.split(' ');
		// Prepare result
		let result = '';
		// Temp line string
		let line = '';

		// for each all words
		for (const s of words) {
			// Append current word into line
			const temp = line + ' ' + s;
			// If line length is bigger than lineLength
			if (temp.length > lineLength) {
				// Append current line into result
				result += line + "\n";
				// Remain word append into new line
				line = s;
			} else {
				// Append current word into current line
				line = temp;
			}
		}

		// Append last line into result
		result += line;
		// Remove first " " char
		return result.substring(1, result.length);
	}

	private decode(data: Question[]) {
		for (const q of data) {
			q.category = decodeURIComponent(q.category);
			q.difficulty = decodeURIComponent(q.difficulty);
			q.question = decodeURIComponent(q.question);
			this.addslashes(q.question);
			q.correct_answer = decodeURIComponent(q.correct_answer);
			this.addslashes(q.correct_answer);
			for (const inc of q.incorrect_answers) {
				q.incorrect_answers[q.incorrect_answers.indexOf(inc)] = decodeURIComponent(inc);
			}
			this.addslashes(q.incorrect_answers[0]);
			this.addslashes(q.incorrect_answers[1]);
			this.addslashes(q.incorrect_answers[2]);
		}
		return data;
	}

	private addslashes(str: string) {
		// str = str.replace(/\\/g, '\\\\');
		str = str.replace(/\'/g, '\'\'');
		// str = str.replace(/\"/g, '\\"');
		// str = str.replace(/\0/g, '\\0');
		return str;
	}

	private sortAnswers(list: Question[]) {
		for (const q of list) {
			const c = Math.floor(Math.random() * 4);
			const answers = q.incorrect_answers;
			this.shuffleArray(answers);

			answers.splice(c, 0, q.correct_answer);

			if (c === 0) {
				q.correct_answer = 'a';
			} else if (c === 1) {
				q.correct_answer = 'b';
			} else if (c === 2) {
				q.correct_answer = 'c';
			} else if (c === 3) {
				q.correct_answer = 'd';
			}
			q.answers = q.incorrect_answers;
			delete q.incorrect_answers;
			delete q.category;
			delete q.type;
			delete q.difficulty;
		}
	}

	private shuffleArray<T>(array: T[]) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	}
}

// client.query('SELECT category, difficulty, count(*) FROM questionsTest GROUP by category, difficulty ORDER BY count DESC', (err: any, res: any) => {
//     console.log(err, res);
//     let str = '';
//     const obj: {
//         [key: string]: any;
//     } = {};
//     for (const a of res.rows) {
//         str += `${a.category}, ${a.difficulty}: ${a.count}\n`;
//         if (!Object.keys(obj).includes(a.category)) {
//             obj[a.category] = {easy: 0, medium: 0, hard: 0, total: 0};
//         }
//         obj[a.category][a.difficulty] = Number(a.count);
//         obj[a.category].total += Number(a.count);
//     }
//     console.log(obj);
//     str = '';
//     for (const a of Object.keys(obj)) {
//         str += `${a}: ${obj[a].total},   E:${obj[a].easy}, M:${obj[a].medium}, H:${obj[a].hard}\n`;
//     }
//     // console.log(count);
//     questionText.value.text.contents =  'Difficulties:\n\n' + str;
// });
// fillDB(token, 50);
