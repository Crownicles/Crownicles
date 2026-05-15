/**
 * Race integration test for apartment rent claim.
 *
 * Production invariant: concurrent claim attempts on the same
 * apartment must credit the accumulated rent EXACTLY ONCE. The
 * post-refactor code achieves this by locking the apartment row
 * (`SELECT … FOR UPDATE`), re-reading `lastRentClaimedAt`, computing
 * the rent inside the lock, and resetting `lastRentClaimedAt` before
 * commit.
 *
 * The unsafe variant (no lock, no re-fetch) double-credits because
 * both readers see the same stale timestamp.
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

class ApartmentRow extends Model {
	declare id: number;

	declare lastRentClaimedAt: Date;
}

class PlayerRow extends Model {
	declare id: number;

	declare money: number;
}

let env: IntegrationTestEnvironment;
let ApartmentModel: ModelStatic<ApartmentRow>;
let PlayerModel: ModelStatic<PlayerRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("apartment_claim_race");
	ApartmentModel = ApartmentRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			lastRentClaimedAt: { type: DataTypes.DATE, allowNull: false }
		},
		{
			sequelize: env.sequelize, tableName: "apartment_claim", timestamps: false
		}
	);
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			money: { type: DataTypes.INTEGER, allowNull: false }
		},
		{
			sequelize: env.sequelize, tableName: "player_claim", timestamps: false
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
});

function getAccumulatedRent(apartment: ApartmentRow, now: Date): number {
	const elapsedMs = now.getTime() - apartment.lastRentClaimedAt.getTime();
	const elapsedDays = Math.max(0, elapsedMs / MS_PER_DAY);
	const raw = Math.floor(elapsedDays * DAILY_RENT);
	return Math.min(raw, PURCHASE_PRICE);
}

/**
 * Locked claim: mirrors the production `handleApartmentClaimRent`
 * critical section.
 */
async function claimRentLocked(apartmentId: number, playerId: number): Promise<number> {
	return await withLockedEntities(
		[
			{ model: ApartmentModel, id: apartmentId } as LockKey<ApartmentRow>,
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>
		],
		async ([apartment, player]) => {
			const now = new Date();
			const accumulated = getAccumulatedRent(apartment, now);
			if (accumulated < MIN_RENT_TO_CLAIM) {
				return 0;
			}
			player.money += accumulated;
			apartment.lastRentClaimedAt = now;
			await Promise.all([apartment.save(), player.save()]);
			return accumulated;
		}
	);
}

/**
 * Unsafe claim: no lock — used only to prove the test fixture
 * exposes the race.
 */
async function claimRentUnsafe(apartmentId: number, playerId: number): Promise<number> {
	const apartment = await ApartmentModel.findByPk(apartmentId);
	const player = await PlayerModel.findByPk(playerId);
	if (!apartment || !player) {
		throw new Error("missing fixture");
	}
	const now = new Date();
	const accumulated = getAccumulatedRent(apartment, now);
	if (accumulated < MIN_RENT_TO_CLAIM) {
		return 0;
	}
	await new Promise(resolve => setImmediate(resolve));
	player.money += accumulated;
	apartment.lastRentClaimedAt = now;
	await Promise.all([apartment.save(), player.save()]);
	return accumulated;
}

describe("apartment claim rent race (integration)", () => {
	it("DEMONSTRATES the bug: unsafe claims double-credit rent", async () => {
		const tenDaysAgo = new Date(Date.now() - 10 * MS_PER_DAY);
		await ApartmentModel.create({ id: 1, lastRentClaimedAt: tenDaysAgo });
		await PlayerModel.create({ id: 1, money: 0 });

		const [a, b] = await Promise.all([
			claimRentUnsafe(1, 1),
			claimRentUnsafe(1, 1)
		]);

		// Both claims see the same stale timestamp → both report the
		// full rent as credited. But the two `player.save()` writes
		// race, so only one credit actually persists: the player is
		// silently shortchanged. With the lock, the second caller
		// would see the reset timestamp and report 0.
		expect(a).toBeGreaterThan(0);
		expect(b).toBeGreaterThan(0);
		const player = await PlayerModel.findByPk(1);
		expect(player?.money).toBeLessThan(a + b);
	});

	it("FIXES the bug: locked claims credit rent exactly once", async () => {
		const tenDaysAgo = new Date(Date.now() - 10 * MS_PER_DAY);
		await ApartmentModel.create({ id: 2, lastRentClaimedAt: tenDaysAgo });
		await PlayerModel.create({ id: 2, money: 0 });

		const N = 5;
		const results = await Promise.all(
			Array.from({ length: N }, () => claimRentLocked(2, 2))
		);

		const credited = results.filter(r => r > 0);
		expect(credited.length).toBe(1);
		const player = await PlayerModel.findByPk(2);
		expect(player?.money).toBe(credited[0]);
	});

	it("FIXES the bug: locked claims skip below threshold", async () => {
		// Less than a day → less than DAILY_RENT (100) accumulated.
		const halfDayAgo = new Date(Date.now() - MS_PER_DAY / 2);
		await ApartmentModel.create({ id: 3, lastRentClaimedAt: halfDayAgo });
		await PlayerModel.create({ id: 3, money: 0 });

		const results = await Promise.all([
			claimRentLocked(3, 3),
			claimRentLocked(3, 3)
		]);
		expect(results).toEqual([0, 0]);
		const player = await PlayerModel.findByPk(3);
		expect(player?.money).toBe(0);
	});
});
