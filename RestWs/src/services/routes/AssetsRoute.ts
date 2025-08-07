import { FastifyInstance } from "fastify";
import {
	Language, LANGUAGE
} from "../../../../Lib/src/Language";
import {
	readdir, readFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { getRequestLoggerMetadata } from "../RestApi";

const assets: Map<string, string> = new Map();
const assetsHashes: Map<string, string> = new Map();

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
async function computeLanguagesAssets(): Promise<void> {
	const languages = (await readdir(`dist/Lang`, {
		withFileTypes: true
	}))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
		.filter(name => LANGUAGE.LANGUAGES.includes(name as Language));

	for (const language of languages) {
		const files = await readdir(`dist/Lang/${language}`, {
			withFileTypes: true
		});
		for (const file of files) {
			if (file.isFile() && file.name.endsWith(".json")) {
				const filePath = `dist/Lang/${language}/${file.name}`;
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
async function computeAssets(): Promise<void> {
	await computeLanguagesAssets();
	computeIconsAssets();
}

/**
 * Sets up the assets routes for the Fastify server.
 * @param server
 * @param debugMode - If true, assets will be recomputed on each request to ensure they are up-to-date.
 */
export async function setupAssetsRoutes(server: FastifyInstance, debugMode: boolean): Promise<void> {
	await computeAssets();

	CrowniclesLogger.info("Assets and their hashes computed successfully", {
		assetsCount: assets.size,
		hashesCount: assetsHashes.size
	});

	server.get("/assets/hashes", async (request, reply) => {
		if (debugMode) {
			// In debug mode, we recompute the assets to ensure they are up-to-date without restarting the server.
			await computeAssets();
		}
		CrowniclesLogger.info("Assets hashes requested", {
			...getRequestLoggerMetadata(request)
		});

		reply.type("application/json")
			.status(200)
			.send(JSON.stringify(Object.fromEntries(assetsHashes)));
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
