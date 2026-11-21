import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logGuildFoodShopBuy: vi.fn().mockResolvedValue(undefined),
			logGuildsFoodChanges: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/database/game/models/Player", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Player")>(),
	Players: { getByKeycloakId: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Guild", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Guild")>(),
	Guilds: { getById: vi.fn() }
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

import { handleFoodShopBuy } from "../../../src/core/report/ReportCityFoodShopService";
import { Players } from "../../../src/core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../../src/core/database/game/models/Guild";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { crowniclesInstance } from "../../../src/app";
import {
	PetConstants, PetFood
} from "../../../../Lib/src/constants/PetConstants";
import {
	GUILD_DOMAIN_ERROR, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asPlayer, describePackets, makeHandlerGuild, makeHandlerPlayer
} from "./CityHandlerFixture";

const KEYCLOAK_ID = "food-buyer";
const ULTIMATE = PetConstants.PET_FOOD.ULTIMATE_FOOD;
const COMMON = PetConstants.PET_FOOD.COMMON_FOOD;
const ULTIMATE_PRICE = GuildDomainConstants.SHOP_PRICES.FOOD[3];
const COMMON_PRICE = GuildDomainConstants.SHOP_PRICES.FOOD[0];

// A pantry of level 0 stores 150 common foods and 30 ultimate foods
const ULTIMATE_CAPACITY = 30;

const logs = crowniclesInstance?.logsDatabase;

type HandlerGuild = ReturnType<typeof makeHandlerGuild>;

const buyer = Object.assign(makeHandlerPlayer(0), { guildId: 7 });

function setupGuild(treasury: number, food: Record<string, number> = {}): HandlerGuild {
	const guild = Object.assign(makeHandlerGuild({
		treasury, domainCityId: "boug_coton"
	}, food), { shopLevel: 1 });
	vi.mocked(Guilds.getById).mockResolvedValue(guild);
	vi.spyOn(Guild, "withLocked").mockImplementation((_id, callback) => callback(guild));
	return guild;
}

async function buy(foodType: string, amount: number): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await handleFoodShopBuy(KEYCLOAK_ID, {
		foodType: foodType as PetFood, amount
	}, response);
	return response;
}

function errorOf(response: CrowniclesPacket[]): unknown {
	expect(describePackets(response).map(([name]) => name)).toEqual(["CommandReportFoodShopBuyErrorRes"]);
	return (response[0] as { error?: string }).error;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Players.getByKeycloakId).mockResolvedValue(asPlayer(buyer));
});

