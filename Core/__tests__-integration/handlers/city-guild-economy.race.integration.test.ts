import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { City as CityType } from "../../src/data/City";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import {
	GuildBuilding, GuildDomainConstants
} from "../../../Lib/src/constants/GuildDomainConstants";
import type {
	CommandReportFoodShopBuyReq, CommandReportFoodShopBuyRes, CommandReportGuildDomainUpgradeRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";

type GuildDomainModule = typeof import("../../src/core/report/ReportCityGuildDomainService");
type FoodShopModule = typeof import("../../src/core/report/ReportCityFoodShopService");
type CityDataModule = typeof import("../../src/data/City");

const KEYCLOAK_ID = "city-guild-economy";
const CONCURRENT_REQUESTS = 5;
const DOMAIN_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const RICH_TREASURY = 1_000_000;
const ULTIMATE_FOOD = PetConstants.PET_FOOD.ULTIMATE_FOOD;
const ULTIMATE_FOOD_PRICE = GuildDomainConstants.SHOP_PRICES.FOOD[3];

/**
 * Economic invariants of the guild domain notary, the domain building upgrades and the guild food shop
 * (review checklist section 11): the treasury never goes negative, it pays exactly what the response reports,
 * and a confirmation sent several times is applied once
 */
describe("City guild economy", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let guildDomain: GuildDomainModule;
	let foodShop: FoodShopModule;
	let cityData: CityDataModule;

	function getCity(cityId: string): CityType {
		const city = cityData.CityDataController.instance.getById(cityId);
		if (!city) {
			throw new Error(`Unknown city ${cityId}`);
		}
		return city;
	}

	async function createChiefWithGuild(guild: Partial<{
		treasury: number; domainCityId: string | null; shopLevel: number; level: number;
	}>): Promise<{ player: PlayerType; guildId: number }> {
		const player = await Player.create({ keycloakId: KEYCLOAK_ID });
		await PlayerMissionsInfo.create({ playerId: player.id });
		const created = await Guild.create({
			name: "CityGuildEconomy",
			chiefId: player.id,
			treasury: 0,
			...guild
		});
		await Player.update({ guildId: created.id }, { where: { id: player.id } });
		await player.reload();
		return {
			player, guildId: created.id
		};
	}

	async function getGuild(guildId: number): Promise<GuildType> {
		return await Guild.findByPk(guildId, { rejectOnEmpty: true });
	}

	function packetNames(responses: CrowniclesPacket[][]): string[] {
		return responses.flat().map(packet => packet.constructor.name);
	}

	/**
	 * The handlers run from the compiled `dist/` tree: their packets are instances of other classes than the ones
	 * of the sources, so they are matched by class name
	 */
	function packetsNamed<T extends CrowniclesPacket>(responses: CrowniclesPacket[][], name: string): T[] {
		return responses.flat().filter((packet): packet is T => packet.constructor.name === name);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("cityguildeconomy");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		guildDomain = loadProductionModule<GuildDomainModule>("core/report/ReportCityGuildDomainService");
		foodShop = loadProductionModule<FoodShopModule>("core/report/ReportCityFoodShopService");
		cityData = loadProductionModule<CityDataModule>("data/City");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const model of [PlayerMissionsInfo, Player, Guild, sequelize.models.MissionSlot]) {
				await (model as ModelStatic<PlayerType>).destroy({
					truncate: true, force: true
				});
			}
		}
		finally {
			await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	describe("domain notary", () => {
		it("relocates the domain for exactly the relocation cost", async () => {
			const {
				player, guildId
			} = await createChiefWithGuild({
				treasury: RICH_TREASURY, domainCityId: OTHER_CITY_ID
			});
			const response: CrowniclesPacket[] = [];

			await guildDomain.handleGuildDomainNotaryReaction(player, getCity(DOMAIN_CITY_ID), response);

			expect(response.map(packet => [packet.constructor.name, (packet as { cost?: number }).cost]))
				.toContainEqual(["CommandReportGuildDomainRelocateRes", GuildDomainConstants.DOMAIN_RELOCATION_COST]);
			const guild = await getGuild(guildId);
			expect(guild.domainCityId).toBe(DOMAIN_CITY_ID);
			expect(guild.treasury).toBe(RICH_TREASURY - GuildDomainConstants.DOMAIN_RELOCATION_COST);
		});

		it("refuses a relocation the treasury cannot pay, telling the missing amount", async () => {
			const {
				player, guildId
			} = await createChiefWithGuild({
				treasury: GuildDomainConstants.DOMAIN_RELOCATION_COST - 1, domainCityId: OTHER_CITY_ID
			});
			const response: CrowniclesPacket[] = [];

			await guildDomain.handleGuildDomainNotaryReaction(player, getCity(DOMAIN_CITY_ID), response);

			expect(response.map(packet => [packet.constructor.name, (packet as { missingTreasury?: number }).missingTreasury]))
				.toEqual([["CommandReportGuildDomainNotEnoughTreasuryRes", 1]]);
			const guild = await getGuild(guildId);
			expect([guild.domainCityId, guild.treasury]).toEqual([OTHER_CITY_ID, GuildDomainConstants.DOMAIN_RELOCATION_COST - 1]);
		});

		it("charges the domain purchase once when it is confirmed several times concurrently", async () => {
			const {
				player, guildId
			} = await createChiefWithGuild({
				treasury: RICH_TREASURY, domainCityId: null
			});

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await guildDomain.handleGuildDomainNotaryReaction(player, getCity(DOMAIN_CITY_ID), response);
				return response;
			}));

			const guild = await getGuild(guildId);
			expect(guild.domainCityId).toBe(DOMAIN_CITY_ID);
			expect(guild.treasury).toBe(RICH_TREASURY - GuildDomainConstants.DOMAIN_PURCHASE_COST);
			expect(packetNames(responses).filter(name => name === "CommandReportGuildDomainRelocateRes")).toEqual([]);
			expect(packetNames(responses).filter(name => name === "CommandReportCityOfferChangedRes")).toHaveLength(CONCURRENT_REQUESTS - 1);
		});
	});

	describe("domain building upgrade", () => {
		it("debits the reported cost and raises the building once per accepted upgrade, never below zero", async () => {
			const firstCost = GuildDomainConstants.getBuildingUpgradeCost(GuildBuilding.SHELTER, 0) ?? 0;
			const {
				guildId
			} = await createChiefWithGuild({
				treasury: firstCost, domainCityId: DOMAIN_CITY_ID, level: 150
			});

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await guildDomain.handleGuildDomainUpgrade(KEYCLOAK_ID, { building: GuildBuilding.SHELTER }, response);
				return response;
			}));

			const upgrades = packetsNamed<CommandReportGuildDomainUpgradeRes>(responses, "CommandReportGuildDomainUpgradeRes");
			expect(upgrades).toHaveLength(1);
			expect(upgrades[0]).toMatchObject({
				cost: firstCost, newTreasury: 0
			});
			const guild = await getGuild(guildId);
			expect([guild.shelterLevel, guild.treasury]).toEqual([1, 0]);
		});
	});

	describe("food shop", () => {
		it("never spends more than the treasury and debits exactly the reported total under concurrent purchases", async () => {
			const affordable = 3;
			const {
				guildId
			} = await createChiefWithGuild({
				treasury: ULTIMATE_FOOD_PRICE * affordable, shopLevel: 1, domainCityId: DOMAIN_CITY_ID
			});
			const packet = {
				foodType: ULTIMATE_FOOD, amount: 2
			} as CommandReportFoodShopBuyReq;

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await foodShop.handleFoodShopBuy(KEYCLOAK_ID, packet, response);
				return response;
			}));

			const purchases = packetsNamed<CommandReportFoodShopBuyRes>(responses, "CommandReportFoodShopBuyRes");
			const bought = purchases.reduce((sum, purchase) => sum + purchase.amountBought, 0);
			const reportedCost = purchases.reduce((sum, purchase) => sum + purchase.totalCost, 0);
			const guild = await getGuild(guildId);
			expect(bought).toBe(affordable);
			expect(reportedCost).toBe(ULTIMATE_FOOD_PRICE * affordable);
			expect(guild.treasury).toBe(0);
			expect(guild.getFoodAmount(ULTIMATE_FOOD)).toBe(affordable);
		});
	});
});
