import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { Apartment as ApartmentType } from "../../src/core/database/game/models/Apartment";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { City as CityType } from "../../src/data/City";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CommandReportApartmentBuyRes,
	CommandReportApartmentClaimRentRes,
	CommandReportBuyHomeRes,
	CommandReportMoveHomeRes,
	CommandReportUpgradeHomeRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";

type CityServiceModule = typeof import("../../src/core/report/ReportCityService");
type NotaryServiceModule = typeof import("../../src/core/report/ReportCityNotaryService");
type CityDataModule = typeof import("../../src/data/City");
type HomeLevelModule = typeof import("../../../Lib/src/types/HomeLevel");

const KEYCLOAK_ID = "city-home-management";
const CONCURRENT_REQUESTS = 5;
const HOME_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const HIGH_PLAYER_LEVEL = 200;
const RICH_PLAYER_MONEY = 10_000_000;
const RENT_DAYS = 3;

/**
 * Economic invariants of the city home and apartment services (review checklist section 11):
 * the price shown by the menu is the amount debited, a reward is credited once and as reported,
 * and a confirmation sent several times in a row (button mashing) is applied exactly once.
 */
describe("City home management economy", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let Apartment: ModelStatic<ApartmentType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let cityService: CityServiceModule;
	let notaryService: NotaryServiceModule;
	let cityData: CityDataModule;

	// The handlers compare home levels by identity: they must come from the same compiled module
	let HomeLevel: HomeLevelModule["HomeLevel"];

	function getCity(cityId: string): CityType {
		const city = cityData.CityDataController.instance.getById(cityId);
		if (!city) {
			throw new Error(`Unknown city ${cityId}`);
		}
		return city;
	}

	async function createPlayer(money: number): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			money,
			level: HIGH_PLAYER_LEVEL
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		return player;
	}

	async function createHome(playerId: number, cityId: string, level: number): Promise<HomeType> {
		return await Home.create({
			ownerId: playerId,
			cityId,
			level
		});
	}

	/**
	 * City data exactly as the menu builds it when the player opens it in the given city
	 */
	async function openCityMenu(player: PlayerType, city: CityType): Promise<ReactionCollectorCityData> {
		const home = await Home.findOne({ where: { ownerId: player.id } });
		const homeLevel = home ? HomeLevel.getByLevel(home.level) : null;
		const homeData = await cityService.buildHomeData({
			player, inventory: [], materialMap: new Map()
		}, {
			home, homeLevel
		}, city);

		// The home handlers only read the home part of the city data
		return { home: homeData } as unknown as ReactionCollectorCityData;
	}

	async function getMoney(playerId: number): Promise<number> {
		return (await Player.findByPk(playerId, { rejectOnEmpty: true })).money;
	}

	/**
	 * The handlers run from the compiled `dist/` tree: their packets are instances of other classes than the ones
	 * imported here, so they are matched by class name
	 */
	function packetsOf<T extends CrowniclesPacket>(responses: CrowniclesPacket[][], packetClass: new () => T): T[] {
		return responses.flat().filter((packet): packet is T => packet.constructor.name === packetClass.name);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("cityhomemanagement");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		Apartment = models.Apartment as ModelStatic<ApartmentType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		cityService = loadProductionModule<CityServiceModule>("core/report/ReportCityService");
		notaryService = loadProductionModule<NotaryServiceModule>("core/report/ReportCityNotaryService");
		cityData = loadProductionModule<CityDataModule>("data/City");
		HomeLevel = loadProductionModule<HomeLevelModule>("../../Lib/src/types/HomeLevel").HomeLevel;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const model of [Apartment, Home, PlayerMissionsInfo, Player, sequelize.models.MissionSlot]) {
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

	describe("buy home", () => {
		it("debits exactly the price shown by the menu and creates the initial home in the city", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.newPrice;
			expect(shownPrice).toBe(city.getHomeLevelPrice(HomeLevel.getInitialLevel()));

			const response: CrowniclesPacket[] = [];
			await cityService.handleBuyHomeReaction(player, city, data, response);

			expect(packetsOf([response], CommandReportBuyHomeRes).map(packet => packet.cost)).toEqual([shownPrice]);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - (shownPrice ?? 0));
			const homes = await Home.findAll({ where: { ownerId: player.id } });
			expect(homes.map(home => [home.cityId, home.level])).toEqual([[city.id, HomeLevel.getInitialLevel().level]]);
		});

		it("refuses without debiting when the player spent the money since the menu was opened", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.newPrice ?? 0;
			await Player.update({ money: shownPrice - 1 }, { where: { id: player.id } });
			await player.reload();

			const response: CrowniclesPacket[] = [];
			await cityService.handleBuyHomeReaction(player, city, data, response);

			expect(response.map(packet => packet.constructor.name)).toEqual(["CommandReportNotEnoughMoneyRes"]);
			expect(await getMoney(player.id)).toBe(shownPrice - 1);
			expect(await Home.count({ where: { ownerId: player.id } })).toBe(0);
		});

		// Bug: runBuyHomeUnderLock (ReportCityHomeService.ts) never re-checks under the lock that the player still has no home: every queued confirmation debits the price again
		it.fails("debits the home price once when the purchase is confirmed several times concurrently", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.newPrice ?? 0;

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await cityService.handleBuyHomeReaction(player, city, data, response);
				return response;
			}));

			expect(await Home.count({ where: { ownerId: player.id } })).toBe(1);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - shownPrice);
			expect(packetsOf(responses, CommandReportBuyHomeRes)).toHaveLength(1);
		});

		// Bug: a buy-home menu opened before the home was bought resets the existing home to level 1 in the new city through Homes.createOrUpdateHome (ReportCityHomeService.ts runBuyHomeUnderLock)
		it.fails("does not overwrite a home bought or upgraded since the buy menu was opened", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			const staleData = await openCityMenu(player, city);
			const upgradedLevel = HomeLevel.getInitialLevel().level + 2;
			await createHome(player.id, OTHER_CITY_ID, upgradedLevel);

			await cityService.handleBuyHomeReaction(player, city, staleData, []);

			const homes = await Home.findAll({ where: { ownerId: player.id } });
			expect(homes.map(home => [home.cityId, home.level])).toEqual([[OTHER_CITY_ID, upgradedLevel]]);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY);
		});
	});

	describe("upgrade home", () => {
		it("raises the home by one level and debits the upgrade price shown by the menu", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, city.id, 1);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.upgrade?.price;
			expect(shownPrice).toBe(city.getHomeLevelPrice(HomeLevel.LEVEL_2));

			const response: CrowniclesPacket[] = [];
			await cityService.handleUpgradeHomeReaction(player, city, data, response);

			expect(packetsOf([response], CommandReportUpgradeHomeRes).map(packet => packet.cost)).toEqual([shownPrice]);
			expect((await Home.findOne({ where: { ownerId: player.id } }))?.level).toBe(2);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - (shownPrice ?? 0));
		});

		it("refuses without upgrading when the player can no longer pay", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, city.id, 1);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.upgrade?.price ?? 0;
			await Player.update({ money: shownPrice - 1 }, { where: { id: player.id } });

			const response: CrowniclesPacket[] = [];
			await cityService.handleUpgradeHomeReaction(player, city, data, response);

			expect(response.map(packet => packet.constructor.name)).toEqual(["CommandReportNotEnoughMoneyRes"]);
			expect((await Home.findOne({ where: { ownerId: player.id } }))?.level).toBe(1);
			expect(await getMoney(player.id)).toBe(shownPrice - 1);
		});

		// Bug: runUpgradeHomeUnderLock (ReportCityHomeService.ts) recomputes the next level from the locked home but charges the price listed for the level the menu showed: each queued confirmation buys one more level at the level-2 price
		it.fails("upgrades the home exactly once when the upgrade is confirmed several times concurrently", async () => {
			const city = getCity(HOME_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, city.id, 1);
			const data = await openCityMenu(player, city);
			const shownPrice = data.home.manage?.upgrade?.price ?? 0;

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await cityService.handleUpgradeHomeReaction(player, city, data, response);
				return response;
			}));

			expect((await Home.findOne({ where: { ownerId: player.id } }))?.level).toBe(2);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - shownPrice);
			expect(packetsOf(responses, CommandReportUpgradeHomeRes)).toHaveLength(1);
		});
	});

	describe("move home", () => {
		it("deducts the accumulated rent of the apartment left behind from the move price, and reports the debited amount", async () => {
			const destination = getCity(OTHER_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, HOME_CITY_ID, 1);
			const sourceApartment = await Apartment.create({
				ownerId: player.id,
				cityId: HOME_CITY_ID,
				purchasePrice: 0,
				lastRentClaimedAt: new Date(Date.now() - RENT_DAYS * 24 * 3_600_000)
			});
			const accumulatedRent = sourceApartment.getAccumulatedRent();
			expect(accumulatedRent).toBeGreaterThanOrEqual(HomeConstants.MIN_RENT_TO_CLAIM);
			const data = await openCityMenu(player, destination);
			const movePrice = data.home.manage?.movePrice ?? 0;
			expect(movePrice).toBeGreaterThan(accumulatedRent);

			const response: CrowniclesPacket[] = [];
			await cityService.handleMoveHomeReaction(player, destination, data, response);

			const [moved] = packetsOf([response], CommandReportMoveHomeRes);
			expect(moved.rentDeducted).toBe(accumulatedRent);
			expect(moved.cost).toBe(movePrice - accumulatedRent);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - moved.cost);
			expect((await Home.findOne({ where: { ownerId: player.id } }))?.cityId).toBe(destination.id);

			// The rent used as a discount cannot be claimed a second time
			await sourceApartment.reload();
			expect(sourceApartment.getAccumulatedRent()).toBe(0);
		});

		it("moves the home and debits the move price once when the move is confirmed several times concurrently", async () => {
			const destination = getCity(OTHER_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, HOME_CITY_ID, 1);
			const data = await openCityMenu(player, destination);
			const movePrice = data.home.manage?.movePrice ?? 0;

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await cityService.handleMoveHomeReaction(player, destination, data, response);
				return response;
			}));

			expect(packetsOf(responses, CommandReportMoveHomeRes)).toHaveLength(1);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - movePrice);
		});
	});

	describe("apartments", () => {
		it("buys one apartment and debits its price once under concurrent confirmations", async () => {
			const city = getCity(OTHER_CITY_ID);
			const player = await createPlayer(RICH_PLAYER_MONEY);
			await createHome(player.id, HOME_CITY_ID, 1);
			const price = city.apartmentPrice ?? 0;
			expect(price).toBeGreaterThan(0);

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await notaryService.handleApartmentBuyReaction(player, city, response);
				return response;
			}));

			expect(packetsOf(responses, CommandReportApartmentBuyRes).map(packet => packet.cost)).toEqual([price]);
			expect(await Apartment.count({ where: { ownerId: player.id } })).toBe(1);
			expect(await getMoney(player.id)).toBe(RICH_PLAYER_MONEY - price);
		});

		it("credits the accumulated rent exactly once and as reported under concurrent claims", async () => {
			const player = await createPlayer(0);
			await createHome(player.id, HOME_CITY_ID, 1);
			const apartment = await Apartment.create({
				ownerId: player.id,
				cityId: HOME_CITY_ID,
				purchasePrice: 0,
				lastRentClaimedAt: new Date(Date.now() - RENT_DAYS * 24 * 3_600_000)
			});

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, async () => {
				const response: CrowniclesPacket[] = [];
				await notaryService.handleApartmentClaimRentReaction(player, apartment.id, response);
				return response;
			}));

			const claims = packetsOf(responses, CommandReportApartmentClaimRentRes);
			expect(claims).toHaveLength(1);
			expect(claims[0].rentClaimed).toBeGreaterThanOrEqual(HomeConstants.DAILY_RENT * RENT_DAYS - 1);
			expect(await getMoney(player.id)).toBe(claims[0].rentClaimed);
		});

		it("credits no rent for an apartment that is not rented out", async () => {
			const player = await createPlayer(0);
			await createHome(player.id, HOME_CITY_ID, 1);
			const apartment = await Apartment.create({
				ownerId: player.id,
				cityId: OTHER_CITY_ID,
				purchasePrice: 0,
				lastRentClaimedAt: new Date(Date.now() - RENT_DAYS * 24 * 3_600_000)
			});

			const response: CrowniclesPacket[] = [];
			await notaryService.handleApartmentClaimRentReaction(player, apartment.id, response);

			expect(response.map(packet => packet.constructor.name)).toEqual(["CommandReportApartmentClaimRentTooLowRes"]);
			expect(await getMoney(player.id)).toBe(0);
		});
	});
});
