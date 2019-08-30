/*!
 * Copyright (c) Ben Garfield. All rights reserved.
 * Licensed under the MIT License.
 */
import * as MRE from '@microsoft/mixed-reality-extension-sdk';

export default class ColorMaterials {
	// solid color materials
	public black: MRE.Material;
	public blue: MRE.Material;
	public darkGrey: MRE.Material;
	public green: MRE.Material;
	public grey: MRE.Material;
	public red: MRE.Material;
	public darkRed: MRE.Material;
	public teal: MRE.Material;
	public white: MRE.Material;
	public yellow: MRE.Material;
	private assets: MRE.AssetContainer;

	public constructor(context: MRE.Context) {
		this.assets = new MRE.AssetContainer(context);

		this.black = this.assets.createMaterial('black', { color: MRE.Color3.Black() });
		this.blue = this.assets.createMaterial('blue', { color: MRE.Color3.Blue() });
		this.darkGrey = this.assets.createMaterial('darkGrey', { color: new MRE.Color3(0.2, 0.2, 0.2) });
		this.green = this.assets.createMaterial('green', { color: MRE.Color3.Green() });
		this.grey = this.assets.createMaterial('grey', { color: new MRE.Color3(0.4, 0.4, 0.4) });
		this.red = this.assets.createMaterial('red', { color: new MRE.Color3(0.6, 0, 0) });
		this.darkRed = this.assets.createMaterial('darkRed', { color: new MRE.Color3(0.2, 0, 0) });
		this.teal = this.assets.createMaterial('teal', { color: MRE.Color3.Teal() });
		this.white = this.assets.createMaterial('white', { color: MRE.Color3.White() });
		this.yellow = this.assets.createMaterial('yellow', { color: MRE.Color3.Yellow() });
	}
}
