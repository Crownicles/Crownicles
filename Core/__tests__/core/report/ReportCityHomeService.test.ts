import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logHomePurchase: vi.fn().mockResolvedValue(undefined),
			logHomeUpgrade: vi.fn().mockResolvedValue(undefined),
			logHomeMove: vi.fn().mockResolvedValue(undefined),
			logHomeBedUse: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Apartment", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Apartment")>(),
	Apartments: { getOfPlayerInCity: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/PlayerMissionsInfo")>(),
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));
vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock("../../../src/core/bot/GardenNotifications", () => ({
	rescheduleGardenNotificationsUnderLock: vi.fn().mockResolvedValue(undefined)
}));

import {
	handleBuyHomeReaction, handleHomeBedReaction, handleMoveHomeReaction, handleUpgradeHomeReaction
} from "../../../src/core/report/ReportCityHomeService";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import {
	Apartment, Apartments
} from "../../../src/core/database/game/models/Apartment";
import PlayerMissionsInfo from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { Player } from "../../../src/core/database/game/models/Player";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { rescheduleGardenNotificationsUnderLock } from "../../../src/core/bot/GardenNotifications";
import { crowniclesInstance } from "../../../src/app";
import {
	City, CityDataController
} from "../../../src/data/City";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import {
	asPlayer, CityHandlerPlayer, describePackets, lockedEntitiesOf, makeHandlerPlayer
} from "./CityHandlerFixture";

const HOME_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const HOME_ID = 3;
const SOURCE_APARTMENT_ID = 5;
const DESTINATION_APARTMENT_ID = 6;
const MISSIONS_INFO = { playerId: 1 };

const logs = crowniclesInstance?.logsDatabase;

function getCity(cityId: string): City {
	const city = CityDataController.instance.getById(cityId);
	if (!city) {
		throw new Error(`Unknown city ${cityId}`);
	}
	return city;
}

function makeHome(cityId: string, level: number): Home {
	return Object.assign(Object.create(Home.prototype) as Home, {
		id: HOME_ID, ownerId: 1, cityId, level, save: vi.fn().mockResolvedValue(undefined)
	});
}

function makeApartment(id: number, cityId: string, rent: number): Apartment {
	return Object.assign(Object.create(Apartment.prototype) as Apartment, {
		id,
		ownerId: 1,
		cityId,
		purchasePrice: 0,
		lastRentClaimedAt: new Date(Date.now() - rent / HomeConstants.DAILY_RENT * TimeConstants.MS_TIME.DAY - 1_000),
		save: vi.fn().mockResolvedValue(undefined)
	});
}

function manageData(manage: ReactionCollectorCityData["home"]["manage"]): ReactionCollectorCityData {
	// The home handlers only read the home part of the city data
	return { home: { manage } } as ReactionCollectorCityData;
}

/**
 * Locks resolve to the given rows, the player row being the one passed (it may differ from the snapshot the handler started from)
 */
function lockRows(lockedPlayer: CityHandlerPlayer, rows: [typeof Home | typeof Apartment, number, unknown][] = []): void {
	const resolve = lockedEntitiesOf([
		[Player, lockedPlayer.id, lockedPlayer],
		[PlayerMissionsInfo, lockedPlayer.id, MISSIONS_INFO],
		...rows
	]);
	vi.mocked(withLockedEntities).mockImplementation((keys, callback) => callback(resolve(keys) as never));
	vi.mocked(withLockedPlayerAndMissions).mockImplementation((_playerId, callback) => callback(asPlayer(lockedPlayer)));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(null);
	vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);
	vi.spyOn(Home, "create").mockResolvedValue({} as Home);
});

