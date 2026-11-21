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
			logApartmentPurchase: vi.fn().mockResolvedValue(undefined),
			logApartmentRentClaim: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Apartment", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Apartment")>(),
	Apartments: {
		getOfPlayer: vi.fn(), getOfPlayerInCity: vi.fn()
	}
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

import { UniqueConstraintError } from "sequelize";
import {
	handleApartmentBuyReaction, handleApartmentClaimRentReaction
} from "../../../src/core/report/ReportCityNotaryService";
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
import { crowniclesInstance } from "../../../src/app";
import {
	City, CityDataController
} from "../../../src/data/City";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import {
	asPlayer, CityHandlerPlayer, describePackets, lockedEntitiesOf, makeHandlerPlayer
} from "./CityHandlerFixture";

const HOME_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const APARTMENT_ID = 5;

const logs = crowniclesInstance?.logsDatabase;

function getCity(cityId: string): City {
	const city = CityDataController.instance.getById(cityId);
	if (!city) {
		throw new Error(`Unknown city ${cityId}`);
	}
	return city;
}

function makeHome(cityId: string): Home {
	return Object.assign(Object.create(Home.prototype) as Home, {
		id: 3, ownerId: 1, cityId, level: 1
	});
}

function makeApartment(cityId: string, rent: number, ownerId = 1): Apartment {
	return Object.assign(Object.create(Apartment.prototype) as Apartment, {
		id: APARTMENT_ID,
		ownerId,
		cityId,
		purchasePrice: 0,
		lastRentClaimedAt: new Date(Date.now() - rent / HomeConstants.DAILY_RENT * TimeConstants.MS_TIME.DAY - 1_000),
		save: vi.fn().mockResolvedValue(undefined)
	});
}

function lockRows(lockedPlayer: CityHandlerPlayer, apartment: Apartment | null = null): void {
	const resolve = lockedEntitiesOf([
		[Player, lockedPlayer.id, lockedPlayer],
		[PlayerMissionsInfo, lockedPlayer.id, { playerId: lockedPlayer.id }],
		[Apartment, APARTMENT_ID, apartment]
	]);
	vi.mocked(withLockedEntities).mockImplementation((keys, callback) => callback(resolve(keys) as never));
	vi.mocked(withLockedPlayerAndMissions).mockImplementation((_playerId, callback) => callback(asPlayer(lockedPlayer)));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(OTHER_CITY_ID));
	vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(null);
	vi.mocked(Apartments.getOfPlayer).mockResolvedValue([]);
});

