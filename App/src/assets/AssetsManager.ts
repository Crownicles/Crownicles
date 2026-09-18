import {
	EncodingType,
	documentDirectory,
	getInfoAsync,
	makeDirectoryAsync,
	readAsStringAsync,
	readDirectoryAsync,
	writeAsStringAsync
} from "expo-file-system/legacy";
import {RestApi} from "@/src/networking/RestApi";
import {AppIcons} from "@/src/AppIcons";
import {reloadI18n} from "@/src/translations/i18nLoader";

export class AssetsManager {
	private static assets: Map<string, string> | null = null;

	private static async readLocalAssets(): Promise<{ file: string, hash: string }[]> {
		const assetsWithHashes: { file: string, hash: string }[] = [];

		const readDirectoryRecursively = async (dir: string): Promise<void> => {
			const dirInfo = await getInfoAsync(dir);
			if (!dirInfo.exists || !dirInfo.isDirectory) {
				return;
			}
			const entries = await readDirectoryAsync(dir);
			for (const entry of entries) {
				const filePath = `${dir}/${entry}`;
				const fileInfo = await getInfoAsync(filePath);
				if (fileInfo.isDirectory) {
					await readDirectoryRecursively(filePath);
				}
				else {
					const hash = await getInfoAsync(filePath, { md5: true });
					if (hash.exists) {
						const assetName = filePath.split("/").slice(documentDirectory!.split("/").length).join("/");
						assetsWithHashes.push({file: assetName, hash: hash.md5!});
						console.log(`Asset: ${assetName}, Hash: ${hash.md5}`);
					}
				}
			}
		}

		await readDirectoryRecursively(`${documentDirectory!}assets`);

		return assetsWithHashes;
	}

	static async updateAssets(): Promise<void> {
		const remoteAssets = await RestApi.getAssets();

		this.assets = documentDirectory
			? await this.updateCachedAssets(remoteAssets)
			: await this.downloadAssets(remoteAssets);

		await reloadI18n(AssetsManager.getAssets((asset) => asset.startsWith("Lang/")));
		AppIcons.reloadAppIcons(AssetsManager.getAssets((asset) => asset === "icons.json"));
	}

	/**
	 * Fallback for platforms without a document directory, such as a browser opened for development.
	 * Nothing is cached between runs, so every asset is fetched again.
	 * @param remoteAssets Assets the server offers
	 */
	private static async downloadAssets(remoteAssets: { file: string, hash: string }[]): Promise<Map<string, string>> {
		const assets = new Map<string, string>();
		for (const asset of remoteAssets) {
			assets.set(asset.file, await RestApi.downloadAsset(asset.file));
		}
		return assets;
	}

	private static async updateCachedAssets(remoteAssets: { file: string, hash: string }[]): Promise<Map<string, string>> {
		const documentDirectoryInfo = await getInfoAsync(documentDirectory!);
		if (!documentDirectoryInfo.exists || !documentDirectoryInfo.isDirectory) {
			throw new Error("Document directory does not exist or is not a directory.");
		}

		const assetDirectory = `${documentDirectory!}assets`;
		const dirInfo = await getInfoAsync(assetDirectory);
		if (!dirInfo.exists) {
			await makeDirectoryAsync(assetDirectory, { intermediates: true });
			console.log("Created assets directory:", assetDirectory);
		}

		const localAssets = await this.readLocalAssets();

		const assetsToUpdate = remoteAssets.filter(remoteAsset => {
			const localAsset = localAssets.find(local => local.file === remoteAsset.file);
			return !localAsset || localAsset.hash !== remoteAsset.hash;
		});

		console.log("Assets to update:", assetsToUpdate);

		for (const assetToUpdate of assetsToUpdate) {
			const assetContent = await RestApi.downloadAsset(assetToUpdate.file);
			const assetPath = `${documentDirectory!}assets/${assetToUpdate.file}`;
			const directories = assetToUpdate.file.split("/");
			for (let i = 0; i < directories.length - 1; i++) {
				const dirPath = `${documentDirectory!}assets/${directories.slice(0, i + 1).join("/")}`;
				const dirInfo = await getInfoAsync(dirPath);
				if (!dirInfo.exists) {
					await makeDirectoryAsync(dirPath, { intermediates: true });
					console.log(`Created directory: ${dirPath}`);
				}
			}
			await writeAsStringAsync(assetPath, assetContent, {
				encoding: EncodingType.UTF8
			});
			const assetHash = await getInfoAsync(`${documentDirectory!}assets/${assetToUpdate.file}`, { md5: true });
			if (!assetHash.exists) {
				throw new Error(`Asset ${assetToUpdate.file} does not exist after download.`);
			}
			if (assetHash.md5 !== assetToUpdate.hash) {
				throw new Error(`Asset ${assetToUpdate.file} hash mismatch: expected ${assetToUpdate.hash}, got ${assetHash.md5}`);
			}
			console.log(`Updated asset: ${assetToUpdate.file}`);
		}

		const assets = new Map<string, string>();
		for (const asset of remoteAssets) {
			assets.set(asset.file, await readAsStringAsync(`${documentDirectory!}assets/${asset.file}`, {
				encoding: EncodingType.UTF8
			}));
		}
		return assets;
	}

	static getAssets(filter?: (file: string) => boolean): Map<string, string> {
		if (this.assets === null) {
			throw new Error("Assets have not been initialized. Call updateAssets() first.");
		}

		const filteredAssets = new Map<string, string>();
		for (const [file, content] of this.assets.entries()) {
			if (filter === undefined || filter(file)) {
				filteredAssets.set(file, content);
			}
		}
		return filteredAssets;
	}

	static areAssetsReady(): boolean {
		return this.assets !== null;
	}
}