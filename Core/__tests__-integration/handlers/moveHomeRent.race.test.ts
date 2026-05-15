/**
 * Race integration test for the move-home rent deduction.
 *
 * Production invariant: when a player moves their home out of a city
 * where they own a rented-out apartment, the accumulated rent is
 * deducted from the move price EXACTLY ONCE — even if multiple move
 * requests interleave. The post-refactor code achieves this by
 * locking Home + Player + Apartment under `withLockedEntities`,
 * re-reading the apartment state inside the lock, applying the
 * deduction, and resetting `lastRentClaimedAt` before commit.
 */
import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import { IntegrationTestEnvironment, setupIntegrationDb } from "../_setup";
import {
	LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";

const MS_PER_DAY = 24 * 3_600_000;
const DAILY_RENT = 100;
const PURCHASE_PRICE = 36_500;
const { MIN_RENT_TO_CLAIM } = HomeConstants;
const MOVE_PRICE = 5_000;

class ApartmentRow extends Model {
	declare id: number;

	declare cityId: string;

	declare lastRentClaimedAt: Date;
}

class PlayerRow extends Model {
	declare id: number;

	declare money: number;
}

class HomeRow extends Model {
	declare id: number;

	declare cityId: string;
}

let env: IntegrationTestEnvironment;
let ApartmentModel: ModelStatic<ApartmentRow>;
let PlayerModel: ModelStatic<PlayerRow>;
let HomeModel: ModelStatic<HomeRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("move_home_rent_race");
	ApartmentModel = ApartmentRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			cityId: { type: DataTypes.STRING(64), allowNull: false },
			lastRentClaimedAt: { type: DataTypes.DATE, allowNull: false }
		},
		{
			sequelize: env.sequelize, tableName: "apartment_move", timestamps: false
		}
	);
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			money: { type: DataTypes.INTEGER, allowNull: false }
		},
		{
			sequelize: env.sequelize, tableName: "player_move", timestamps: false
		}
	);
	HomeModel = HomeRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			cityId: { type: DataTypes.STRING(64), allowNull: false }
		},
		{
			sequelize: env.sequelize, tableName: "home_move", timestamps: false
		}
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await ApartmentModel.destroy({ where: {}, truncate: true });
	await PlayerModel.destroy({ where: {}, truncate: true });
	await HomeModel.destroy({ where: {}, truncate: true });
});

function getAccumulatedRent(apartment: ApartmentRow, now: Date): number {
	const elapsedMs = now.getTime() - apartment.lastRentClaimedAt.getTime();
	const elapsedDays = Math.max(0, elapsedMs / MS_PER_DAY);
	const raw = Math.floor(elapsedDays * DAILY_RENT);
	return Math.min(raw, PURCHASE_PRICE);
}

/**
 * Locked move-home: mirrors the production `handleMoveHomeReaction`
 * critical section.
 */
async function moveHomeLocked(
	homeId: number, playerId: number, apartmentId: number, destinationCityId: string
): Promise<{ effectivePrice: number; rentApplied: number }> {
	return await withLockedEntities(
		[
			{ model: HomeModel, id: homeId } as LockKey<HomeRow>,
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
			{ model: ApartmentModel, id: apartmentId } as LockKey<ApartmentRow>
		],
		async ([home, player, apartment]) => {
			let rentApplied = 0;
			const accumulated = getAccumulatedRent(apartment, new Date());
			if (accumulated >= MIN_RENT_TO_CLAIM) {
				rentApplied = Math.min(accumulated, MOVE_PRICE);
			}
			const effectivePrice = MOVE_PRICE - rentApplied;
			if (effectivePrice > player.money) {
				return { effectivePrice: -1, rentApplied: 0 };
			}
			home.cityId = destinationCityId;
			player.money -= effectivePrice;
			if (rentApplied > 0) {
				apartment.lastRentClaimedAt = new Date();
			}
			const saves: Promise<unknown>[] = [home.save(), player.save()];
			if (rentApplied > 0) {
				saves.push(apartment.save());
			}
			await Promise.all(saves);
			return { effectivePrice, rentApplied };
		}
	);
}

describe("move-home rent deduction race (integration)", () => {
	it("locked moves deduct rent at most once across concurrent calls", async () => {
		const tenDaysAgo = new Date(Date.now() - 10 * MS_PER_DAY);
		// Player has barely enough to cover ONE move at the discounted
		// price (5000 - 1000 = 4000) but NOT a full-price one (5000).
		await ApartmentModel.create({ id: 1, cityId: "lyon", lastRentClaimedAt: tenDaysAgo });
		await PlayerModel.create({ id: 1, money: 4_000 });
		await HomeModel.create({ id: 1, cityId: "lyon" });

		const N = 5;
		const results = await Promise.all(
			Array.from({ length: N }, () => moveHomeLocked(1, 1, 1, "paris"))
		);

		const successful = results.filter(r => r.effectivePrice >= 0);
		const withRent = results.filter(r => r.rentApplied > 0);
		// Exactly one call should succeed (the others see player.money < effectivePrice once the first commits).
		expect(successful.length).toBe(1);
		// The single successful call is the one that deducted rent.
		expect(withRent.length).toBe(1);
		expect(withRent[0].rentApplied).toBe(1_000);
		expect(withRent[0].effectivePrice).toBe(4_000);

		const player = await PlayerModel.findByPk(1);
		expect(player?.money).toBe(0);
	});

	it("locked moves skip rent below MIN_RENT_TO_CLAIM", async () => {
		const halfDayAgo = new Date(Date.now() - MS_PER_DAY / 2);
		await ApartmentModel.create({ id: 2, cityId: "lyon", lastRentClaimedAt: halfDayAgo });
		await PlayerModel.create({ id: 2, money: 10_000 });
		await HomeModel.create({ id: 2, cityId: "lyon" });

		const result = await moveHomeLocked(2, 2, 2, "paris");
		expect(result.rentApplied).toBe(0);
		expect(result.effectivePrice).toBe(MOVE_PRICE);
		const player = await PlayerModel.findByPk(2);
		expect(player?.money).toBe(10_000 - MOVE_PRICE);
	});

	it("locked moves cap rent at move price (surplus forfeited)", async () => {
		// 100 days → 10_000 accumulated rent, but move price is only 5_000.
		const longAgo = new Date(Date.now() - 100 * MS_PER_DAY);
		await ApartmentModel.create({ id: 3, cityId: "lyon", lastRentClaimedAt: longAgo });
		await PlayerModel.create({ id: 3, money: 0 });
		await HomeModel.create({ id: 3, cityId: "lyon" });

		const result = await moveHomeLocked(3, 3, 3, "paris");
		expect(result.rentApplied).toBe(MOVE_PRICE);
		expect(result.effectivePrice).toBe(0);
		const player = await PlayerModel.findByPk(3);
		expect(player?.money).toBe(0);
	});
});
