import { FastifyInstance } from "fastify";
import { gzipSync } from "node:zlib";
import {
	Language, LANGUAGE
} from "../../../../Lib/src/Language";
import { AssetsBundle } from "../../../../WsPackets/src/objects/AssetsBundle";
import {
	readdir, readFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { getRequestLoggerMetadata } from "../RestApi";

const assets: Map<string, string> = new Map();
const assetsHashes: Map<string, string> = new Map();
const languageBundles: Map<Language, {
	json: string;
	gzip: Buffer;
	etag: string;
}> = new Map();

/**
 * Computes the SHA-256 hash of the given file content.
 * @param fileContent
 */
function computeFileHash(fileContent: string): string {
	const hash = createHash("md5");
	hash.update(fileContent);
	return hash.digest("hex");
}

/**
 * Computes the assets for the languages and stores them in the `assets` and `assetsHashes` maps.
 */
async function computeLanguagesAssets(debugMode: boolean): Promise<void> {
	const languagesRoot = debugMode ? "../Lang" : "dist/Lang";
	const languages = (await readdir(languagesRoot, {
		withFileTypes: true
	}))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
		.filter(name => LANGUAGE.LANGUAGES.includes(name as Language));

	for (const language of languages) {
		const dirRoot = `${languagesRoot}/${language}`;
		const files = await readdir(dirRoot, {
			withFileTypes: true
		});
		for (const file of files) {
			if (file.isFile() && file.name.endsWith(".json")) {
				const filePath = `${dirRoot}/${file.name}`;
				const fileContent = await readFile(filePath, "utf8");
				const hash = computeFileHash(fileContent);
				assets.set(`Lang/${language}/${file.name}`, fileContent);
				assetsHashes.set(`Lang/${language}/${file.name}`, hash);
			}
		}
	}
}

/**
 * Computes the assets for the icons and stores them in the `assets` and `assetsHashes` maps.
 */
function computeIconsAssets(): void {
	const icons = JSON.stringify(CrowniclesIcons);
	assets.set("icons.json", icons);
	assetsHashes.set("icons.json", computeFileHash(icons));
}

/**
 * Computes the assets with their hashes and stores them in the `assets` and `assetsHashes` maps.
 */
async function computeAssets(debugMode: boolean): Promise<void> {
	assets.clear();
	assetsHashes.clear();
	languageBundles.clear();
	await computeLanguagesAssets(debugMode);
	computeIconsAssets();
	for (const language of LANGUAGE.LANGUAGES) {
		const namespaces: Record<string, object> = {};
		for (const [file, content] of assets.entries()) {
			const prefix = `Lang/${language}/`;
			if (file.startsWith(prefix)) {
				namespaces[file.slice(prefix.length, -5)] = JSON.parse(content) as object;
			}
		}
		const bundle: AssetsBundle = {
			language,
			namespaces,
			icons: JSON.parse(assets.get("icons.json")!) as Record<string, unknown>
		};
		const json = JSON.stringify(bundle);
		languageBundles.set(language, {
			json,
			gzip: gzipSync(json),
			etag: `"${computeFileHash(json)}"`
		});
	}
}

/**
 * Sets up the assets routes for the Fastify server.
 * @param server
 * @param debugMode - If true, assets will be recomputed on each request to ensure they are up-to-date.
 */
export async function setupAssetsRoutes(server: FastifyInstance, debugMode: boolean): Promise<void> {
	await computeAssets(debugMode);

	CrowniclesLogger.info("Assets and their hashes computed successfully", {
		assetsCount: assets.size,
		hashesCount: assetsHashes.size
	});

	server.get("/assets/hashes", async (request, reply) => {
		if (debugMode) {
			// In debug mode, we recompute the assets to ensure they are up-to-date without restarting the server.
			await computeAssets(debugMode);
		}
		CrowniclesLogger.info("Assets hashes requested", {
			...getRequestLoggerMetadata(request)
		});

		reply.type("application/json")
			.status(200)
			.send(JSON.stringify(Object.fromEntries(assetsHashes)));
	});

	server.get("/assets/bundle", async (request, reply) => {
		if (debugMode) {
			await computeAssets(debugMode);
		}

		const requestedLanguage = (request.query as { lang?: string }).lang;
		if (!requestedLanguage || !LANGUAGE.LANGUAGES.includes(requestedLanguage as Language)) {
			CrowniclesLogger.warn("Assets bundle requested with invalid language", {
				language: requestedLanguage,
				...getRequestLoggerMetadata(request)
			});
			reply.status(400).send({ error: "Invalid language" });
			return;
		}

		const language = requestedLanguage as Language;
		const bundle = languageBundles.get(language);
		if (!bundle) {
			reply.status(404).send({ error: "Asset bundle not found" });
			return;
		}

		reply.header("ETag", bundle.etag)
			.header("Cache-Control", "no-cache")
			.header("Vary", "Accept-Encoding");
		const ifNoneMatch = request.headers["if-none-match"];
		if (ifNoneMatch?.split(",").some(value => value.trim() === bundle.etag)) {
			reply.status(304).send();
			return;
		}

		const acceptsGzip = request.headers["accept-encoding"]?.split(",").some(value => {
			const [encoding, ...parameters] = value.trim().split(";");
			const qualityParameter = parameters.find(parameter => parameter.trim().startsWith("q="));
			const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
			return encoding.toLowerCase() === "gzip" && quality > 0 && quality <= 1;
		});
		if (acceptsGzip) {
			reply.header("Content-Encoding", "gzip")
				.type("application/json")
				.send(bundle.gzip);
			return;
		}
		reply.type("application/json").send(bundle.json);
	});

	server.get("/assets/download", (request, reply) => {
		const file = (request.query as { file?: string }).file as string;
		if (!file) {
			CrowniclesLogger.warn("Download asset request without file parameter", {
				...getRequestLoggerMetadata(request)
			});
			reply.status(400).send({ error: "File parameter is required" });
			return;
		}
		if (!assets.has(file)) {
			CrowniclesLogger.warn("Download asset request for non-existing file", {
				file,
				...getRequestLoggerMetadata(request)
			});
			reply.status(404).send({ error: "Asset not found" });
			return;
		}

		CrowniclesLogger.info("Download asset request", {
			file,
			...getRequestLoggerMetadata(request)
		});

		const assetContent = assets.get(file)!;
		reply.type("application/text")
			.status(200)
			.send(assetContent);
	});
}
