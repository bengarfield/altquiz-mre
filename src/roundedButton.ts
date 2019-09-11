/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

export default function createRoundedButton(container: MRE.AssetContainer, options: {
	width: number,
	height: number,
	borderThickness: number,
	radius: number,
	textSize: number,
	text: string,
	actor?: Partial<MRE.ActorLike>
}): MRE.Actor {

	const root = MRE.Actor.Create(container.context, {
		actor: {
			name: 'roundedButton',
			collider: {
				geometry: {
					shape: 'box',
					size: { x: options.width, y: options.height, z: 0.01 },
					center: { x: 0, y: 0, z: -0.0025 }
				}
			}
		}
	});

	// create border
	let borderMat = container.materials.find(m => m.name === 'buttonBorder');
	if (!borderMat) {
		borderMat = container.createMaterial('buttonBorder', {
			color: MRE.Color3.White()
		});
	}
	createRoundedBox(container, {
		width: options.width,
		height: options.height,
		radius: options.radius,
		mat: borderMat,
		actor: { parentId: root.id }
	});

	// create button
	let bgMat = container.materials.find(m => m.name === 'buttonBg');
	if (!bgMat) {
		bgMat = container.createMaterial('buttonBg', {
			color: { r: .1477, g: .3514, b: .3773, a: 1 }
		});
	}
	createRoundedBox(container, {
		width: options.width - options.borderThickness * 2,
		height: options.height - options.borderThickness * 2,
		radius: options.radius - options.borderThickness,
		mat: bgMat,
		actor: {
			parentId: root.id,
			transform: { local: { position: { z: -.005 } } }
		}
	});

	// create label
	MRE.Actor.Create(container.context, {
		actor: {
			name: 'label',
			transform: { local: { position: { z: -0.008 } } },
			text: {
				contents: options.text,
				height: options.textSize,
				justify: MRE.TextJustify.Center,
				anchor: MRE.TextAnchorLocation.MiddleCenter
			}
		}
	});

	return root;
}

function createRoundedBox(container: MRE.AssetContainer, o: {
	width: number,
	height: number,
	radius: number,
	mat: MRE.Material,
	actor?: Partial<MRE.ActorLike>
}): MRE.Actor {
	let box = container.meshes.find(m => m.name === 'buttonBox');
	if (!box) {
		box = container.createBoxMesh('buttonBox', 1, 1, 0.005);
	}
	let corner = container.meshes.find(m => m.name === 'buttonCorner');
	if (!corner) {
		corner = container.createCylinderMesh('buttonCorner', 0.005, 1, 'z', 16);
	}

	const root = MRE.Actor.Create(container.context, {
		actor: {
			...o.actor,
			name: 'roundedBox',
		}
	});

	MRE.Actor.Create(container.context, {
		actor: {
			name: 'centralBox',
			parentId: root.id,
			appearance: { meshId: box.id, materialId: o.mat.id },
			transform: { local: { scale: { x: o.width - 2 * o.radius, y: o.height - 2 * o.radius } } }
		}
	});
	MRE.Actor.Create(container.context, {
		actor: {
			name: 'northBox',
			parentId: root.id,
			appearance: { meshId: box.id, materialId: o.mat.id },
			transform: {
				local: {
					position: { y: (o.height - o.radius) / 2 },
					scale: { x: o.width - 2 * o.radius, y: o.radius }
				}
			}
		}
	});
	MRE.Actor.Create(container.context, {
		actor: {
			name: 'southBox',
			parentId: root.id,
			appearance: { meshId: box.id, materialId: o.mat.id },
			transform: {
				local: {
					position: { y: (o.height - o.radius) / -2 },
					scale: { x: o.width - 2 * o.radius, y: o.radius }
				}
			}
		}
	});
	MRE.Actor.Create(container.context, {
		actor: {
			name: 'westBox',
			parentId: root.id,
			appearance: { meshId: box.id, materialId: o.mat.id },
			transform: {
				local: {
					position: { x: (o.width - o.radius) / 2 },
					scale: { x: o.radius, y: o.height - 2 * o.radius }
				}
			}
		}
	});
	MRE.Actor.Create(container.context, {
		actor: {
			name: 'eastBox',
			parentId: root.id,
			appearance: { meshId: box.id, materialId: o.mat.id },
			transform: {
				local: {
					position: { x: (o.width - o.radius) / -2 },
					scale: { x: o.radius, y: o.height - 2 * o.radius }
				}
			}
		}
	});

	return root;
}