describe("handleBuyHomeReaction", () => {
	const city = getCity(HOME_CITY_ID);
	const price = 950;

	it("does nothing when the menu offered no home to buy", async () => {
		const player = makeHandlerPlayer(10_000);
		const response: CrowniclesPacket[] = [];

		await handleBuyHomeReaction(asPlayer(player), city, manageData({ currentMoney: 0 }), response);

		expect(response).toEqual([]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("tells how much is missing without locking when the player cannot pay", async () => {
		const player = makeHandlerPlayer(price - 7);
		const response: CrowniclesPacket[] = [];

		await handleBuyHomeReaction(asPlayer(player), city, manageData({
			newPrice: price, currentMoney: 0
		}), response);

		expect(describePackets(response)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 7 }]]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("re-checks the money of the locked player and buys nothing when it was spent meanwhile", async () => {
		const player = makeHandlerPlayer(price);
		const lockedPlayer = makeHandlerPlayer(price - 1);
		lockRows(lockedPlayer);
		const response: CrowniclesPacket[] = [];

		await handleBuyHomeReaction(asPlayer(player), city, manageData({
			newPrice: price, currentMoney: 0
		}), response);

		expect(describePackets(response)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
		expect(Home.create).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
		expect(logs?.logHomePurchase).not.toHaveBeenCalled();
	});

	it("debits the listed price, creates the initial home and completes the buy-home mission", async () => {
		const player = makeHandlerPlayer(price);
		lockRows(player);
		const response: CrowniclesPacket[] = [];

		await handleBuyHomeReaction(asPlayer(player), city, manageData({
			newPrice: price, currentMoney: 0
		}), response);

		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: price, reason: NumberChangeReason.BUY_HOME
		});
		expect(player.money).toBe(0);
		expect(player.save).toHaveBeenCalled();
		expect(Home.create).toHaveBeenCalledWith({
			ownerId: player.id, cityId: city.id, level: HomeLevel.getInitialLevel().level
		});
		expect(describePackets(response)).toEqual([["CommandReportBuyHomeRes", { cost: price }]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "buyHome" });
		expect(logs?.logHomePurchase).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: city.id, price
		});
	});

	it("buys nothing and tells the offer changed when the locked player already owns a home", async () => {
		const player = makeHandlerPlayer(price);
		const home = makeHome(OTHER_CITY_ID, 3);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		lockRows(player);
		const response: CrowniclesPacket[] = [];

		await handleBuyHomeReaction(asPlayer(player), city, manageData({
			newPrice: price, currentMoney: 0
		}), response);

		expect(describePackets(response)).toEqual([["CommandReportCityOfferChangedRes", {}]]);
		expect([home.cityId, home.level]).toEqual([OTHER_CITY_ID, 3]);
		expect(home.save).not.toHaveBeenCalled();
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(Home.create).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
		expect(logs?.logHomePurchase).not.toHaveBeenCalled();
	});

	it("restarts the rent clock of the apartment the player owned in the city, which becomes rented", async () => {
		const player = makeHandlerPlayer(price);
		const apartment = makeApartment(SOURCE_APARTMENT_ID, city.id, 500);
		vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(apartment);
		lockRows(player, [[Apartment, SOURCE_APARTMENT_ID, apartment]]);

		await handleBuyHomeReaction(asPlayer(player), city, manageData({
			newPrice: price, currentMoney: 0
		}), []);

		expect(apartment.getAccumulatedRent()).toBe(0);
		expect(apartment.save).toHaveBeenCalled();
	});
});

