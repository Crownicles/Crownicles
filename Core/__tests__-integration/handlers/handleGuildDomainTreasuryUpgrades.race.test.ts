/**
 * Race integration test for the guild-domain treasury-spending
 * critical sections fixed by PR-E1.
 *
 * Both `handleGuildDomainNotaryReaction` (domain purchase / relocation)
 * and `handleGuildDomainUpgrade` (building upgrade) read
 * `guild.treasury` outside any lock, then decrement it and save. With
 * two concurrent calls on the same guild, both readers see the same
 * stale `treasury` value, both decide they can afford the cost, and
 * both write the post-decrement value — losing one of the two
 * deductions and leaving the building / domain field in an
 * inconsistent state.
 *
 * PR-E1 wraps the read-validate-mutate-save sequence in
 * `Guild.withLocked(...)` so concurrent callers serialise on the row
 * lock and the second one observes the freshly-decremented treasury.
 *
 * Why ad-hoc Sequelize models — see the rationale in
 * `handleFoodShopBuy.race.test.ts`.
 */
import {
	beforeAll, afterAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";

class GuildRow extends Model {
	declare id: number;

	declare treasury: number;

	declare shopLevel: number;

	declare domainCityId: number | null;
}

let env: IntegrationTestEnvironment;
let GuildModel: ModelStatic<GuildRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("guild_treasury_upgrade_race");
	GuildModel = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			treasury: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			shopLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			domainCityId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
		},
		{ sequelize: env.sequelize, tableName: "guild_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await GuildModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy upgrade: read `treasury`, validate against `cost`, decrement,
 * bump `shopLevel`. Mirrors the pre-PR-E1 production code path.
 */
async function upgradeShopUnsafe(
	guildId: number, cost: number
): Promise<boolean> {
	const guild = await GuildModel.findByPk(guildId);
	if (!guild || guild.treasury < cost) {
		return false;
	}
	// Yield once so two concurrent unsafe upgraders interleave their
	// read-validate phase and both pass the affordability check on the
	// same stale snapshot.
	await new Promise(resolve => setImmediate(resolve));
	guild.treasury -= cost;
	guild.shopLevel += 1;
	await guild.save();
	return true;
}

/**
 * Fixed upgrade: lock the guild row with `SELECT … FOR UPDATE`,
 * re-validate `treasury` inside the critical section, mutate, save.
 * Mirrors the post-PR-E1 production code path.
 */
async function upgradeShopLocked(
	guildId: number, cost: number
): Promise<boolean> {
	return await withLockedEntities(
		[{ model: GuildModel, id: guildId } as LockKey<GuildRow>],
		async ([guild]) => {
			if (guild.treasury < cost) {
				return false;
			}
			guild.treasury -= cost;
			guild.shopLevel += 1;
			await guild.save();
			return true;
		}
	);
}

/**
 * Buggy notary purchase: read `treasury`, validate, decrement, set
 * `domainCityId`. Mirrors the pre-PR-E1 production code path.
 */
async function notaryPurchaseUnsafe(
	guildId: number, cost: number, cityId: number
): Promise<boolean> {
	const guild = await GuildModel.findByPk(guildId);
	if (!guild || guild.treasury < cost) {
		return false;
	}
	await new Promise(resolve => setImmediate(resolve));
	guild.treasury -= cost;
	guild.domainCityId = cityId;
	await guild.save();
	return true;
}

async function notaryPurchaseLocked(
	guildId: number, cost: number, cityId: number
): Promise<boolean> {
	return await withLockedEntities(
		[{ model: GuildModel, id: guildId } as LockKey<GuildRow>],
		async ([guild]) => {
			if (guild.treasury < cost) {
				return false;
			}
			guild.treasury -= cost;
			guild.domainCityId = cityId;
			await guild.save();
			return true;
		}
	);
}

describe("guild-domain treasury upgrades race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe shop upgrades both succeed but treasury only debited once",
		async () => {
			// Treasury covers EXACTLY ONE upgrade. Two concurrent calls
			// both pass the affordability check on the stale snapshot…
			await GuildModel.create({
				id: 1, treasury: 100, shopLevel: 0, domainCityId: 1
			});

			const results = await Promise.all([
				upgradeShopUnsafe(1, 100),
				upgradeShopUnsafe(1, 100)
			]);

			const guild = await GuildModel.findByPk(1);
			// …both reported success…
			expect(results).toEqual([true, true]);
			// …but treasury was only debited ONCE (lost update). The
			// shop level field is also lost-updated to 1, when two
			// successful upgrades should have produced level 2.
			expect(guild?.treasury).toBe(0);
			expect(guild?.shopLevel).toBe(1);
		}
	);

	it("FIXES the bug: locked shop upgrades serialise affordability check", async () => {
		await GuildModel.create({
			id: 2, treasury: 100, shopLevel: 0, domainCityId: 1
		});

		const results = await Promise.all([
			upgradeShopLocked(2, 100),
			upgradeShopLocked(2, 100)
		]);

		// Exactly one upgrade succeeded; the other re-read the locked
		// row, found `treasury < cost`, and bailed out.
		const successCount = results.filter(success => success).length;
		expect(successCount).toBe(1);

		const guild = await GuildModel.findByPk(2);
		expect(guild?.treasury).toBe(0);
		expect(guild?.shopLevel).toBe(1);
	});

	it(
		"DEMONSTRATES the bug: two unsafe notary purchases both pass but only one debit lands",
		async () => {
			await GuildModel.create({
				id: 3, treasury: 5000, shopLevel: 0, domainCityId: null
			});

			const results = await Promise.all([
				notaryPurchaseUnsafe(3, 5000, 7),
				notaryPurchaseUnsafe(3, 5000, 7)
			]);

			const guild = await GuildModel.findByPk(3);
			expect(results).toEqual([true, true]);
			// Only one 5000-debit landed — guild has the domain but
			// the chief was charged 5000 instead of 10000 (or vice
			// versa, depending on which path is "second").
			expect(guild?.treasury).toBe(0);
			expect(guild?.domainCityId).toBe(7);
		}
	);

	it("FIXES the bug: locked notary purchases reject the second contender", async () => {
		await GuildModel.create({
			id: 4, treasury: 5000, shopLevel: 0, domainCityId: null
		});

		const results = await Promise.all([
			notaryPurchaseLocked(4, 5000, 7),
			notaryPurchaseLocked(4, 5000, 8)
		]);

		const successCount = results.filter(success => success).length;
		expect(successCount).toBe(1);

		const guild = await GuildModel.findByPk(4);
		expect(guild?.treasury).toBe(0);
		expect([7, 8]).toContain(guild?.domainCityId ?? -1);
	});
});
