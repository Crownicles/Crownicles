/**
 * Race integration test for the 4-row pet-sell critical section
 * fixed by PR-F2 (`PetSellCommand`).
 *
 * The sale mutates seller.petId, buyer.petId, buyer.money, pet.lovePoints
 * and seller_guild.treasury in the same logical step. Without locking,
 * two simultaneous accept-clicks (or an accept-click racing a withdraw
 * by the seller) can:
 *   - double-debit the buyer's money
 *   - clone the pet across two buyers
 *   - over-credit the guild treasury
 *
 * PR-F2 wraps the read-validate-mutate-save sequence in
 * `withLockedEntities([Player(seller), Player(buyer), PetEntity, Guild])`,
 * with in-lock revalidation of every actor's invariants.
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

	declare petId: number | null;

	declare money: number;
}

class PetRow extends Model {
	declare id: number;

	declare lovePoints: number;
}

class GuildRow extends Model {
	declare id: number;

	declare treasury: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let PetModel: ModelStatic<PetRow>;
let GuildModel: ModelStatic<GuildRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("pet_sell_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			petId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row_sell", timestamps: false }
	);
	PetModel = PetRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			lovePoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "pet_row_sell", timestamps: false }
	);
	GuildModel = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			treasury: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "guild_row_sell", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
	await PetModel.destroy({ where: {}, truncate: true });
	await GuildModel.destroy({ where: {}, truncate: true });
});

const PRICE = 500;
const TREASURY_GAIN = 450; // simulates a fixed penalty so we can assert exact treasury

/**
 * Buggy variant: read seller / buyer / pet / guild, validate, mutate
 * — without holding any row lock. Mirrors the pre-PR-F2 production
 * code path of `executePetSell`.
 */
async function unsafeSell(sellerId: number, buyerId: number, petId: number, guildId: number): Promise<boolean> {
	const seller = await PlayerModel.findByPk(sellerId);
	const buyer = await PlayerModel.findByPk(buyerId);
	const pet = await PetModel.findByPk(petId);
	const guild = await GuildModel.findByPk(guildId);
	if (!seller || !buyer || !pet || !guild
		|| seller.petId !== petId || buyer.petId !== null || buyer.money < PRICE) {
		return false;
	}
	// Yield once so two unsafe buyers interleave their read-validate
	// phase and both pass the check on the same stale snapshot.
	await new Promise(resolve => setImmediate(resolve));
	guild.treasury += TREASURY_GAIN;
	buyer.money -= PRICE;
	buyer.petId = pet.id;
	seller.petId = null;
	pet.lovePoints = 0;
	await Promise.all([guild.save(), buyer.save(), seller.save(), pet.save()]);
	return true;
}

/**
 * Fixed variant: lock all four rows with `SELECT … FOR UPDATE`,
 * re-validate every invariant, mutate, save in one TX.
 */
async function lockedSell(sellerId: number, buyerId: number, petId: number, guildId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: PlayerModel, id: sellerId } as LockKey<PlayerRow>,
			{ model: PlayerModel, id: buyerId } as LockKey<PlayerRow>,
			{ model: PetModel, id: petId } as LockKey<PetRow>,
			{ model: GuildModel, id: guildId } as LockKey<GuildRow>
		] as const,
		async ([seller, buyer, pet, guild]) => {
			if (seller.petId !== petId || buyer.petId !== null || buyer.money < PRICE) {
				return false;
			}
			guild.treasury += TREASURY_GAIN;
			buyer.money -= PRICE;
			buyer.petId = pet.id;
			seller.petId = null;
			pet.lovePoints = 0;
			await Promise.all([guild.save(), buyer.save(), seller.save(), pet.save()]);
			return true;
		}
	);
}