describe("handleUpgradeHomeReaction", () => {
	const city = getCity(HOME_CITY_ID);
	const price = 3325;
	const upgrade = {
		price, oldFeatures: HomeLevel.LEVEL_1.features, newFeatures: HomeLevel.LEVEL_2.features
	};

	it("does nothing when the menu offered no upgrade", async () => {
		const player = makeHandlerPlayer(10_000);
		const response: CrowniclesPacket[] = [];

		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({ currentMoney: 0 }), response);

		expect(response).toEqual([]);
		expect(Homes.getOfPlayer).not.toHaveBeenCalled();
	});

	it("tells how much is missing when the player cannot pay", async () => {
		const player = makeHandlerPlayer(price - 3);
		const response: CrowniclesPacket[] = [];

		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), response);

		expect(describePackets(response)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 3 }]]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("upgrades nothing when the player has no home in the city", async () => {
		const player = makeHandlerPlayer(price, 100);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(OTHER_CITY_ID, 1));

		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), []);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);
		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), []);

		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("raises the locked home by one level, debits the listed price and reschedules the garden", async () => {
		const player = makeHandlerPlayer(price, 100);
		const home = makeHome(city.id, 1);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		lockRows(player, [[Home, HOME_ID, home]]);
		const response: CrowniclesPacket[] = [];

		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), response);

		expect(home.level).toBe(2);
		expect(home.save).toHaveBeenCalled();
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: price, reason: NumberChangeReason.UPGRADE_HOME
		});
		expect(player.money).toBe(0);
		expect(player.save).toHaveBeenCalled();
		expect(rescheduleGardenNotificationsUnderLock).toHaveBeenCalledWith(player, home);
		expect(describePackets(response)).toEqual([["CommandReportUpgradeHomeRes", { cost: price }]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "upgradeHomeLevel", params: { homeLevel: 2 }
		});
		expect(logs?.logHomeUpgrade).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: city.id, fromLevel: 1, toLevel: 2, price
		});
	});

	it("re-checks the locked rows: no upgrade when the money was spent or the home moved meanwhile", async () => {
		const player = makeHandlerPlayer(price, 100);
		const home = makeHome(city.id, 1);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		const poorLockedPlayer = makeHandlerPlayer(price - 1, 100);
		lockRows(poorLockedPlayer, [[Home, HOME_ID, home]]);
		const poorResponse: CrowniclesPacket[] = [];

		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), poorResponse);
		const movedHome = makeHome(OTHER_CITY_ID, 1);
		lockRows(player, [[Home, HOME_ID, movedHome]]);
		const movedResponse: CrowniclesPacket[] = [];
		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), movedResponse);

		expect(describePackets(poorResponse)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(movedResponse).toEqual([]);
		expect([home.level, movedHome.level]).toEqual([1, 1]);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(poorLockedPlayer.spendMoney).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});

describe("handleUpgradeHomeReaction with an outdated offer", () => {
	const city = getCity(HOME_CITY_ID);
	const upgrade = {
		price: city.getHomeLevelPrice(HomeLevel.LEVEL_2), oldFeatures: HomeLevel.LEVEL_1.features, newFeatures: HomeLevel.LEVEL_2.features
	};

	async function upgradeLockedHome(lockedHome: Home, lockedPlayer: CityHandlerPlayer): Promise<CrowniclesPacket[]> {
		const player = makeHandlerPlayer(upgrade.price * 10, 100);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(city.id, 1));
		lockRows(lockedPlayer, [[Home, HOME_ID, lockedHome]]);
		const response: CrowniclesPacket[] = [];
		await handleUpgradeHomeReaction(asPlayer(player), city, manageData({
			upgrade, currentMoney: 0
		}), response);
		return response;
	}

	it("does not buy the next level at the displayed price when the home was upgraded since the menu was opened", async () => {
		const lockedPlayer = makeHandlerPlayer(upgrade.price * 10, 100);
		const upgradedHome = makeHome(city.id, 2);

		const response = await upgradeLockedHome(upgradedHome, lockedPlayer);

		expect(describePackets(response)).toEqual([["CommandReportCityOfferChangedRes", {}]]);
		expect(upgradedHome.level).toBe(2);
		expect(upgradedHome.save).not.toHaveBeenCalled();
		expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
		expect(logs?.logHomeUpgrade).not.toHaveBeenCalled();
	});

	it("does not upgrade when the locked player no longer reaches the level required by the displayed upgrade", async () => {
		const lockedPlayer = makeHandlerPlayer(upgrade.price * 10, HomeLevel.LEVEL_2.requiredPlayerLevel - 1);
		const home = makeHome(city.id, 1);

		const response = await upgradeLockedHome(home, lockedPlayer);

		expect(describePackets(response)).toEqual([["CommandReportCityOfferChangedRes", {}]]);
		expect(home.level).toBe(1);
		expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
	});
});

