/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

interface Resource {
	container: MRE.AssetContainer;
	mainAsset?: MRE.Asset;
}

export default class SharedAssets {
	private resources: { [name: string]: Resource } = {};

	public get answerButton() {
		return this.resources.answerButton.mainAsset as MRE.Prefab;
	}
	public get logo() {
		return this.resources.logo.mainAsset as MRE.Material;
	}
	public get screen() {
		return this.resources.screen.mainAsset as MRE.Prefab;
	}
	public get screenBorderMat() {
		return this.resources.screen.container.materials[1];
	}

	public load(context: MRE.Context, baseUrl: string): Promise<void> {
		const promises: Array<Promise<void>> = [];
		let r: Resource;
		let p: Promise<void>;

		// load logo
		r = { container: new MRE.AssetContainer(context) } as Resource;
		this.resources.logo = r;
		r.mainAsset = r.container.createMaterial('logo', {
			mainTextureId: r.container.createTexture('logo', {
				uri: baseUrl + '/textures/logo.png'
			}).id
		});
		promises.push(r.mainAsset.created);

		// load answer button
		r = { container: new MRE.AssetContainer(context) } as Resource;
		this.resources.answerButton = r;
		p = r.container.loadGltf(baseUrl + '/answerButton.glb', 'mesh')
			.then(assets => {
				this.resources.answerButton.mainAsset = assets.find(a => !!a.prefab);
			});
		promises.push(p);

		// load screen
		r = { container: new MRE.AssetContainer(context) } as Resource;
		this.resources.screen = r;
		p = r.container.loadGltf(baseUrl + '/screen.glb')
			.then(assets => {
				this.resources.screen.mainAsset = assets.find(a => !!a.prefab);
			});
		promises.push(p);

		return Promise.all(promises).then<void>();
	}
}
