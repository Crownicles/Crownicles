import {
	describe, expect, it
} from "vitest";
import {
	existsSync, readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { InteractOtherPlayerInteraction } from "../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";

type MapLocationData = {
	attribute: string;
};

type MapLinkData = {
	startMap: number;
	endMap: number;
};

type MonsterData = {
	attacks: { id: string }[];
	maps: number[];
};

type FrenchModels = {
	monsters: Record<string, { name?: string; description?: string } | undefined>;
	fight_actions: Record<string, { name_one?: string } | undefined>;
	pveMapsStory: Record<string, Record<string, string> | undefined>;
};

const resourcesPath = resolve(__dirname, "../../../resources");
const fightActionImplementationsPath = resolve(__dirname, "../../../src/core/fights/actions/interfaces");
const frenchModels = JSON.parse(readFileSync(resolve(__dirname, "../../../../Lang/fr/models.json"), "utf-8")) as FrenchModels;
const frenchSmallEvents = JSON.parse(readFileSync(resolve(__dirname, "../../../../Lang/fr/smallEvents.json"), "utf-8")) as {
	interactOtherPlayers: Record<string, unknown>;
};

function readResources<T>(directory: string): Map<string, T> {
	const directoryPath = resolve(resourcesPath, directory);
	return new Map(readdirSync(directoryPath)
		.filter(file => file.endsWith(".json"))
		.map(file => [file.replace(".json", ""), JSON.parse(readFileSync(resolve(directoryPath, file), "utf-8")) as T]));
}

const mapLocations = readResources<MapLocationData>("mapLocations");
const mapLinks = [...readResources<MapLinkData>("mapLinks").values()];
const monsters = readResources<MonsterData>("monsters");

function getLocationIdsWithAttribute(attribute: string): number[] {
	return [...mapLocations.entries()]
		.filter(([, location]) => location.attribute === attribute)
		.map(([id]) => Number(id));
}

const pveIslandLocationIds = getLocationIdsWithAttribute(MapConstants.MAP_ATTRIBUTES.PVE_ISLAND);
const pveExitLocationIds = new Set(getLocationIdsWithAttribute(MapConstants.MAP_ATTRIBUTES.PVE_EXIT));

function camelCaseToUpperSnakeCase(value: string): string {
	return value.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

describe("PvE island data integrity", () => {
	it("every PvE island fight location has at least one monster", () => {
		const monsterMapIds = new Set([...monsters.values()].flatMap(monster => monster.maps));

		expect(pveIslandLocationIds.filter(id => !monsterMapIds.has(id))).toEqual([]);
	});

	it("every monster only fights on PvE island locations", () => {
		const invalid = [...monsters.entries()]
			.flatMap(([monsterId, monster]) => monster.maps
				.filter(mapId => !pveIslandLocationIds.includes(mapId))
				.map(mapId => `${monsterId} on ${mapId}`));

		expect(invalid).toEqual([]);
	});

	it("every PvE island fight location leads back to the boat", () => {
		const withoutWayBack = pveIslandLocationIds
			.filter(id => !mapLinks.some(link => link.startMap === id && pveExitLocationIds.has(link.endMap)));

		expect(withoutWayBack).toEqual([]);
	});

	it("every monster has a French name, a description, an icon and an encounter story on each of its locations", () => {
		const incomplete = [...monsters.entries()].flatMap(([monsterId, monster]) => [
			...!frenchModels.monsters[monsterId]?.name || !frenchModels.monsters[monsterId]?.description ? [`${monsterId}: name or description`] : [],
			...!CrowniclesIcons.monsters[monsterId] ? [`${monsterId}: icon`] : [],
			...monster.maps
				.filter(mapId => !frenchModels.pveMapsStory[mapId]?.[monsterId])
				.map(mapId => `${monsterId}: story on ${mapId}`)
		]);

		expect(incomplete).toEqual([]);
	});

	it("every monster attack has a definition, an implementation, an icon and a French name", () => {
		const attackIds = new Set([...monsters.values()].flatMap(monster => monster.attacks.map(attack => attack.id)));
		const fightActionIds = new Set(readResources<unknown>("fightActions").keys());

		const incomplete = [...attackIds].flatMap(attackId => [
			...!fightActionIds.has(attackId) ? [`${attackId}: definition`] : [],
			...!existsSync(resolve(fightActionImplementationsPath, "monsters", `${attackId}.ts`))
			&& !existsSync(resolve(fightActionImplementationsPath, "players", `${attackId}.ts`))
				? [`${attackId}: implementation`]
				: [],
			...!CrowniclesIcons.fightActions[attackId] ? [`${attackId}: icon`] : [],
			...!frenchModels.fight_actions[attackId]?.name_one ? [`${attackId}: French name`] : []
		]);

		expect(incomplete).toEqual([]);
	});

	it("every final boss has a beaten interaction with its French texts", () => {
		const incomplete = Object.values(FightConstants.FINAL_BOSS_MONSTER_IDS)
			.map(bossId => `BEATEN_${camelCaseToUpperSnakeCase(bossId)}`)
			.filter(interaction => !(interaction in InteractOtherPlayerInteraction)
				|| !Array.isArray(frenchSmallEvents.interactOtherPlayers[interaction.toLowerCase()]));

		expect(incomplete).toEqual([]);
	});
});
