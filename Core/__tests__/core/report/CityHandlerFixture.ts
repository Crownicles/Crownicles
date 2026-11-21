import { vi } from "vitest";
import type { LockKey } from "../../../../Lib/src/locks/withLockedEntities";
import type { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ZERO_STATS } from "../../../../Lib/src/types/StatValues";
import type { Player } from "../../../src/core/database/game/models/Player";
import { Guild } from "../../../src/core/database/game/models/Guild";
import { asPlayer } from "../ModelStubs";

/**
 * Player of a city handler: money moves as the real `spendMoney` / `addMoney` would move it, without missions nor logs
 */
export type CityHandlerPlayer = {
	id: number;
	keycloakId: string;
	money: number;
	level: number;
	class: number;
	health: number;
	maxHealth: number;
	lastBedUsedAt: Date | null;
	spendMoney: ReturnType<typeof vi.fn>;
	addMoney: ReturnType<typeof vi.fn>;
	addHealth: ReturnType<typeof vi.fn>;
	getHealth: () => number;
	getMaxHealth: () => number;
	getMaxStatsValue: () => typeof ZERO_STATS;
	getCurrentCityId: ReturnType<typeof vi.fn>;
	reload: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
};

export function makeHandlerPlayer(money: number, level = 1): CityHandlerPlayer {
	const player: CityHandlerPlayer = {
		id: 1,
		keycloakId: "city-handler-player",
		money,
		level,
		class: 0,
		health: 10,
		maxHealth: 100,
		lastBedUsedAt: null,
		spendMoney: vi.fn(({ amount }: { amount: number }) => {
			player.money -= amount;
			return Promise.resolve();
		}),
		addMoney: vi.fn(({ amount }: { amount: number }) => {
			player.money += amount;
			return Promise.resolve();
		}),
		addHealth: vi.fn(({ amount }: { amount: number }) => {
			player.health = Math.min(player.maxHealth, player.health + amount);
			return Promise.resolve();
		}),
		getHealth: () => player.health,
		getMaxHealth: () => player.maxHealth,
		getMaxStatsValue: () => ZERO_STATS,
		getCurrentCityId: vi.fn().mockReturnValue("boug_coton"),
		reload: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	};
	return player;
}

export { asPlayer };

/**
 * Entities handed to the critical sections, looked up by the model and id of each lock key
 */
export function lockedEntitiesOf(entities: [LockKey["model"], number, unknown][]): (keys: readonly LockKey[]) => unknown[] {
	return keys => keys.map(key => {
		const found = entities.find(([model, id]) => model === key.model && id === key.id);
		if (!found) {
			throw new Error(`Unexpected lock on ${key.model.name} ${key.id}`);
		}
		return found[2];
	});
}

/**
 * Class name and content of each packet pushed in the response
 */
export function describePackets(response: CrowniclesPacket[]): [string, Record<string, unknown>][] {
	return response.map(packet => [packet.constructor.name, { ...packet }]);
}

/**
 * Guild row as locked by a city handler: building levels and food stocks are read and written through
 * `getDataValue` / `setDataValue` (backed by a plain record here), the other columns are plain fields
 */
export function makeHandlerGuild(fields: Partial<{
	id: number;
	chiefId: number;
	level: number;
	treasury: number;
	domainCityId: string | null;
	pantryLevel: number;
}>, dataValues: Record<string, number> = {}): Guild & {
	save: ReturnType<typeof vi.fn>;
	addExperience: ReturnType<typeof vi.fn>;
} {
	const values: Record<string, unknown> = {
		shopLevel: 0,
		shelterLevel: 0,
		pantryLevel: fields.pantryLevel ?? 0,
		trainingGroundLevel: 0,
		commonFood: 0,
		herbivorousFood: 0,
		carnivorousFood: 0,
		ultimateFood: 0,
		...dataValues
	};
	return Object.assign(Object.create(Guild.prototype) as Guild, {
		id: 7,
		chiefId: 1,
		level: 1,
		treasury: 0,
		domainCityId: null,
		pantryLevel: 0,
		...fields,
		getDataValue: (key: string): unknown => values[key],
		setDataValue: (key: string, value: unknown): void => {
			values[key] = value;
		},
		save: vi.fn().mockResolvedValue(undefined),
		addExperience: vi.fn().mockResolvedValue(undefined)
	});
}
