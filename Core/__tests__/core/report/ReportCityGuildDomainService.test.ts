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
			logGuildDomainPurchase: vi.fn().mockResolvedValue(undefined),
			logGuildDomainUpgrade: vi.fn().mockResolvedValue(undefined),
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
vi.mock("../../../src/core/utils/GuildUtils", () => ({
	GuildUtils: { calculateAmountOfXPToAdd: vi.fn((amount: number) => amount * 3) }
}));

import {
	handleGuildDomainNotaryReaction, handleGuildDomainUpgrade
} from "../../../src/core/report/ReportCityGuildDomainService";
import { Players } from "../../../src/core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../../src/core/database/game/models/Guild";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { crowniclesInstance } from "../../../src/app";
import { CityDataController } from "../../../src/data/City";
import {
	GUILD_DOMAIN_ERROR, GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asPlayer, CityHandlerPlayer, describePackets, makeHandlerGuild, makeHandlerPlayer
} from "./CityHandlerFixture";

const DOMAIN_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const RELOCATION_COST = GuildDomainConstants.DOMAIN_RELOCATION_COST;

// The first shelter level costs 10 000 coins and requires a level 15 guild, the second one 40
const SHELTER_COST = 10_000;
const SHELTER_GUILD_LEVEL = 15;
const SHELTER_XP = SHELTER_COST * GuildDomainConstants.UPGRADE_XP_RATIO * 3;

const logs = crowniclesInstance?.logsDatabase;

type HandlerGuild = ReturnType<typeof makeHandlerGuild>;

function guildMember(guildId: number | null): CityHandlerPlayer & { guildId: number | null } {
	return Object.assign(makeHandlerPlayer(0), { guildId });
}

