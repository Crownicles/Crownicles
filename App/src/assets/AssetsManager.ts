import * as FileSystem from 'expo-file-system';
import {EncodingType} from 'expo-file-system';
import {RestApi} from "@/src/networking/RestApi";

export class AssetsManager {
	private static assets: Map<string, string> | null = null;

	private static async readLocalAssets(): Promise<{ file: string, hash: string }[]> {
		const assetsWithHashes: { file: string, hash: string }[] = [];

		const readDirectoryRecursively = async (dir: string): Promise<void> => {
			const dirInfo = await FileSystem.getInfoAsync(dir);
			if (!dirInfo.exists || !dirInfo.isDirectory) {
				return;
			}
			const entries = await FileSystem.readDirectoryAsync(dir);
			for (const entry of entries) {
				const fileInfo = await FileSystem.getInfoAsync(dir + "/" + entry);
				if (fileInfo.isDirectory) {
					await readDirectoryRecursively(dir + "/" + entry);
				}
				else {
					const hash = await FileSystem.getInfoAsync(dir + "/" + entry, { md5: true });
					if (hash.exists) {
						let assetName = (dir + "/" + entry).split("/").slice(FileSystem.documentDirectory!.split("/").length).join("/");
						assetsWithHashes.push({file: assetName, hash: hash.md5!});
						console.log(`Asset: ${assetName}, Hash: ${hash.md5}`);
					}
				}
			}
		}

		await readDirectoryRecursively(FileSystem.documentDirectory + "assets");

		return assetsWithHashes;
	}

	static async updateAssets(): Promise<void> {
		const documentDirectoryInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
		if (!documentDirectoryInfo.exists || !documentDirectoryInfo.isDirectory) {
			throw new Error("Document directory does not exist or is not a directory.");
		}

		let assetDirectory = FileSystem.documentDirectory + "assets";
		const dirInfo = await FileSystem.getInfoAsync(assetDirectory);
		if (!dirInfo.exists) {
			await FileSystem.makeDirectoryAsync(assetDirectory, { intermediates: true });
			console.log("Created assets directory:", assetDirectory);
		}

		let localAssets = await this.readLocalAssets();
		let remoteAssets = await RestApi.getAssets();

		let assetsToUpdate = remoteAssets.filter(remoteAsset => {
			const localAsset = localAssets.find(local => local.file === remoteAsset.file);
			return !localAsset || localAsset.hash !== remoteAsset.hash;
		});

		console.log("Assets to update:", assetsToUpdate);

		for (const assetToUpdate of assetsToUpdate) {
			let assetContent = await RestApi.downloadAsset(assetToUpdate.file);
			let assetPath = FileSystem.documentDirectory + "assets/" + assetToUpdate.file;
			let directories = assetToUpdate.file.split("/");
			for (let i = 0; i < directories.length - 1; i++) {
				const dirPath = FileSystem.documentDirectory + "assets/" + directories.slice(0, i + 1).join("/");
				const dirInfo = await FileSystem.getInfoAsync(dirPath);
				if (!dirInfo.exists) {
					await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
					console.log(`Created directory: ${dirPath}`);
				}
			}
			await FileSystem.writeAsStringAsync(assetPath, assetContent, {
				encoding: FileSystem.EncodingType.UTF8
			});
			const assetHash = await FileSystem.getInfoAsync(FileSystem.documentDirectory + "assets/" + assetToUpdate.file, { md5: true });
			if (!assetHash.exists) {
				throw new Error(`Asset ${assetToUpdate.file} does not exist after download.`);
			}
			if (assetHash.md5 !== assetToUpdate.hash) {
				throw new Error(`Asset ${assetToUpdate.file} hash mismatch: expected ${assetToUpdate.hash}, got ${assetHash.md5}`);
			}
			console.log(`Updated asset: ${assetToUpdate.file}`);
		}

		this.assets = new Map<string, string>();
		for (const asset of remoteAssets) {
			let assetContent = await FileSystem.readAsStringAsync(FileSystem.documentDirectory + "assets/" + asset.file, {
				encoding: EncodingType.UTF8
			});
			this.assets.set(asset.file, assetContent);
		}
	}

	static getAssets(filter: (file: string) => boolean = () => true): Map<string, string> {
		if (this.assets === null) {
			throw new Error("Assets have not been initialized. Call updateAssets() first.");
		}

		const filteredAssets = new Map<string, string>();
		for (const [file, content] of this.assets.entries()) {
			if (filter(file)) {
				filteredAssets.set(file, content);
			}
		}
		return filteredAssets;
	}

	static areAssetsReady(): boolean {
		return this.assets !== null;
	}
}