import { readdir } from "fs/promises";
import { resolve } from "path";
import { pathToFileURL } from "url";

const COMPILED_SOURCES_PATH = "dist/Core/src";

const COMPILED_MODULE_EXTENSION = ".js";

/**
 * `import()` exposes the `module.exports` of a CommonJS module, which the Core is compiled to, as its default export
 */
type CompiledModuleNamespace<M> = {
	default: M;
};

/**
 * Import the compiled modules of a folder of the Core sources and keep, keyed by their file name without extension, the
 * export read by the feature discovered from these files (small events, fight actions, mission interfaces...). The files
 * without this export are helpers of the folder
 * @param folder - Folder of the modules, relative to the Core sources
 * @param getExport - Reads the export from the exports of a module, whose type the caller declares since the module is only known at runtime
 */
export async function importCompiledFolderExports<M, T>(folder: string, getExport: (moduleExports: M) => T | undefined): Promise<Map<string, T>> {
	const folderPath = resolve(COMPILED_SOURCES_PATH, folder);
	const folderExports = new Map<string, T>();
	for (const file of await readdir(folderPath)) {
		if (!file.endsWith(COMPILED_MODULE_EXTENSION)) {
			continue;
		}
		const compiledModule: CompiledModuleNamespace<M> = await import(pathToFileURL(resolve(folderPath, file)).href);
		const moduleExport = getExport(compiledModule.default);
		if (moduleExport !== undefined) {
			folderExports.set(file.slice(0, -COMPILED_MODULE_EXTENSION.length), moduleExport);
		}
	}
	return folderExports;
}
