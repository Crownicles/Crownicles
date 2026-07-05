import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import type { CommandReportFoodShopBuyReq } from "../../../Lib/src/packets/commands/CommandReportPacket";

type FoodShopModule = typeof import("../../src/core/report/ReportCityFoodShopService");

/**
 * Functional regression test for {@link FoodShopModule.handleFoodShopBuy}
 * mission side effects.
 *
 * Regression covered (issue #4359): buying pet food through the city
 * food shop only advanced the generic `buyGuildPetFood` mission and
 * silently dropped the campaign-specific `buyUltimateSoups` mission
 * ("acheter 2 soupes ultimes"). The fix updates `buyUltimateSoups`
 * too, but only when the purchased food is `ULTIMATE_FOOD` — buying
 * any other food must NOT advance it.
 */
describe("handleFoodShopBuy mission side effects", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let foodShop: FoodShopModule;

	const ULTIMATE_FOOD_PRICE = 600;

	beforeAll(async () => {
		env = await setupCoreForTests("foodshopmissions");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Guild = env.crownicles.gameDatabase.sequelize.models.Guild as ModelStatic<GuildType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		foodShop = loadProductionModule<FoodShopModule>("core/report/ReportCityFoodShopService");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
			await Guild.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	/**
	 * Seed a player owning a guild with a working shop and enough
	 * treasury, plus the two "buy pet food" missions used by the shop.
	 * Objectives are set above the purchased amount so the missions
	 * progress without completing (avoiding campaign-progression side
	 * effects unrelated to this regression).
	 */
	async function seedBuyer(keycloakId: string): Promise<{ playerId: number; guildId: number }> {
		const player = await Player.create({ keycloakId });
		const guild = await Guild.create({
			name: `FoodShopGuild-${keycloakId}`,
			chiefId: player.id,
			shopLevel: 1,
			treasury: 10_000
		});
		await Player.update({ guildId: guild.id }, { where: { id: player.id } });
		await PlayerMissionsInfo.create({ playerId: player.id });

		// Generic "buy pet food" mission (normal, not yet expired).
		await MissionSlot.create({
			playerId: player.id,
			missionId: "buyGuildPetFood",
			missionVariant: 0,
			missionObjective: 5,
			numberDone: 0,
			expiresAt: new Date(Date.now() + 96 * 3_600_000),
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});

		// Campaign "buy ultimate soups" mission (expiresAt null = campaign).
		await MissionSlot.create({
			playerId: player.id,
			missionId: "buyUltimateSoups",
			missionVariant: 0,
			missionObjective: 5,
			numberDone: 0,
			expiresAt: null,
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});

		return {
			playerId: player.id, guildId: guild.id
		};
	}

	async function numberDoneOf(playerId: number, missionId: string): Promise<number> {
		const slot = await MissionSlot.findOne({ where: { playerId, missionId } });
		return slot!.numberDone;
	}

	it("advances both buyGuildPetFood and buyUltimateSoups when buying ultimate food", async () => {
		const { playerId } = await seedBuyer("food-shop-ultimate");

		const packet = {
			foodType: PetConstants.PET_FOOD.ULTIMATE_FOOD,
			amount: 2
		} as CommandReportFoodShopBuyReq;

		await foodShop.handleFoodShopBuy("food-shop-ultimate", packet, []);

		expect(await numberDoneOf(playerId, "buyGuildPetFood")).toBe(2);
		expect(await numberDoneOf(playerId, "buyUltimateSoups")).toBe(2);
	});

	it("does not advance buyUltimateSoups when buying non-ultimate food", async () => {
		const { playerId } = await seedBuyer("food-shop-common");

		const packet = {
			foodType: PetConstants.PET_FOOD.COMMON_FOOD,
			amount: 2
		} as CommandReportFoodShopBuyReq;

		await foodShop.handleFoodShopBuy("food-shop-common", packet, []);

		expect(await numberDoneOf(playerId, "buyGuildPetFood")).toBe(2);
		expect(await numberDoneOf(playerId, "buyUltimateSoups")).toBe(0);
	});

	it("advances buyUltimateSoups only by the amount actually bought (treasury-capped)", async () => {
		const player = await Player.create({ keycloakId: "food-shop-capped" });
		// Treasury only affords a single ultimate soup.
		const guild = await Guild.create({
			name: "FoodShopGuild-capped",
			chiefId: player.id,
			shopLevel: 1,
			treasury: ULTIMATE_FOOD_PRICE
		});
		await Player.update({ guildId: guild.id }, { where: { id: player.id } });
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "buyUltimateSoups",
			missionVariant: 0,
			missionObjective: 5,
			numberDone: 0,
			expiresAt: null,
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});

		const packet = {
			foodType: PetConstants.PET_FOOD.ULTIMATE_FOOD,
			amount: 5
		} as CommandReportFoodShopBuyReq;

		await foodShop.handleFoodShopBuy("food-shop-capped", packet, []);

		expect(await numberDoneOf(player.id, "buyUltimateSoups")).toBe(1);
	});
});