describe("handleMoveHomeReaction", () => {
	const destination = getCity(OTHER_CITY_ID);
	const movePrice = HomeConstants.MOVE_HOME_PRICE_DEFAULT;

	function prepareMove(player: CityHandlerPlayer, sourceRent: number | null, destinationApartment: Apartment | null = null): {
		home: Home; sourceApartment: Apartment | null;
	} {
		const home = makeHome(HOME_CITY_ID, 1);
		const sourceApartment = sourceRent === null ? null : makeApartment(SOURCE_APARTMENT_ID, HOME_CITY_ID, sourceRent);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		vi.mocked(Apartments.getOfPlayerInCity).mockImplementation(async (_playerId, cityId) => await Promise.resolve(cityId === HOME_CITY_ID ? sourceApartment : destinationApartment));
		lockRows(player, [
			[Home, HOME_ID, home],
			[Apartment, SOURCE_APARTMENT_ID, sourceApartment],
			[Apartment, DESTINATION_APARTMENT_ID, destinationApartment]
		]);
		return {
			home, sourceApartment
		};
	}

	async function move(player: CityHandlerPlayer): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleMoveHomeReaction(asPlayer(player), destination, manageData({
			movePrice, currentMoney: 0
		}), response);
		return response;
	}

	it("does nothing without move price or without home", async () => {
		const player = makeHandlerPlayer(movePrice);
		const response: CrowniclesPacket[] = [];
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(HOME_CITY_ID, 1));

		await handleMoveHomeReaction(asPlayer(player), destination, manageData({ currentMoney: 0 }), response);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);
		await handleMoveHomeReaction(asPlayer(player), destination, manageData({
			movePrice, currentMoney: 0
		}), response);

		expect(response).toEqual([]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("moves the home for the full price when no apartment is left behind", async () => {
		const player = makeHandlerPlayer(movePrice);
		const { home } = prepareMove(player, null);

		const response = await move(player);

		expect(home.cityId).toBe(destination.id);
		expect(home.save).toHaveBeenCalled();
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: movePrice, reason: NumberChangeReason.MOVE_HOME
		});
		expect(player.money).toBe(0);
		expect(describePackets(response)).toEqual([["CommandReportMoveHomeRes", { cost: movePrice }]]);
		expect(logs?.logHomeMove).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, fromCityId: HOME_CITY_ID, toCityId: destination.id, basePrice: movePrice, rentApplied: 0, effectivePrice: movePrice
		});
	});

	it("deducts the rent of the apartment left behind from the price and restarts its rent clock", async () => {
		const rent = HomeConstants.MIN_RENT_TO_CLAIM;
		const player = makeHandlerPlayer(movePrice - rent);
		const { sourceApartment } = prepareMove(player, rent);

		const response = await move(player);

		expect(describePackets(response)).toEqual([["CommandReportMoveHomeRes", {
			cost: movePrice - rent, rentDeducted: rent
		}]]);
		expect(player.money).toBe(0);
		expect(sourceApartment?.getAccumulatedRent()).toBe(0);
		expect(sourceApartment?.save).toHaveBeenCalled();
	});

	it("forfeits a rent below the claim minimum", async () => {
		const player = makeHandlerPlayer(movePrice);
		prepareMove(player, HomeConstants.MIN_RENT_TO_CLAIM - 1);

		const response = await move(player);

		expect(describePackets(response)).toEqual([["CommandReportMoveHomeRes", { cost: movePrice }]]);
	});

	it("caps the deducted rent at the move price, making the move free", async () => {
		const player = makeHandlerPlayer(0);
		prepareMove(player, movePrice * 2);

		const response = await move(player);

		expect(describePackets(response)).toEqual([["CommandReportMoveHomeRes", {
			cost: 0, rentDeducted: movePrice
		}]]);
		expect(player.money).toBe(0);
	});

	it("restarts the rent clock of the destination apartment, which becomes rented", async () => {
		const player = makeHandlerPlayer(movePrice);
		const destinationApartment = makeApartment(DESTINATION_APARTMENT_ID, destination.id, 1_000);
		prepareMove(player, null, destinationApartment);

		await move(player);

		expect(destinationApartment.getAccumulatedRent()).toBe(0);
		expect(destinationApartment.save).toHaveBeenCalled();
	});

	it("moves nothing when the player cannot pay the price left after the rent", async () => {
		const rent = HomeConstants.MIN_RENT_TO_CLAIM;
		const player = makeHandlerPlayer(movePrice - rent - 1);
		const { home } = prepareMove(player, rent);

		const response = await move(player);

		expect(describePackets(response)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(home.cityId).toBe(HOME_CITY_ID);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(logs?.logHomeMove).not.toHaveBeenCalled();
	});

	it("moves nothing when the locked home is no longer in the city the move started from", async () => {
		const player = makeHandlerPlayer(movePrice);
		const { home } = prepareMove(player, null);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(destination.id, 1));

		const response = await move(player);

		expect(response).toEqual([]);
		expect(home.cityId).toBe(HOME_CITY_ID);
		expect(player.spendMoney).not.toHaveBeenCalled();
	});
});

