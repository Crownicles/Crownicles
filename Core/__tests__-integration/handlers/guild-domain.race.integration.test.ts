import {afterAll, afterEach, beforeAll, describe, expect, it} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {Guild as GuildType} from "../../src/core/database/game/models/Guild";
import type {CrowniclesPacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";

type UpgradeModule = typeof import("../../src/core/report/ReportCityGuildDomainService");
type DepositModule = typeof import("../../src/core/report/ReportCityGuildDomainShopService");
type DomainPackets = typeof import("../../../Lib/src/packets/commands/CommandGuildDomainPacket");
type ReportPackets = typeof import("../../../Lib/src/packets/commands/CommandReportPacket");
type DomainConstants = typeof import("../../../Lib/src/constants/GuildDomainConstants");
type CoreHandlers = typeof import("../../src/core/packetHandlers/handlers/CoreHandlers");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");
type Collector = import("../../src/core/utils/ReactionsCollector").ReactionCollectorInstance;
type DomainFixture = {player: PlayerType; guild: GuildType; context: PacketContext};
const TREASURY = 100_000;
const PLAYER_MONEY = 10_000;

describe("guild domain observable state", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let upgrades: UpgradeModule;
	let deposits: DepositModule;
	let domainPackets: DomainPackets;
	let reportPackets: ReportPackets;
	let constants: DomainConstants;
	let handlers: InstanceType<CoreHandlers["default"]>;
	let collectors: CollectorsModule;
	const activeCollectors: Collector[] = [];

	beforeAll(async () => {
		env = await setupCoreForTests("guilddomainsnapshot");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		upgrades = loadProductionModule<UpgradeModule>("core/report/ReportCityGuildDomainService");
		deposits = loadProductionModule<DepositModule>("core/report/ReportCityGuildDomainShopService");
		domainPackets = loadProductionModule<DomainPackets>("../../Lib/src/packets/commands/CommandGuildDomainPacket");
		reportPackets = loadProductionModule<ReportPackets>("../../Lib/src/packets/commands/CommandReportPacket");
		constants = loadProductionModule<DomainConstants>("../../Lib/src/constants/GuildDomainConstants");
		const {default: Handler} = loadProductionModule<CoreHandlers>("core/packetHandlers/handlers/CoreHandlers");
		handlers = new Handler();
		collectors = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector");
		await pinInertDailyMission(env);
	});
	afterAll(async () => {await env?.teardown();});
	afterEach(async () => {for (const collector of activeCollectors.splice(0)) await collector.end([]);});

	async function fixture(name: string): Promise<DomainFixture> {
		const {CityDataController} = loadProductionModule<typeof import("../../src/data/City")>("data/City");
		const city = CityDataController.instance.getAllValues()[0];
		const player = await Player.create({keycloakId: `domain-${name}`, money: PLAYER_MONEY, level: 10, insideCity: false});
		const guild = await Guild.create({name: `domain-${name}`, chiefId: player.id, level: 150, treasury: TREASURY, domainCityId: city.id, pantryLevel: 0});
		await player.update({guildId: guild.id});
		return {player, guild, context: {keycloakId: player.keycloakId, frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}}};
	}

	it("returns a private-free snapshot belonging only to the authenticated guild", async () => {
		const {context, guild} = await fixture("read");
		const response: CrowniclesPacket[] = [];
		await handlers.guildDomainInfo(response, context, Object.assign(new domainPackets.CommandGuildDomainInfoReq(), {keycloakId: "another-player", guildId: 999}));
		const packet = response.find((value): value is InstanceType<DomainPackets["CommandGuildDomainInfoRes"]> => value instanceof domainPackets.CommandGuildDomainInfoRes)!;
		expect(packet.data).toMatchObject({guildName: guild.name, treasury: TREASURY, isInCity: false});
		expect(packet.data!.canUpgradeBuildings.pantry).toMatchObject({cost: 40_000, requiredGuildLevel: 15});
		expect(packet.data!.depositOffers).toContainEqual({amount: 1000, treasuryDeposited: 950, canAfford: true});
		expect(JSON.stringify(packet)).not.toContain("keycloakId");
	});

	it("buys exactly the confirmed level under concurrent requests and exposes the new state", async () => {
		const {player, guild, context} = await fixture("upgrade");
		const request = Object.assign(new reportPackets.CommandReportGuildDomainUpgradeReq(), {building: constants.GuildBuilding.PANTRY, expectedLevel: 0});
		const responses: CrowniclesPacket[][] = [[], []];
		await Promise.all(responses.map(response => upgrades.handleGuildDomainUpgrade(player.keycloakId, request, response)));
		await guild.reload();
		expect(guild.pantryLevel).toBe(1);
		expect(guild.treasury).toBe(TREASURY - 40_000);
		expect(responses.flat().filter(packet => packet instanceof reportPackets.CommandReportGuildDomainUpgradeRes)).toHaveLength(1);
		expect(responses.flat()).toContainEqual(expect.objectContaining({error: constants.GUILD_DOMAIN_ERROR.CANNOT_BUY}));
		const response: CrowniclesPacket[] = [];
		await handlers.guildDomainInfo(response, context, new domainPackets.CommandGuildDomainInfoReq());
		expect(response).toContainEqual(expect.objectContaining({data: expect.objectContaining({pantryLevel: 1, treasury: guild.treasury, dailyFoodProduction: [3, 0, 0, 0]})}));
	});

	it("allows only the buyer to reimburse the exact purchase once without a commission", async () => {
		const {player, guild, context} = await fixture("refund");
		await guild.update({shopLevel: 1});
		await handlers.foodShopBuy([], context, Object.assign(new reportPackets.CommandReportFoodShopBuyReq(), {foodType: "commonFood", amount: 3}));
		const collector = collectors.ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
		activeCollectors.push(collector);
		await collector.react("outsider", 0, []);
		expect(collector.getReactionsHistory()).toEqual([]);
		await Promise.all([collector.react(player.keycloakId, 0, []), collector.react(player.keycloakId, 0, [])]);
		await Promise.all([player.reload(), guild.reload()]);
		expect(guild.treasury).toBe(TREASURY);
		expect(player.money).toBe(PLAYER_MONEY - 60);
	});

	it("cannot redirect an old purchase reimbursement to a different guild", async () => {
		const {player, guild, context} = await fixture("otherguild");
		await guild.update({shopLevel: 1});
		await handlers.foodShopBuy([], context, Object.assign(new reportPackets.CommandReportFoodShopBuyReq(), {foodType: "commonFood", amount: 3}));
		const collector = collectors.ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
		activeCollectors.push(collector);
		const other = await Guild.create({name: "other-refund", chiefId: player.id, treasury: 0});
		await Player.update({guildId: other.id}, {where: {id: player.id}});
		const response: CrowniclesPacket[] = [];
		await collector.react(player.keycloakId, 0, response);
		await Promise.all([player.reload(), guild.reload(), other.reload()]);
		expect(player.money).toBe(PLAYER_MONEY);
		expect(guild.treasury).toBe(TREASURY - 60);
		expect(other.treasury).toBe(0);
		expect(response).toContainEqual(expect.objectContaining({error: constants.GUILD_DOMAIN_ERROR.CANNOT_BUY}));
	});

	it("credits exactly the previewed net deposit in the response and database", async () => {
		const {player, guild} = await fixture("deposit");
		const response: CrowniclesPacket[] = [];
		await deposits.handleGuildDomainDepositTreasury(player.keycloakId, Object.assign(new reportPackets.CommandReportGuildDomainDepositTreasuryReq(), {amount: 1000}), response);
		await Promise.all([player.reload(), guild.reload()]);
		expect(player.money).toBe(PLAYER_MONEY - 1000);
		expect(guild.treasury).toBe(TREASURY + 950);
		expect(response).toContainEqual(expect.objectContaining({treasuryDeposited: 950, newPlayerMoney: player.money, newTreasury: guild.treasury}));
	});
});
