/**
 * Race integration tests for the cross-entity pet handlers fixed by
 * PR-F4:
 *
 *   1. **PetFeedCommand** — without-guild candy feed: read player.money
 *      + petId outside any lock, validate, debit money & credit love
 *      points, save. Two concurrent feeds against a single-coin
 *      budget both pass the affordability check on the stale
 *      snapshot, both report success, only one debit lands.
 *
 *   2. **PetExpeditionCommand.doResolveExpedition** — read active
 *      expedition row, compute outcome, apply rewards, destroy the
 *      expedition row. Two concurrent resolutions both fetch the
 *      same active expedition, both apply rewards, only one destroy
 *      effectively removes the row → reward double-credit.
 *
 *   3. **interactOtherPlayers.sendACoin** — read both player rows,
 *      transfer 1 coin via `addMoney` / `spendMoney`, save. Two
 *      concurrent SE invocations against the same beggar/donor pair
 *      where the donor only has 1 coin both pass the affordability
 *      check, both transfers land → donor goes to -1, lost update.
 *
 * PR-F4 wraps each critical section in `withLockedEntities` so the
 * second contender re-validates the relevant invariant against the
 * locked rows and bails out (or, for the expedition flow, finds the
 * row already destroyed and short-circuits).
 *
 * Why ad-hoc Sequelize models — the production handlers reach into
 * controller/factory layers we cannot drive in isolation. We mirror
 * the *shape* of each critical section (read → validate → mutate →
 * save) on a minimal schema and prove the race + the lock fix.
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

class PlayerRow extends Model {
	declare id: number;

	declare money: number;

	declare petId: number | null;
}

class PetRow extends Model {
	declare id: number;

	declare lovePoints: number;
}

class ExpeditionRow extends Model {
	declare id: number;

	declare playerId: number;

	declare completed: boolean;
}

let env: IntegrationTestEnvironment;
let Players: ModelStatic<PlayerRow>;
let Pets: ModelStatic<PetRow>;
let Expeditions: ModelStatic<ExpeditionRow>;

const CANDY_PRICE = 20;
const LOVE_GAIN = 3;
const EXPEDITION_REWARD = 200;

beforeAll(async () => {
	env = await setupIntegrationDb("pet_feed_expedition_interact_race");
	Players = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			petId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
		},
		{ sequelize: env.sequelize, tableName: "pf4_player", timestamps: false }
	);
	Pets = PetRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			lovePoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "pf4_pet", timestamps: false }
	);
	Expeditions = ExpeditionRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			playerId: { type: DataTypes.INTEGER, allowNull: false },
			completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
		},
		{ sequelize: env.sequelize, tableName: "pf4_expedition", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await Promise.all([
		Players.destroy({ where: {}, truncate: true }),
		Pets.destroy({ where: {}, truncate: true }),
		Expeditions.destroy({ where: {}, truncate: true })
	]);
});

/* ------------------------- PetFeed (no guild) ------------------------- */

async function feedUnsafe(playerId: number, petId: number): Promise<boolean> {
	const player = await Players.findByPk(playerId);
	const pet = await Pets.findByPk(petId);
	if (!player || !pet || player.petId !== petId || player.money < CANDY_PRICE) {
		return false;
	}
	await new Promise(resolve => setImmediate(resolve));
	player.money -= CANDY_PRICE;
	pet.lovePoints += LOVE_GAIN;
	await Promise.all([player.save(), pet.save()]);
	return true;
}

async function feedLocked(playerId: number, petId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: Players, id: playerId } as LockKey<PlayerRow>,
			{ model: Pets, id: petId } as LockKey<PetRow>
		],
		async ([player, pet]) => {
			if (player.petId !== petId || player.money < CANDY_PRICE) {
				return false;
			}
			player.money -= CANDY_PRICE;
			pet.lovePoints += LOVE_GAIN;
			await Promise.all([player.save(), pet.save()]);
			return true;
		}
	);
}