describe("handleFoodShopBuy", () => {
	it("debits the unit price times the amount, stores the food and reports the new stock and treasury", async () => {
		const guild = setupGuild(ULTIMATE_PRICE * 2 + 1, { [ULTIMATE]: 4 });

		const response = await buy(ULTIMATE, 2);

		expect(guild.treasury).toBe(1);
		expect(guild.getFoodAmount(ULTIMATE)).toBe(6);
		expect(guild.save).toHaveBeenCalled();
		expect(describePackets(response)[0]).toEqual(["CommandReportFoodShopBuyRes", {
			foodType: ULTIMATE, newFoodStock: 6, newTreasury: 1, amountBought: 2, totalCost: ULTIMATE_PRICE * 2
		}]);
		expect(logs?.logGuildFoodShopBuy).toHaveBeenCalledWith({
			keycloakId: KEYCLOAK_ID, guild, cityId: "boug_coton", foodType: ULTIMATE, amount: 2, unitPrice: ULTIMATE_PRICE, totalCost: ULTIMATE_PRICE * 2
		});
		expect(MissionsController.update).toHaveBeenCalledWith(buyer, response, {
			missionId: "buyGuildPetFood", count: 2
		});
		expect(MissionsController.update).toHaveBeenCalledWith(buyer, response, {
			missionId: "buyUltimateSoups", count: 2
		});
	});

	it("only counts the ultimate soups mission for ultimate food", async () => {
		setupGuild(COMMON_PRICE * 3);

		const response = await buy(COMMON, 3);

		expect(MissionsController.update).toHaveBeenCalledTimes(1);
		expect(MissionsController.update).toHaveBeenCalledWith(buyer, response, {
			missionId: "buyGuildPetFood", count: 3
		});
	});

	it("buys only what the treasury can pay", async () => {
		const guild = setupGuild(ULTIMATE_PRICE * 2 + ULTIMATE_PRICE - 1);

		const response = await buy(ULTIMATE, 5);

		expect(response[0]).toMatchObject({
			amountBought: 2, totalCost: ULTIMATE_PRICE * 2
		});
		expect(guild.treasury).toBe(ULTIMATE_PRICE - 1);
	});

	it("buys only what the pantry can store", async () => {
		const guild = setupGuild(1_000_000, { [ULTIMATE]: ULTIMATE_CAPACITY - 2 });

		const response = await buy(ULTIMATE, 5);

		expect(response[0]).toMatchObject({
			amountBought: 2, totalCost: ULTIMATE_PRICE * 2
		});
		expect(guild.getFoodAmount(ULTIMATE)).toBe(ULTIMATE_CAPACITY);
		expect(guild.treasury).toBe(1_000_000 - ULTIMATE_PRICE * 2);
	});

	it("buys at least one unit whatever amount is requested", async () => {
		const guild = setupGuild(ULTIMATE_PRICE);

		await buy(ULTIMATE, 0.4);

		expect([guild.treasury, guild.getFoodAmount(ULTIMATE)]).toEqual([0, 1]);
	});

	it("refuses before locking when the request cannot be served", async () => {
		setupGuild(ULTIMATE_PRICE - 1);
		const poor = errorOf(await buy(ULTIMATE, 1));
		setupGuild(1_000_000, { [ULTIMATE]: ULTIMATE_CAPACITY });
		const full = errorOf(await buy(ULTIMATE, 1));
		const invalid = errorOf(await buy("caviar", 1));
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(asPlayer(Object.assign(makeHandlerPlayer(0), { guildId: null })));
		const noGuild = errorOf(await buy(ULTIMATE, 1));
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);
		const unknown = errorOf(await buy(ULTIMATE, 1));
		vi.mocked(Guilds.getById).mockResolvedValueOnce(null);
		const deleted = errorOf(await buy(ULTIMATE, 1));
		vi.mocked(Guilds.getById).mockResolvedValueOnce(Object.assign(makeHandlerGuild({ treasury: 1_000_000 }), { shopLevel: 0 }));
		const noShop = errorOf(await buy(ULTIMATE, 1));

		expect([poor, full, invalid, noGuild, unknown, deleted, noShop]).toEqual([
			GUILD_DOMAIN_ERROR.NOT_ENOUGH_TREASURY,
			GUILD_DOMAIN_ERROR.STORAGE_FULL,
			GUILD_DOMAIN_ERROR.INVALID_FOOD,
			GUILD_DOMAIN_ERROR.NO_GUILD,
			GUILD_DOMAIN_ERROR.NO_GUILD,
			GUILD_DOMAIN_ERROR.NO_SHOP,
			GUILD_DOMAIN_ERROR.NO_SHOP
		]);
		expect(Guild.withLocked).not.toHaveBeenCalled();
	});

	it("lets a request for more than the treasury through when one unit is affordable", async () => {
		const guild = setupGuild(ULTIMATE_PRICE);

		await buy(ULTIMATE, 3);

		expect(guild.getFoodAmount(ULTIMATE)).toBe(1);
	});

	it("re-checks the locked guild: nothing bought when the treasury was spent meanwhile", async () => {
		setupGuild(ULTIMATE_PRICE);
		const lockedGuild = Object.assign(makeHandlerGuild({ treasury: ULTIMATE_PRICE - 1 }), { shopLevel: 1 });
		vi.spyOn(Guild, "withLocked").mockImplementation((_id, callback) => callback(lockedGuild));

		const response = await buy(ULTIMATE, 1);

		expect(errorOf(response)).toBe(GUILD_DOMAIN_ERROR.CANNOT_BUY);
		expect(lockedGuild.treasury).toBe(ULTIMATE_PRICE - 1);
		expect(lockedGuild.save).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});
