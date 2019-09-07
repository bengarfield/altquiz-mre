/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

import AltQuiz from './app';

export default class Screen {
	public actor: MRE.Actor;

	public constructor(private app: AltQuiz, root: MRE.Actor) {
		this.actor = MRE.Actor.CreateFromPrefab(this.app.context, {
			prefabId: this.app.sharedAssets.screen.id,
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
	}

	public setBorderColor(color: MRE.Color4) {
		this.app.sharedAssets.screenBorderMat.color = color;
	}

	/**
	 * @param value From values 0 to 1, border will disappear. From 1 to 2, it will reappear.
	 */
	public setBorderProgress(value: number) {
		this.app.sharedAssets.screenBorderMat.mainTextureOffset.set(-0.5 * value, 0);
	}

	public unload() {
		this.actor.destroy();
		this.app.screen = undefined;
	}
}
