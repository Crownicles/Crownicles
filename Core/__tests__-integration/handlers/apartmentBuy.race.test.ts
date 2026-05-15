/**
 * Race integration test for apartment purchase.
 *
 * Production invariant: a player can own at most one apartment per
 * city. This is enforced by a UNIQUE INDEX on (ownerId, cityId) on
 * the `apartment` table. Two concurrent "buy apartment in city C"
 * requests for the same player must therefore result in exactly one
 * row inserted, with the second attempt failing on the unique
 * constraint (caught and surfaced to the player as "already owned").
 *
 * This test uses an ad-hoc minimal model rather than booting the full
 * Core to keep the integration suite self-contained, following the
 * same pattern as the other race tests in this folder.
 */
import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic, UniqueConstraintError
} from "sequelize";
import { IntegrationTestEnvironment, setupIntegrationDb } from "../_setup";

class ApartmentRow extends Model {
	declare id: number;

	declare ownerId: number;

	declare cityId: string;
}

let env: IntegrationTestEnvironment;
let ApartmentModel: ModelStatic<ApartmentRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("apartment_buy_race");
	ApartmentModel = ApartmentRow.init(
		{
			id: {
				type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
			},
			ownerId: { type: DataTypes.INTEGER, allowNull: false },
			cityId: { type: DataTypes.STRING(64), allowNull: false }
		},
		{
			sequelize: env.sequelize,
			tableName: "apartment_row",
			timestamps: false,
			indexes: [{ unique: true, fields: ["ownerId", "cityId"] }]
		}
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await ApartmentModel.destroy({ where: {}, truncate: true });
});

/**
 * Mirror of the production buy flow: best-effort insert relying on
 * the unique index to serialise concurrent buyers. Concurrent winners
 * receive `UniqueConstraintError` and report "already owned" to the
 * player, leaving exactly one row in the table.
 */
async function buyApartment(ownerId: number, cityId: string): Promise<"bought" | "already-owned"> {
	try {
		await ApartmentModel.create({ ownerId, cityId });
		return "bought";
	}
	catch (error) {
		if (error instanceof UniqueConstraintError) {
			return "already-owned";
		}
		throw error;
	}
}

describe("apartment buy race (integration)", () => {
	it("UNIQUE INDEX prevents double-buy under concurrent inserts", async () => {
		const N = 10;
		const results = await Promise.all(
			Array.from({ length: N }, () => buyApartment(42, "lyon"))
		);
		const bought = results.filter(r => r === "bought").length;
		const alreadyOwned = results.filter(r => r === "already-owned").length;

		expect(bought).toBe(1);
		expect(alreadyOwned).toBe(N - 1);

		const count = await ApartmentModel.count({ where: { ownerId: 42, cityId: "lyon" } });
		expect(count).toBe(1);
	});

	it("different cities for the same owner all succeed", async () => {
		const cities = ["lyon", "paris", "marseille", "bordeaux"];
		const results = await Promise.all(
			cities.map(city => buyApartment(7, city))
		);
		expect(results.every(r => r === "bought")).toBe(true);
		expect(await ApartmentModel.count({ where: { ownerId: 7 } })).toBe(cities.length);
	});
});
