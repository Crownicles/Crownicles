import {
	EncodingType,
	documentDirectory,
	deleteAsync,
	getInfoAsync,
	makeDirectoryAsync,
	moveAsync,
	readAsStringAsync,
	writeAsStringAsync
} from "expo-file-system/legacy";
import {RestApi} from "@/src/networking/RestApi";
import {hasEveryGameRule} from "@/src/rules/GameRules";
import type {AssetsBundle, AssetsBundleLanguage} from "../../../WsPackets/src/objects/AssetsBundle";

export interface CachedBundle {
	etag: string;
	bundle: AssetsBundle;
}

const MAX_SYNC_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 3_000] as const;
const webCache = new Map<AssetsBundleLanguage, CachedBundle>();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAssetsBundle(value: unknown, language: AssetsBundleLanguage): value is AssetsBundle {
	return isRecord(value)
		&& value.language === language
		&& isRecord(value.namespaces)
		&& isRecord(value.icons)
		&& isRecord(value.rules)
		&& hasEveryGameRule(value.rules);
}

export class AssetsManager {
	private static legacyCacheRemoved = false;
	private static readonly activeSyncs = new Map<AssetsBundleLanguage, Promise<CachedBundle>>();

	static async loadCachedBundle(language: AssetsBundleLanguage): Promise<CachedBundle | null> {
		if (!documentDirectory) {
			return webCache.get(language) ?? null;
		}

		if (!this.legacyCacheRemoved) {
			this.legacyCacheRemoved = true;
			await deleteAsync(`${documentDirectory}assets`, {idempotent: true}).catch(error => {
				console.warn("Failed to remove legacy assets cache:", error);
			});
		}

		const cacheFile = `${documentDirectory}i18n/bundle-${language}.json`;
		try {
			const fileInfo = await getInfoAsync(cacheFile);
			if (!fileInfo.exists) {
				return null;
			}
			const parsed: unknown = JSON.parse(await readAsStringAsync(cacheFile));
			if (isRecord(parsed) && typeof parsed.etag === "string" && isAssetsBundle(parsed.bundle, language)) {
				return {etag: parsed.etag, bundle: parsed.bundle};
			}
		}
		catch (error) {
			console.warn("Ignoring invalid cached translation bundle:", error);
		}

		await deleteAsync(cacheFile, {idempotent: true}).catch(() => undefined);
		return null;
	}

	static async syncBundle(language: AssetsBundleLanguage, cached: CachedBundle | null): Promise<CachedBundle> {
		const activeSync = this.activeSyncs.get(language);
		if (activeSync) {
			return activeSync;
		}

		const sync = this.fetchBundleWithRetries(language, cached);
		this.activeSyncs.set(language, sync);
		try {
			return await sync;
		}
		finally {
			if (this.activeSyncs.get(language) === sync) {
				this.activeSyncs.delete(language);
			}
		}
	}

	private static async fetchBundleWithRetries(language: AssetsBundleLanguage, cached: CachedBundle | null): Promise<CachedBundle> {
		for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt++) {
			try {
				const response = await RestApi.getAssetsBundle(language, cached?.etag);
				if (response.status === "notModified") {
					if (!cached) {
						throw new Error("Server returned 304 without a cached translation bundle.");
					}
					return cached;
				}

				if (!isAssetsBundle(response.bundle, language)) {
					throw new Error("Server returned an invalid translation bundle.");
				}
				const nextBundle = {bundle: response.bundle, etag: response.etag};
				webCache.set(language, nextBundle);
				await this.writeCachedBundle(nextBundle, language).catch(error => {
					console.warn("Failed to persist translation bundle cache:", error);
				});
				return nextBundle;
			}
			catch (error) {
				if (attempt === MAX_SYNC_ATTEMPTS - 1) {
					throw error;
				}
				await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
			}
		}
		throw new Error("Translation bundle synchronization exhausted its attempts.");
	}

	private static async writeCachedBundle(cached: CachedBundle, language: AssetsBundleLanguage): Promise<void> {
		if (!documentDirectory) {
			return;
		}
		const cacheDirectory = `${documentDirectory}i18n`;
		const finalPath = `${cacheDirectory}/bundle-${language}.json`;
		const temporaryPath = `${finalPath}.tmp`;
		await makeDirectoryAsync(cacheDirectory, {intermediates: true});
		try {
			await writeAsStringAsync(temporaryPath, JSON.stringify(cached), {encoding: EncodingType.UTF8});
			await moveAsync({from: temporaryPath, to: finalPath});
		}
		catch (error) {
			await deleteAsync(temporaryPath, {idempotent: true}).catch(() => undefined);
			throw error;
		}
	}
}