describe("handleApartmentBuyReaction", () => {
	const city = getCity(HOME_CITY_ID);
	const price = city.apartmentPrice ?? 0;
	const mapLocationId = city.maps[0];

	it("sells nothing in a city without apartment", async () => {
		const player = makeHandlerPlayer(1_000_000);
		const response: CrowniclesPacket[] = [];
		const noApartmentCity = Object.assign(Object.create(City.prototype) as City, {
			...city, apartmentPrice: undefined
		});

		await handleApartmentBuyReaction(asPlayer(player), noApartmentCity, response);

		expect(response).toEqual([]);
		expect(Homes.getOfPlayer).not.toHaveBeenCalled();
	});

	it("requires a home and enough money before locking", async () => {
		const player = makeHandlerPlayer(price - 4);
		const homeless: CrowniclesPacket[] = [];
		const poor: CrowniclesPacket[] = [];
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);

		await handleApartmentBuyReaction(asPlayer(player), city, homeless);
		await handleApartmentBuyReaction(asPlayer(player), city, poor);

		expect(describePackets(homeless)).toEqual([["CommandReportApartmentRequiresHomeRes", {
			cityId: city.id, mapLocationId
		}]]);
		expect(describePackets(poor)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 4 }]]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("debits the price, records the apartment and updates the apartment missions", async () => {
		const player = makeHandlerPlayer(price);
		lockRows(player);
		const create = vi.spyOn(Apartment, "create").mockResolvedValue(makeApartment(city.id, 0));
		vi.mocked(Apartments.getOfPlayer).mockResolvedValue([makeApartment(city.id, 0), makeApartment(OTHER_CITY_ID, 0)]);
		const response: CrowniclesPacket[] = [];

		await handleApartmentBuyReaction(asPlayer(player), city, response);

		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: price, reason: NumberChangeReason.APARTMENT_BUY
		});
		expect(player.money).toBe(0);
		expect(player.save).toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith({
			ownerId: player.id, cityId: city.id, purchasePrice: price, lastRentClaimedAt: expect.any(Date)
		});
		expect(describePackets(response)).toEqual([["CommandReportApartmentBuyRes", {
			cityId: city.id, mapLocationId, cost: price
		}]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "buyApartment" });
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "buyApartments", count: 2, set: true
		});
		expect(logs?.logApartmentPurchase).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: city.id, price
		});
	});

	it("re-checks the locked rows: no second apartment in the city and no purchase with money spent meanwhile", async () => {
		const player = makeHandlerPlayer(price);
		const poorLockedPlayer = makeHandlerPlayer(price - 1);
		const create = vi.spyOn(Apartment, "create");
		lockRows(player);
		vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValueOnce(makeApartment(city.id, 0));
		const owned: CrowniclesPacket[] = [];
		await handleApartmentBuyReaction(asPlayer(player), city, owned);
		lockRows(poorLockedPlayer);
		const poor: CrowniclesPacket[] = [];
		await handleApartmentBuyReaction(asPlayer(player), city, poor);

		expect(describePackets(owned)).toEqual([["CommandReportApartmentAlreadyOwnedRes", {
			cityId: city.id, mapLocationId
		}]]);
		expect(describePackets(poor)).toEqual([["CommandReportNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(create).not.toHaveBeenCalled();
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(poorLockedPlayer.spendMoney).not.toHaveBeenCalled();
	});

	it("refunds the exact price, without blessing, when a concurrent purchase created the apartment first", async () => {
		const player = makeHandlerPlayer(price);
		lockRows(player);
		vi.spyOn(Apartment, "create").mockRejectedValue(new UniqueConstraintError({}));
		const response: CrowniclesPacket[] = [];

		await handleApartmentBuyReaction(asPlayer(player), city, response);

		expect(player.addMoney).toHaveBeenCalledWith({
			response, amount: price, reason: NumberChangeReason.APARTMENT_BUY, ignoreBlessing: true
		});
		expect(player.money).toBe(price);
		expect(player.save).toHaveBeenCalledTimes(2);
		expect(describePackets(response)).toEqual([["CommandReportApartmentAlreadyOwnedRes", {
			cityId: city.id, mapLocationId
		}]]);
		expect(MissionsController.update).not.toHaveBeenCalled();
		expect(logs?.logApartmentPurchase).not.toHaveBeenCalled();
	});

	it("lets any other database error through", async () => {
		const player = makeHandlerPlayer(price);
		lockRows(player);
		vi.spyOn(Apartment, "create").mockRejectedValue(new Error("database down"));

		await expect(handleApartmentBuyReaction(asPlayer(player), city, [])).rejects.toThrow("database down");
		expect(player.addMoney).not.toHaveBeenCalled();
	});
});

describe("handleApartmentClaimRentReaction", () => {
	const city = getCity(HOME_CITY_ID);

	async function claim(player: CityHandlerPlayer, apartment: Apartment): Promise<CrowniclesPacket[]> {
		lockRows(player, apartment);
		const response: CrowniclesPacket[] = [];
		await handleApartmentClaimRentReaction(asPlayer(player), APARTMENT_ID, response);
		return response;
	}

	it("credits the accumulated rent without blessing, restarts the rent clock and reports the credited amount", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(city.id));
		const player = makeHandlerPlayer(0);
		const apartment = makeApartment(city.id, 500);

		const response = await claim(player, apartment);

		expect(player.addMoney).toHaveBeenCalledWith({
			response, amount: 500, reason: NumberChangeReason.APARTMENT_RENT_CLAIM, ignoreBlessing: true
		});
		expect(player.money).toBe(500);
		expect(apartment.getAccumulatedRent()).toBe(0);
		expect(apartment.save).toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportApartmentClaimRentRes", {
			cityId: city.id, mapLocationId: city.maps[0], rentClaimed: 500
		}]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "collectRent" });
		expect(logs?.logApartmentRentClaim).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, apartmentId: APARTMENT_ID, cityId: city.id, rentClaimed: 500
		});
	});

	it("credits a rent of exactly the claim minimum", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(city.id));
		const player = makeHandlerPlayer(0);

		await claim(player, makeApartment(city.id, HomeConstants.MIN_RENT_TO_CLAIM));

		expect(player.money).toBe(HomeConstants.MIN_RENT_TO_CLAIM);
	});

	it("credits nothing below the claim minimum and tells the current rent", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(city.id));
		const player = makeHandlerPlayer(0);

		const response = await claim(player, makeApartment(city.id, HomeConstants.MIN_RENT_TO_CLAIM - 1));

		expect(describePackets(response)).toEqual([["CommandReportApartmentClaimRentTooLowRes", {
			cityId: city.id, mapLocationId: city.maps[0], currentRent: HomeConstants.MIN_RENT_TO_CLAIM - 1, minRequired: HomeConstants.MIN_RENT_TO_CLAIM
		}]]);
		expect(player.addMoney).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("credits nothing for an apartment that is not rented out, whatever its accrued rent", async () => {
		const player = makeHandlerPlayer(0);

		const response = await claim(player, makeApartment(city.id, 5_000));

		expect(describePackets(response)).toEqual([["CommandReportApartmentClaimRentTooLowRes", {
			cityId: city.id, mapLocationId: city.maps[0], currentRent: 0, minRequired: HomeConstants.MIN_RENT_TO_CLAIM
		}]]);
		expect(player.addMoney).not.toHaveBeenCalled();
	});

	it("credits nothing on the apartment of another player", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome(city.id));
		const player = makeHandlerPlayer(0);

		const response = await claim(player, makeApartment(city.id, 5_000, player.id + 1));

		expect(response).toEqual([]);
		expect(player.addMoney).not.toHaveBeenCalled();
	});

	it("still credits the rent of an apartment whose city disappeared, without reply", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome("unknown_city"));
		const player = makeHandlerPlayer(0);

		const lowResponse = await claim(player, makeApartment("unknown_city", HomeConstants.MIN_RENT_TO_CLAIM - 1));
		const response = await claim(player, makeApartment("unknown_city", 500));

		expect(lowResponse).toEqual([]);
		expect(response).toEqual([]);
		expect(player.money).toBe(500);
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});
