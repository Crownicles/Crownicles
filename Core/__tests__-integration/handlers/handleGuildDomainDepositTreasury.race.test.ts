/**
 * Race integration test for the guild-domain treasury-deposit critical
 * section (the bug fixed by PR-D).
 *
 * The previous `handleGuildDomainDepositTreasury` validated
 * `player.money >= grossAmount` *outside* a transaction, then took an
 * in-process per-guild lock (`LockManager`) before mutating both the
 * guild treasury *and* the player's money. Two flaws:
 *
 *  1. The in-process lock is invisible to a second Core instance — the
 *     production target is multi-instance (see `docs/CONCURRENCY_PLAN.md`),
 *     so concurrent deposits across pods can both pass the money check.
 *  2. Even single-instance, the lock is keyed on `guildId`, so a
 *     parallel handler that mutates the same `Player.money` (e.g.
 *     concurrent shop purchase) can interleave with the read/write
 *     here.
 *
 * PR-D replaces the in-process lock with a real database row lock on
 * **both** the guild and the player rows
 * (`withLockedEntities([Guild.lockKey, Player.lockKey], ...)`), and
 * re-validates `player.money` *inside* the lock against the freshly-
 * fetched row.
 *
 * Why ad-hoc Sequelize models instead of the production singletons:
 * see the rationale at the top of
 * `handleFoodShopBuy.race.test.ts`. Same trade-off here.
 */
import {
	beforeAll, afterAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import { setupIntegrationDb, IntegrationTestEnvironment } from "../_setup";
import {
	withLockedEntities, LockKey
} from "../../../Lib/src/locks/withLockedEntities";

class GuildRow extends Model {
	declare id: number;

	declare treasury: number;
}

class PlayerRow extends Model {
	declare id: number;

	declare money: number;

	declare guildId: number;
}

let env: IntegrationTestEnvironment;
let GuildModel: ModelStatic<GuildRow>;
let PlayerModel: ModelStatic<PlayerRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("treasury_deposit_race");
	GuildModel = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			treasury: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "guild_row", timestamps: false }
	);
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			guildId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
	await GuildModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy version: locks only the guild, reads `player.money` from a
 * stale snapshot. Mirrors the pre-refactor production code where the
 * `LockManager` is keyed on `guildId` only.
 */
async function depositUnsafe(
	guildId: number, playerId: number, grossAmount: number
): Promise<{ deposited: number } | null> {
	const player = await PlayerModel.findByPk(playerId);
	const guild = await GuildModel.findByPk(guildId);
	if (!player || !guild) {
		return null;
	}
	if (player.money < grossAmount) {
		return null;
	}
	// Yield AFTER both reads so that two concurrent callers each capture
	// the same stale (player, guild) snapshot before any writes land.
	await new Promise(resolve => setImmediate(resolve));
	guild.treasury += grossAmount;
	player.money -= grossAmount;
	await guild.save();
	await player.save();
	return { deposited: grossAmount };
}

/**
 * Fixed version: locks BOTH `guild` and `player` with `SELECT … FOR
 * UPDATE`, re-validates `player.money` inside the critical section
 * against the freshly-locked row. Mirrors the post-refactor production
 * code path.
 */
async function depositLocked(
	guildId: number, playerId: number, grossAmount: number
): Promise<{ deposited: number } | null> {
	return await withLockedEntities(
		[
			{ model: GuildModel, id: guildId } as LockKey<GuildRow>,
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>
		],
		async ([guild, player]) => {
			if (player.money < grossAmount) {
				return null;
			}
			guild.treasury += grossAmount;
			player.money -= grossAmount;
			await guild.save();
			await player.save();
			return { deposited: grossAmount };
		}
	);
}

describe("handleGuildDomainDepositTreasury race (integration)", () => {
	it(
		"DEMONSTRATES the bug: unsafe deposits silently lose updates",
		async () => {
			// Player has 200 — enough for two 100-deposits in sequence.
			// Two concurrent callers BOTH report a successful 100-credit
			// to the player, but only one of those deposits actually
			// lands in the guild treasury (lost update on both rows).
			await GuildModel.create({ id: 1, treasury: 0 });
			await PlayerModel.create({ id: 1, money: 200, guildId: 1 });

			const responses = await Promise.all([
				depositUnsafe(1, 1, 100),
				depositUnsafe(1, 1, 100)
			]);

			const player = await PlayerModel.findByPk(1);
			const guild = await GuildModel.findByPk(1);

			// Both calls reported success…
			expect(responses.every(response => response?.deposited === 100)).toBe(true);
			// …but only ONE deposit actually persisted (treasury=100,
			// not 200), and symmetrically the player kept 100 they were
			// told they had spent. End-state inconsistent with the two
			// successful response packets.
			expect(guild?.treasury).toBe(100);
			expect(player?.money).toBe(100);
		}
	);

	it(
		"FIXES the bug: locked deposits respect the player's money",
		async () => {
			await GuildModel.create({ id: 2, treasury: 0 });
			await PlayerModel.create({ id: 2, money: 100, guildId: 2 });

			const results = await Promise.all([
				depositLocked(2, 2, 100),
				depositLocked(2, 2, 100)
			]);

			// Exactly one deposit succeeded; the other found
			// `player.money < 100` and bailed out.
			const succeeded = results.filter(result => result !== null);
			expect(succeeded).toHaveLength(1);
			expect(succeeded[0]?.deposited).toBe(100);

			const player = await PlayerModel.findByPk(2);
			const guild = await GuildModel.findByPk(2);
			expect(player?.money).toBe(0);
			expect(guild?.treasury).toBe(100);
		}
	);

	it(
		"FIXES the bug: distinct players on the same guild both succeed",
		async () => {
			// Two players, same guild — independent player rows, so the
			// composite lock should let both transactions through (each
			// after the other releases the guild row, but both succeed).
			await GuildModel.create({ id: 3, treasury: 0 });
			await PlayerModel.create({ id: 31, money: 100, guildId: 3 });
			await PlayerModel.create({ id: 32, money: 100, guildId: 3 });

			const results = await Promise.all([
				depositLocked(3, 31, 100),
				depositLocked(3, 32, 100)
			]);

			expect(results.every(result => result?.deposited === 100)).toBe(true);

			const guild = await GuildModel.findByPk(3);
			const [player31, player32] = await Promise.all([
				PlayerModel.findByPk(31),
				PlayerModel.findByPk(32)
			]);
			expect(guild?.treasury).toBe(200);
			expect(player31?.money).toBe(0);
			expect(player32?.money).toBe(0);
		}
	);

	it(
		"FIXES the bug: half-budget race never lets player.money go negative",
		async () => {
			// Player has 100, requests two parallel 100-deposits — only
			// one can succeed. After the dust settles, money must be
			// exactly 0, NEVER -100.
			await GuildModel.create({ id: 4, treasury: 0 });
			await PlayerModel.create({ id: 4, money: 100, guildId: 4 });

			await Promise.all([
				depositLocked(4, 4, 100),
				depositLocked(4, 4, 100)
			]);

			const player = await PlayerModel.findByPk(4);
			expect(player?.money).toBe(0);
			expect(player?.money).toBeGreaterThanOrEqual(0);
		}
	);
});