describe("pet sell race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe buyers BOTH pay and BOTH adopt the same pet",
		async () => {
			await PlayerModel.create({ id: 1, petId: 100, money: 0 });    // seller
			await PlayerModel.create({ id: 2, petId: null, money: 1000 }); // buyer A
			await PlayerModel.create({ id: 3, petId: null, money: 1000 }); // buyer B
			await PetModel.create({ id: 100, lovePoints: 50 });
			await GuildModel.create({ id: 200, treasury: 0 });

			const results = await Promise.all([
				unsafeSell(1, 2, 100, 200),
				unsafeSell(1, 3, 100, 200)
			]);

			const [seller, buyerA, buyerB, guild] = await Promise.all([
				PlayerModel.findByPk(1),
				PlayerModel.findByPk(2),
				PlayerModel.findByPk(3),
				GuildModel.findByPk(200)
			]);

			expect(results).toEqual([true, true]);
			// Bug: BOTH buyers paid and BOTH "adopted" pet 100.
			expect(buyerA?.money).toBe(500);
			expect(buyerB?.money).toBe(500);
			expect(buyerA?.petId).toBe(100);
			expect(buyerB?.petId).toBe(100);
			/*
			 * Guild treasury exhibits a different bug: classic
			 * lost-update. Both unsafe sellers read `treasury=0`,
			 * both write `0 + TREASURY_GAIN`. The guild ends up
			 * credited only ONCE despite TWO sales completing —
			 * double bug: pets are duplicated AND the guild loses
			 * half its earnings.
			 */
			expect(guild?.treasury).toBe(TREASURY_GAIN);
			expect(seller?.petId).toBeNull();
		}
	);

	it(
		"FIXES the bug: locked sales serialise — only one buyer wins; treasury credited once",
		async () => {
			await PlayerModel.create({ id: 11, petId: 110, money: 0 });
			await PlayerModel.create({ id: 12, petId: null, money: 1000 });
			await PlayerModel.create({ id: 13, petId: null, money: 1000 });
			await PetModel.create({ id: 110, lovePoints: 50 });
			await GuildModel.create({ id: 210, treasury: 0 });

			const results = await Promise.all([
				lockedSell(11, 12, 110, 210),
				lockedSell(11, 13, 110, 210)
			]);

			const [seller, buyerA, buyerB, pet, guild] = await Promise.all([
				PlayerModel.findByPk(11),
				PlayerModel.findByPk(12),
				PlayerModel.findByPk(13),
				PetModel.findByPk(110),
				GuildModel.findByPk(210)
			]);

			// Exactly one of the two sales succeeded.
			expect(results.filter(success => success)).toHaveLength(1);
			expect(seller?.petId).toBeNull();
			// Exactly ONE buyer ended up with the pet AND the debit.
			const buyers = [buyerA, buyerB];
			const buyersWithPet = buyers.filter(buyer => buyer?.petId === 110);
			const buyersDebited = buyers.filter(buyer => buyer?.money === 500);
			expect(buyersWithPet).toHaveLength(1);
			expect(buyersDebited).toHaveLength(1);
			// Treasury credited exactly once.
			expect(guild?.treasury).toBe(TREASURY_GAIN);
			expect(pet?.lovePoints).toBe(0);
		}
	);

	it(
		"FIXES the bug: distinct seller/pet pairs sell in parallel without contention",
		async () => {
			await PlayerModel.create({ id: 21, petId: 121, money: 0 });
			await PlayerModel.create({ id: 22, petId: 122, money: 0 });
			await PlayerModel.create({ id: 23, petId: null, money: 1000 });
			await PlayerModel.create({ id: 24, petId: null, money: 1000 });
			await PetModel.create({ id: 121, lovePoints: 50 });
			await PetModel.create({ id: 122, lovePoints: 50 });
			await GuildModel.create({ id: 221, treasury: 0 });
			await GuildModel.create({ id: 222, treasury: 0 });

			const results = await Promise.all([
				lockedSell(21, 23, 121, 221),
				lockedSell(22, 24, 122, 222)
			]);

			expect(results).toEqual([true, true]);
		}
	);
});
