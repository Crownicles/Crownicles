import * as fs from "fs";
import * as path from "path";

export type FrenchModels = {
	classes: Record<string, string>;
	pets: Record<string, string>;
};

let cachedModels: FrenchModels | null = null;

function resolveModelsPath(): string {
	const candidates = [
		path.join(__dirname, "../../../../../../Lang/fr/models.json"),
		path.join(__dirname, "../../../../../../../Lang/fr/models.json"),
		path.resolve(process.cwd(), "Lang/fr/models.json"),
		path.resolve(process.cwd(), "../Lang/fr/models.json")
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error(`Impossible de trouver le fichier des modèles FR. Chemins testés: ${candidates.join(", ")}`);
}

export function loadFrenchModels(): FrenchModels {
	if (!cachedModels) {
		const filePath = resolveModelsPath();
		cachedModels = JSON.parse(fs.readFileSync(filePath, "utf-8")) as FrenchModels;
	}

	return cachedModels;
}