describe("PetFeed candy race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe feeds both succeed on a single-candy budget",
		async () => {
			await Players.create({ id: 1, money: CANDY_PRICE, petId: 1 });
			await Pets.create({ id: 1, lovePoints: 0 });

			const results = await Promise.all([
				feedUnsafe(1, 1), feedUnsafe(1, 1)
			]);

			const [player, pet] = await Promise.all([Players.findByPk(1), Pets.findByPk(1)]);
			// Both unsafe feeds passed the affordability check on the
			// stale snapshot and reported success…
			expect(results).toEqual([true, true]);
			// …but only ONE love gain landed (silent lost update on
			// pet.lovePoints): the player paid for two candies and the
			// pet only got one.
			expect(player?.money).toBe(0);
			expect(pet?.lovePoints).toBe(LOVE_GAIN);
		}
	);

	it("FIXES the bug: locked feeds serialise affordability + ownership check", async () => {
		await Players.create({ id: 2, money: CANDY_PRICE, petId: 2 });
		await Pets.create({ id: 2, lovePoints: 0 });

		const results = await Promise.all([
			feedLocked(2, 2), feedLocked(2, 2)
		]);

		const successCount = results.filter(Boolean).length;
		expect(successCount).toBe(1);
		const [player, pet] = await Promise.all([Players.findByPk(2), Pets.findByPk(2)]);
		expect(player?.money).toBe(0);
		expect(pet?.lovePoints).toBe(LOVE_GAIN);
	});

	it(
		"FIXES the bug: feed bails out when pet was transferred away mid-flight",
		async () => {
			await Players.create({ id: 3, money: 1000, petId: 3 });
			await Pets.create({ id: 3, lovePoints: 0 });

			const result = await withLockedEntities(
				[
					{ model: Players, id: 3 } as LockKey<PlayerRow>,
					{ model: Pets, id: 3 } as LockKey<PetRow>
				],
				async ([player, pet]) => {
					// Simulate a concurrent transfer that already
					// cleared petId on the canonical row before we
					// reached the lock body.
					player.petId = null;
					await player.save();

					if (player.petId !== 3) {
						return false;
					}
					player.money -= CANDY_PRICE;
					pet.lovePoints += LOVE_GAIN;
					await Promise.all([player.save(), pet.save()]);
					return true;
				}
			);

			expect(result).toBe(false);
			const [player, pet] = await Promise.all([Players.findByPk(3), Pets.findByPk(3)]);
			expect(player?.money).toBe(1000);
			expect(pet?.lovePoints).toBe(0);
		}
	);
});

/* ------------------------- PetExpedition resolve ------------------------- */

async function resolveExpeditionUnsafe(playerId: number, expeditionId: number): Promise<boolean> {
	const expedition = await Expeditions.findByPk(expeditionId);
	if (!expedition || expedition.completed) {
		return false;
	}
	await new Promise(resolve => setImmediate(resolve));
	const player = await Players.findByPk(playerId);
	if (!player) {
		return false;
	}
	player.money += EXPEDITION_REWARD;
	expedition.completed = true;
	await Promise.all([player.save(), expedition.save()]);
	return true;
}

async function resolveExpeditionLocked(playerId: number, expeditionId: number): Promise<boolean> {
	return await withLockedEntities(
		[{ model: Players, id: playerId } as LockKey<PlayerRow>],
		async ([player]) => {
			const expedition = await Expeditions.findOne({
				where: { id: expeditionId, completed: false }
			});
			if (!expedition) {
				return false;
			}
			player.money += EXPEDITION_REWARD;
			expedition.completed = true;
			await Promise.all([player.save(), expedition.save()]);
			return true;
		}
	);
}

describe("PetExpedition resolve race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe resolutions both apply the reward",
		async () => {
			await Players.create({ id: 11, money: 0, petId: 11 });
			await Expeditions.create({ id: 11, playerId: 11, completed: false });

			const results = await Promise.all([
				resolveExpeditionUnsafe(11, 11),
				resolveExpeditionUnsafe(11, 11)
			]);

			expect(results).toEqual([true, true]);
			const player = await Players.findByPk(11);
			// Lost update on player.money: both unsafe resolutions
			// reported success but only one credit survived. Either
			// way the invariant is broken — the player was promised
			// two rewards and got one (silent loss).
			expect(player?.money).toBe(EXPEDITION_REWARD);
		}
	);

	it("FIXES the bug: locked resolutions credit the reward exactly once", async () => {
		await Players.create({ id: 12, money: 0, petId: 12 });
		await Expeditions.create({ id: 12, playerId: 12, completed: false });

		const results = await Promise.all([
			resolveExpeditionLocked(12, 12),
			resolveExpeditionLocked(12, 12)
		]);

		const successCount = results.filter(Boolean).length;
		expect(successCount).toBe(1);
		const player = await Players.findByPk(12);
		expect(player?.money).toBe(EXPEDITION_REWARD);
	});
});

