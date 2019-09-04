/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import AltQuiz from './app';

export default class Screen {
	public actor: MRE.Actor;

	private assets: MRE.AssetContainer;
	private borderMaterial: MRE.Material;

	public constructor(private app: AltQuiz, root: MRE.Actor) {
		this.assets = new MRE.AssetContainer(this.app.context);
		this.actor = MRE.Actor.CreateFromGltf(this.assets, {
			uri: app.baseUrl + '/screen.glb',
			actor: {
				name: 'screen',
				parentId: root.id,
				transform: {
					local: {
						rotation: MRE.Quaternion.RotationAxis(MRE.Vector3.Up(), 180 * MRE.DegreesToRadians)
					}
				}
			}
		});
		this.actor.created().then(() =>
			this.borderMaterial = this.assets.materials[1]
		).catch(reason => {
			console.error(`Screen.glb failed to load: ${reason}`);
			this.borderMaterial = null;
		});
	}

	public setBorderColor(color: MRE.Color4) {
		if (this.borderMaterial) {
			this.borderMaterial.color = color;
		} else {
			this.actor.created().then(() => {
				this.setBorderColor(color);
			}).catch();
		}
	}

	/**
	 * @param value From values 0 to 1, border will disappear. From 1 to 2, it will reappear.
	 */
	public setBorderProgress(value: number) {
		if (this.borderMaterial) {
			value = Math.max(Math.min(value, 2.0), 0.0);
			this.borderMaterial.mainTextureOffset.set(-0.5 * value, 0);
		} else {
			this.actor.created().then(() => {
				this.setBorderProgress(value);
			}).catch();
		}
	}

	public unload() {
		this.actor.destroy();
		this.assets.unload();
	}
}