function lockGuild(guild: HandlerGuild): void {
	vi.spyOn(Guild, "withLocked").mockImplementation((_id, callback) => callback(guild));
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("handleGuildDomainNotaryReaction", () => {
	const city = CityDataController.instance.getById(DOMAIN_CITY_ID);

	async function notary(player: CityHandlerPlayer): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		if (!city) {
			throw new Error("Unknown city");
		}
		await handleGuildDomainNotaryReaction(asPlayer(player), city, response);
		return response;
	}

	it("buys the first domain of the guild for the purchase cost", async () => {
		const player = guildMember(7);
		const guild = makeHandlerGuild({ treasury: 50 });
		lockGuild(guild);

		const response = await notary(player);

		expect(player.reload).toHaveBeenCalled();
		expect(guild.domainCityId).toBe(DOMAIN_CITY_ID);
		expect(guild.treasury).toBe(50 - GuildDomainConstants.DOMAIN_PURCHASE_COST);
		expect(guild.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportGuildDomainPurchaseRes", { cost: GuildDomainConstants.DOMAIN_PURCHASE_COST }]]);
		expect(logs?.logGuildDomainPurchase).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, guild, cityId: DOMAIN_CITY_ID, fromCityId: null, isRelocation: false, cost: GuildDomainConstants.DOMAIN_PURCHASE_COST
		});
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "joinGuildHouse" });
	});

	it("relocates an existing domain for exactly the relocation cost", async () => {
		const player = guildMember(7);
		const guild = makeHandlerGuild({
			treasury: RELOCATION_COST, domainCityId: OTHER_CITY_ID
		});
		lockGuild(guild);

		const response = await notary(player);

		expect([guild.domainCityId, guild.treasury]).toEqual([DOMAIN_CITY_ID, 0]);
		expect(describePackets(response)).toEqual([["CommandReportGuildDomainRelocateRes", { cost: RELOCATION_COST }]]);
		expect(logs?.logGuildDomainPurchase).toHaveBeenCalledWith(expect.objectContaining({
			fromCityId: OTHER_CITY_ID, isRelocation: true, cost: RELOCATION_COST
		}));
	});

	it("tells the missing treasury and moves nothing when the guild cannot pay", async () => {
		const player = guildMember(7);
		const guild = makeHandlerGuild({
			treasury: RELOCATION_COST - 9, domainCityId: OTHER_CITY_ID
		});
		lockGuild(guild);

		const response = await notary(player);

		expect(describePackets(response)).toEqual([["CommandReportGuildDomainNotEnoughTreasuryRes", { missingTreasury: 9 }]]);
		expect([guild.domainCityId, guild.treasury]).toEqual([OTHER_CITY_ID, RELOCATION_COST - 9]);
		expect(guild.save).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("does nothing for a player without guild or who is not the chief of the locked guild", async () => {
		const guild = makeHandlerGuild({
			treasury: RELOCATION_COST, domainCityId: OTHER_CITY_ID, chiefId: 2
		});
		lockGuild(guild);

		const notChief = await notary(guildMember(7));
		const noGuild = await notary(guildMember(null));

		expect([...notChief, ...noGuild]).toEqual([]);
		expect(Guild.withLocked).toHaveBeenCalledTimes(1);
		expect(guild.treasury).toBe(RELOCATION_COST);
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});

describe("handleGuildDomainUpgrade", () => {
	async function upgrade(building: GuildBuilding = GuildBuilding.SHELTER): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleGuildDomainUpgrade("chief", { building }, response);
		return response;
	}

	function setupGuild(fields: Parameters<typeof makeHandlerGuild>[0], dataValues: Record<string, number> = {}): HandlerGuild {
		const guild = makeHandlerGuild({
			domainCityId: DOMAIN_CITY_ID, level: SHELTER_GUILD_LEVEL, treasury: SHELTER_COST, ...fields
		}, dataValues);
		vi.mocked(Players.getByKeycloakId).mockResolvedValue(asPlayer(guildMember(guild.id)));
		vi.mocked(Guilds.getById).mockResolvedValue(guild);
		lockGuild(guild);
		return guild;
	}

	function errorOf(response: CrowniclesPacket[]): unknown {
		expect(describePackets(response).map(([name]) => name)).toEqual(["CommandReportGuildDomainUpgradeErrorRes"]);
		return (response[0] as { error?: string }).error;
	}

	it("raises the building, debits its cost, grants guild experience on a share of it and reports the new treasury", async () => {
		const guild = setupGuild({ treasury: SHELTER_COST + 5 });

		const response = await upgrade();

		expect(guild.getDataValue("shelterLevel")).toBe(1);
		expect(guild.treasury).toBe(5);
		expect(describePackets(response)).toEqual([["CommandReportGuildDomainUpgradeRes", {
			building: GuildBuilding.SHELTER, newLevel: 1, cost: SHELTER_COST, newTreasury: 5, xpGained: SHELTER_XP
		}]]);
		expect(guild.addExperience).toHaveBeenCalledWith({
			amount: SHELTER_XP, response, reason: NumberChangeReason.GUILD_DOMAIN_UPGRADE
		});
		expect(guild.save).toHaveBeenCalled();
		expect(logs?.logGuildDomainUpgrade).toHaveBeenCalledWith({
			keycloakId: "chief", guild, cityId: DOMAIN_CITY_ID, building: GuildBuilding.SHELTER, newLevel: 1, cost: SHELTER_COST, xpGained: SHELTER_XP
		});
	});

	it("upgrades a guild of exactly the required level with exactly the cost", async () => {
		const guild = setupGuild({});

		await upgrade();

		expect([guild.getDataValue("shelterLevel"), guild.treasury]).toEqual([1, 0]);
	});

	it("refuses with the matching error before locking", async () => {
		setupGuild({ treasury: SHELTER_COST - 1 });
		const poor = errorOf(await upgrade());
		setupGuild({ level: SHELTER_GUILD_LEVEL - 1 });
		const tooLow = errorOf(await upgrade());
		setupGuild({}, { shopLevel: 1 });
		const maxed = errorOf(await upgrade(GuildBuilding.SHOP));
		setupGuild({});
		const invalid = errorOf(await upgrade("castle" as GuildBuilding));

		expect([poor, tooLow, maxed, invalid]).toEqual([
			GUILD_DOMAIN_ERROR.NOT_ENOUGH_TREASURY, GUILD_DOMAIN_ERROR.GUILD_LEVEL_TOO_LOW, GUILD_DOMAIN_ERROR.MAX_LEVEL, GUILD_DOMAIN_ERROR.INVALID_BUILDING
		]);
		expect(Guild.withLocked).not.toHaveBeenCalled();
	});

	it("refuses a player without guild, a guild without domain and a member who is not the chief", async () => {
		const guild = setupGuild({});
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);
		const unknown = errorOf(await upgrade());
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(asPlayer(guildMember(null)));
		const noGuild = errorOf(await upgrade());
		vi.mocked(Guilds.getById).mockResolvedValueOnce(null);
		const deletedGuild = errorOf(await upgrade());
		guild.domainCityId = null;
		const noDomain = errorOf(await upgrade());
		guild.domainCityId = DOMAIN_CITY_ID;
		guild.chiefId = 2;
		const notChief = errorOf(await upgrade());

		expect([unknown, noGuild, deletedGuild, noDomain, notChief]).toEqual([
			GUILD_DOMAIN_ERROR.NO_GUILD, GUILD_DOMAIN_ERROR.NO_GUILD, GUILD_DOMAIN_ERROR.NO_DOMAIN, GUILD_DOMAIN_ERROR.NO_DOMAIN, GUILD_DOMAIN_ERROR.NOT_AUTHORIZED
		]);
		expect(Guild.withLocked).not.toHaveBeenCalled();
	});

	it("re-validates the locked guild: no upgrade when the treasury was spent meanwhile", async () => {
		const guild = setupGuild({});
		const lockedGuild = makeHandlerGuild({
			domainCityId: DOMAIN_CITY_ID, level: SHELTER_GUILD_LEVEL, treasury: SHELTER_COST - 1
		});
		lockGuild(lockedGuild);

		const error = errorOf(await upgrade());

		expect(error).toBe(GUILD_DOMAIN_ERROR.NOT_ENOUGH_TREASURY);
		expect([lockedGuild.getDataValue("shelterLevel"), lockedGuild.treasury]).toEqual([0, SHELTER_COST - 1]);
		expect(guild.save).not.toHaveBeenCalled();
		expect(lockedGuild.save).not.toHaveBeenCalled();
		expect(logs?.logGuildDomainUpgrade).not.toHaveBeenCalled();
	});

	it("does not log the upgrade of a guild whose domain disappeared meanwhile", async () => {
		setupGuild({});
		const lockedGuild = makeHandlerGuild({
			domainCityId: null, level: SHELTER_GUILD_LEVEL, treasury: SHELTER_COST
		});
		lockGuild(lockedGuild);

		await upgrade();

		expect(lockedGuild.treasury).toBe(0);
		expect(logs?.logGuildDomainUpgrade).not.toHaveBeenCalled();
	});
});