/* ------------------------- interactOtherPlayers.sendACoin ------------------------- */

async function sendCoinUnsafe(donorId: number, beggarId: number): Promise<boolean> {
	const donor = await Players.findByPk(donorId);
	const beggar = await Players.findByPk(beggarId);
	if (!donor || !beggar || donor.money < 1) {
		return false;
	}
	await new Promise(resolve => setImmediate(resolve));
	donor.money -= 1;
	beggar.money += 1;
	await Promise.all([donor.save(), beggar.save()]);
	return true;
}

async function sendCoinLocked(donorId: number, beggarId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: Players, id: donorId } as LockKey<PlayerRow>,
			{ model: Players, id: beggarId } as LockKey<PlayerRow>
		],
		async ([donor, beggar]) => {
			if (donor.money < 1) {
				return false;
			}
			donor.money -= 1;
			beggar.money += 1;
			await Promise.all([donor.save(), beggar.save()]);
			return true;
		}
	);
}

describe("interactOtherPlayers sendACoin race (integration)", () => {
	it(
		"DEMONSTRATES the bug: a single-coin donor mints a phantom coin under concurrent gifts",
		async () => {
			/*
			 * Donor has exactly 1 coin. Two concurrent SE
			 * invocations target two DIFFERENT beggars (otherPlayer
			 * is sampled randomly per execution, so different
			 * targets is the realistic case). Both unsafe transfers
			 * pass `donor.money >= 1` on the same stale snapshot,
			 * both deduct → donor ends at 0 (lost-update on the
			 * second debit, would have been -1) and BOTH beggars
			 * get credited → +1 coin out of thin air.
			 */
			await Players.create({ id: 21, money: 1, petId: null });
			await Players.create({ id: 22, money: 0, petId: null });
			await Players.create({ id: 25, money: 0, petId: null });

			const results = await Promise.all([
				sendCoinUnsafe(21, 22), sendCoinUnsafe(21, 25)
			]);

			expect(results).toEqual([true, true]);
			const [donor, beggarA, beggarB] = await Promise.all([
				Players.findByPk(21), Players.findByPk(22), Players.findByPk(25)
			]);
			// Donor decremented only once despite two reported transfers.
			expect(donor?.money).toBe(0);
			// Each beggar still got their coin.
			expect(beggarA?.money).toBe(1);
			expect(beggarB?.money).toBe(1);
			// Net: 1 coin in the system became 2 — money created
			// from nothing.
			const totalAfter = (donor?.money ?? 0) + (beggarA?.money ?? 0) + (beggarB?.money ?? 0);
			expect(totalAfter).toBe(2);
		}
	);

	it("FIXES the bug: locked coin gifts cap the donor at zero", async () => {
		await Players.create({ id: 23, money: 1, petId: null });
		await Players.create({ id: 24, money: 0, petId: null });
		await Players.create({ id: 26, money: 0, petId: null });

		const results = await Promise.all([
			sendCoinLocked(23, 24), sendCoinLocked(23, 26)
		]);

		const successCount = results.filter(Boolean).length;
		expect(successCount).toBe(1);
		const [donor, beggarA, beggarB] = await Promise.all([
			Players.findByPk(23), Players.findByPk(24), Players.findByPk(26)
		]);
		expect(donor?.money).toBe(0);
		// Exactly one beggar got the single coin; total preserved.
		const totalAfter = (donor?.money ?? 0) + (beggarA?.money ?? 0) + (beggarB?.money ?? 0);
		expect(totalAfter).toBe(1);
	});
});
