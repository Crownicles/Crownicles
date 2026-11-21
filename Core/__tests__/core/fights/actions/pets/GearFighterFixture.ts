import { vi } from "vitest";
import { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import Player from "../../../../../src/core/database/game/models/Player";
import { InventorySlots } from "../../../../../src/core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../../../../src/core/database/game/models/PlayerActiveObjects";
import { ObjectItem } from "../../../../../src/data/ObjectItem";
import { Class } from "../../../../../src/data/Class";
import { ItemNature } from "../../../../../../Lib/src/constants/ItemConstants";
import {
	StatValues, ZERO_STATS
} from "../../../../../../Lib/src/types/StatValues";

/**
 * Equipment of a fighter loaded through the real stat formula: the test file must mock `InventorySlots`
 * (`getPlayerActiveObjects` and `countObjectsOfPlayer`)
 */
export type GearFighterSetup = {
	classStats: StatValues;
	weapon?: StatValues;
	armor?: StatValues;
	armorEnchantmentId?: string | null;
	potion?: StatValues;

	// A fight without consequences leaves the potion out of the stats
	withoutConsequences?: boolean;
};

const PLAYER_CLASS = { fightActionsIds: [] } as unknown as Class;

function buildItem(stats: StatValues): never {
	return {
		getAttack: (): number => stats.attack,
		getDefense: (): number => stats.defense,
		getSpeed: (): number => stats.speed
	} as never;
}

function buildActiveObjects(setup: GearFighterSetup): PlayerActiveObjects {
	return {
		weapon: {
			item: buildItem(setup.weapon ?? ZERO_STATS), itemLevel: 0, itemEnchantmentId: null
		},
		armor: {
			item: buildItem(setup.armor ?? ZERO_STATS), itemLevel: 0, itemEnchantmentId: setup.armorEnchantmentId ?? null
		},
		potion: { item: buildItem(setup.potion ?? ZERO_STATS) },
		object: {
			item: Object.assign(new ObjectItem(), {
				nature: ItemNature.NONE, power: 0
			})
		}
	};
}

/**
 * Build a player fighter whose stats are loaded by the real fight flow, the class stats being fixed by the setup
 * @param setup
 */
export async function buildLoadedGearFighter(setup: GearFighterSetup): Promise<PlayerFighter> {
	const player = Object.assign(Object.create(Player.prototype) as Player, {
		id: 1, level: 50, class: 0, petId: null, fightPointsLost: 0
	});
	player.getMaxStatsValue = (): StatValues => setup.classStats;
	vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(buildActiveObjects(setup));
	const fighter = new PlayerFighter(player, PLAYER_CLASS, { withoutConsequences: setup.withoutConsequences ?? false });
	await fighter.loadStats();
	return fighter;
}

export function getFightStats(fighter: PlayerFighter): StatValues {
	return {
		attack: fighter.getAttack(),
		defense: fighter.getDefense(),
		speed: fighter.getSpeed()
	};
}
