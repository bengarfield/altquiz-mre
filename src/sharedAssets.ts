/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

export default class SharedAssets {
	public answerButton: MRE.Prefab;
	public logoMat: MRE.Material;

	private container: MRE.AssetContainer;

	public load(context: MRE.Context, baseUrl: string): Promise<void> {
		this.container = new MRE.AssetContainer(context);

		const logoTex = this.container.createTexture('logo', {
			uri: baseUrl + '/textures/logo.png'
		});
		this.logoMat = this.container.createMaterial('logo', {
			mainTextureId: logoTex.id
		});
		return Promise.all([
			this.logoMat.created,
			this.container.loadGltf(baseUrl + '/answerButton.glb', 'mesh')
				.then<void>(assets => {
					this.answerButton = assets.find(a => !!a.prefab) as MRE.Prefab;
				})
		]).then<void>();
	}
}