describe("handleHomeBedReaction", () => {
	const bedData = {
		home: { owned: { features: HomeLevel.LEVEL_3.features } }
	} as ReactionCollectorCityData;
	const regeneration = HomeLevel.LEVEL_3.features.bedHealthRegeneration;

	it("does nothing for a player without home", async () => {
		const player = makeHandlerPlayer(0);
		const response: CrowniclesPacket[] = [];

		await handleHomeBedReaction(asPlayer(player), { home: {} } as ReactionCollectorCityData, response);

		expect(response).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("heals the player by the bed regeneration, starts the cooldown and updates the bed mission", async () => {
		const player = makeHandlerPlayer(0);
		lockRows(player);
		const response: CrowniclesPacket[] = [];

		await handleHomeBedReaction(asPlayer(player), bedData, response);

		expect(player.addHealth).toHaveBeenCalledWith({
			amount: regeneration, response, reason: NumberChangeReason.HOME_BED
		});
		expect(player.lastBedUsedAt).toBeInstanceOf(Date);
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportHomeBedRes", { health: regeneration }]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "healInBed" });
		expect(logs?.logHomeBedUse).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: "boug_coton", healthGained: regeneration, healthBefore: 10
		});
	});

	it("does not log the bed use outside of a city", async () => {
		const player = makeHandlerPlayer(0);
		player.getCurrentCityId.mockReturnValue(null);
		lockRows(player);

		await handleHomeBedReaction(asPlayer(player), bedData, []);

		expect(player.addHealth).toHaveBeenCalled();
		expect(MissionsController.update).toHaveBeenCalled();
		expect(logs?.logHomeBedUse).not.toHaveBeenCalled();
	});

	it("refuses a player with full health", async () => {
		const player = makeHandlerPlayer(0);
		player.health = player.maxHealth;
		lockRows(player);
		const response: CrowniclesPacket[] = [];

		await handleHomeBedReaction(asPlayer(player), bedData, response);

		expect(describePackets(response)).toEqual([["CommandReportHomeBedAlreadyFullRes", {}]]);
		expect(player.addHealth).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("refuses during the cooldown and tells when the bed is available again, and accepts once it is over", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
		const player = makeHandlerPlayer(0);
		const lastUse = Date.now() - HomeConstants.BED_COOLDOWN_MS + 1;
		player.lastBedUsedAt = new Date(lastUse);
		lockRows(player);
		const response: CrowniclesPacket[] = [];

		await handleHomeBedReaction(asPlayer(player), bedData, response);
		player.lastBedUsedAt = new Date(Date.now() - HomeConstants.BED_COOLDOWN_MS);
		await handleHomeBedReaction(asPlayer(player), bedData, response);
		vi.useRealTimers();

		expect(describePackets(response).map(([name]) => name)).toEqual(["CommandReportBedCooldownRes", "CommandReportHomeBedRes"]);
		expect(response[0]).toMatchObject({ nextAvailableAt: lastUse + HomeConstants.BED_COOLDOWN_MS });
		expect(player.addHealth).toHaveBeenCalledTimes(1);
	});
});
