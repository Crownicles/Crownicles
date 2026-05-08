import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";

interface RecipeData {
	id: string;
	level: number;
	discoveredByDefault: boolean;
	discoverySource?: string;
}

interface MapLocationData {
	type: string;
	attribute: string;
}

interface MapLinkData {
	startMap: number;
	endMap: number;
}

interface MonsterData {
	maps: number[];
}

describe("Cooking Recipe Data Validation", () => {
	const recipesDir = resolve(__dirname, "../../../resources/cooking/recipes");
	const recipes: RecipeData[] = readdirSync(recipesDir)
		.filter(f => f.endsWith(".json"))
		.map(f => {
			const data = JSON.parse(readFileSync(resolve(recipesDir, f), "utf-8")) as Omit<RecipeData, "id">;
			return {
				...data,
				id: f.replace(".json", "")
			} as RecipeData;
		});

	it("should have the same number of ISLAND_BOSS recipes as final boss locations", () => {
		const islandBossRecipes = recipes.filter(r => r.discoverySource === "ISLAND_BOSS");
		const finalBossCount = Object.keys(FightConstants.FINAL_BOSS_MONSTER_IDS).length;

		// When the oceanic island is merged, add 2 more ISLAND_BOSS recipes:
		// potion_health_8 and potion_time_speedup_8 (currently set as DEFAULT in recipes.json)
		expect(islandBossRecipes.length).toBe(finalBossCount);
	});

	it("should have every final boss location covered by a monster in FINAL_BOSS_MONSTER_IDS", () => {
		const resourcesPath = resolve(__dirname, "../../../resources");

		// Load map locations
		const locationsDir = resolve(resourcesPath, "mapLocations");
		const locations: Record<number, MapLocationData> = {};
		for (const file of readdirSync(locationsDir).filter(f => f.endsWith(".json"))) {
			const id = parseInt(file.replace(".json", ""));
			locations[id] = JSON.parse(readFileSync(resolve(locationsDir, file), "utf-8"));
		}

		// Load map links
		const linksDir = resolve(resourcesPath, "mapLinks");
		const links: MapLinkData[] = [];
		for (const file of readdirSync(linksDir).filter(f => f.endsWith(".json"))) {
			links.push(JSON.parse(readFileSync(resolve(linksDir, file), "utf-8")));
		}

		// Compute final boss map IDs: pve_island locations where all outgoing links go to pve_exit
		const pveIslandIds = Object.entries(locations)
			.filter(([, loc]) => loc.attribute === "pve_island")
			.map(([id]) => parseInt(id));

		const finalBossMapIds = pveIslandIds.filter(id => {
			const outgoing = links.filter(l => l.startMap === id);
			return outgoing.length > 0 && outgoing.every(l => locations[l.endMap]?.attribute === "pve_exit");
		});

		// Load monster data for each final boss and collect covered map IDs
		const bossMonsterIds = Object.values(FightConstants.FINAL_BOSS_MONSTER_IDS);
		const monstersDir = resolve(resourcesPath, "monsters");
		const coveredMapIds = new Set<number>();
		for (const monsterId of bossMonsterIds) {
			const monsterData: MonsterData = JSON.parse(
				readFileSync(resolve(monstersDir, `${monsterId}.json`), "utf-8")
			);
			for (const mapId of monsterData.maps) {
				coveredMapIds.add(mapId);
			}
		}

		// Every final boss location must be covered by a boss monster
		const uncoveredLocations = finalBossMapIds.filter(id => !coveredMapIds.has(id));
		expect(
			uncoveredLocations,
			`Final boss locations ${uncoveredLocations.join(", ")} have no monster from FINAL_BOSS_MONSTER_IDS assigned to them`
		).toHaveLength(0);
	});

	it("should have unique ids for all recipes", () => {
		const ids = recipes.map(r => r.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("should have a valid discoverySource or be discoveredByDefault", () => {
		const validSources = [
			"ISLAND_BOSS", "CAMPAIGN_MILESTONE", "PLAYER_LEVEL_MILESTONE",
			"GASPARD_JO", "FARMER", "COOKING_LEVEL", "WITCH"
		];

		for (const recipe of recipes) {
			if (!recipe.discoveredByDefault) {
				expect(
					validSources.includes(recipe.discoverySource!),
					`Recipe ${recipe.id} is not discoveredByDefault but has invalid discoverySource: ${recipe.discoverySource}`
				).toBe(true);
			}
		}
	});
});
