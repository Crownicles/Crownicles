import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {Home as HomeType} from "../../src/core/database/game/models/Home";
import type {CrowniclesPacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";

type ViewPackets = typeof import("../../../Lib/src/packets/commands/CommandReportViewPacket");
type ReportPackets = typeof import("../../../Lib/src/packets/commands/CommandReportPacket");
type FightPackets = typeof import("../../../Lib/src/packets/commands/CommandFightPacket");
type BlockingModule = typeof import("../../src/core/utils/BlockingUtils");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");
type CityPackets = typeof import("../../../Lib/src/packets/interaction/ReactionCollectorCity");
type GenericPackets = typeof import("../../../Lib/src/packets/interaction/ReactionCollectorPacket");
const CONCURRENT_ACTIONS = 8;

describe("adventure consultation and explicit city actions", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let views: ViewPackets;
	let reports: ReportPackets;
	let fights: FightPackets;
	let blocking: BlockingModule["BlockingUtils"];
	let collectors: CollectorsModule["ReactionCollectorController"];
	let cityPackets: CityPackets;
	let genericPackets: GenericPackets;
	const players: PlayerType[] = [];

	beforeAll(async () => {
		env = await setupCoreForTests("reportview");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Home = env.crownicles.gameDatabase.sequelize.models.Home as ModelStatic<HomeType>;
		views = loadProductionModule<ViewPackets>("../../Lib/src/packets/commands/CommandReportViewPacket");
		reports = loadProductionModule<ReportPackets>("../../Lib/src/packets/commands/CommandReportPacket");
		fights = loadProductionModule<FightPackets>("../../Lib/src/packets/commands/CommandFightPacket");
		blocking = loadProductionModule<BlockingModule>("core/utils/BlockingUtils").BlockingUtils;
		collectors = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector").ReactionCollectorController;
		cityPackets = loadProductionModule<CityPackets>("../../Lib/src/packets/interaction/ReactionCollectorCity");
		genericPackets = loadProductionModule<GenericPackets>("../../Lib/src/packets/interaction/ReactionCollectorPacket");
		loadProductionModule("commands/player/ReportViewCommand");
		loadProductionModule("commands/player/FightCommand");
		const {MapCache} = loadProductionModule<typeof import("../../src/core/maps/MapCache")>("core/maps/MapCache");
		const {LogsMapLinks} = loadProductionModule<typeof import("../../src/core/database/logs/models/LogsMapLinks")>("core/database/logs/models/LogsMapLinks");
		const logsLookup = vi.spyOn(LogsMapLinks, "findAll").mockResolvedValue([]);
		await MapCache.init();
		logsLookup.mockRestore();
		await pinInertDailyMission(env);
	});
	afterEach(async () => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		for (const player of players.splice(0)) {
			for (const collector of collectors.getCollectorsOfPlayer(player.keycloakId)) await collector.end([]);
		}
	});
	afterAll(async () => {await env?.teardown();});

	async function createPlayer(name: string): Promise<PlayerType> {
		const player = await Player.create({keycloakId: name, level: 69, class: 11, score: 100, money: 100000, mapLinkId: 103, insideCity: true, effectId: "none", effectEndDate: new Date(0), startTravelDate: new Date(0), fightPointsLost: 0});
		players.push(player);
		return player;
	}

	async function dispatch(player: PlayerType, packet: CrowniclesPacket): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		const context: PacketContext = {keycloakId: player.keycloakId, frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
		await env.crownicles.packetListener.getListener(packet.constructor.name)(response, context, packet);
		return response;
	}

	async function readView(player: PlayerType): Promise<InstanceType<ViewPackets["CommandReportViewRes"]>> {
		const response = await dispatch(player, new views.CommandReportViewReq());
		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(views.CommandReportViewRes);
		return response[0] as InstanceType<ViewPackets["CommandReportViewRes"]>;
	}

	it("offers an explicit start for an unstarted player without creating a journey", async () => {
		const player = await Player.create({keycloakId: "report-view-unstarted"});
		players.push(player);
		await player.reload();
		const before = {mapLinkId: player.mapLinkId, startTravelDate: player.startTravelDate, effectId: player.effectId, score: player.score};
		const view = await readView(player);
		expect(view.reportReady).toBe(true);
		expect(view.travel).toBeUndefined();
		expect(view.city).toBeUndefined();
		await player.reload();
		expect(player).toMatchObject(before);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
	});

	it("keeps repeated city consultation nonblocking and allows a fight afterwards", async () => {
		const player = await createPlayer("report-view-fighter");
		const before = {money: player.money, score: player.score, experience: player.experience, tokens: player.tokens, mapLinkId: player.mapLinkId};
		for (let refresh = 0; refresh < 3; refresh++) {
			const view = await readView(player);
			expect(view.city?.actions.length).toBeGreaterThan(0);
			expect(view.reportReady).toBe(false);
			expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
			expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
		}
		await player.reload();
		expect(player).toMatchObject({...before, insideCity: true});
		const response = await dispatch(player, new fights.CommandFightPacketReq());
		expect(response.some(packet => packet instanceof genericPackets.ReactionCollectorCreationPacket)).toBe(true);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual(["fightConfirmation"]);
	});

	it("reads state while a real decision is pending without clearing its block", async () => {
		const player = await createPlayer("report-view-pending");
		await dispatch(player, new fights.CommandFightPacketReq());
		const pending = collectors.getCollectorsOfPlayer(player.keycloakId)[0].creationPacket.id;
		await readView(player);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual(["fightConfirmation"]);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId).map(collector => collector.creationPacket.id)).toEqual([pending]);
	});

	it("only exposes readiness when a travelling player's event or arrival becomes due", async () => {
		const player = await createPlayer("report-view-traveller");
		await Player.update({insideCity: false, startTravelDate: new Date()}, {where: {id: player.id}});
		await player.reload();
		const before = player.toJSON();
		const initial = await readView(player);
		expect(initial.reportReady).toBe(false);
		for (const dueTime of [initial.travel!.nextStopTime, initial.travel!.arriveTime]) {
			vi.setSystemTime(dueTime + 1);
			const view = await readView(player);
			expect(view.reportReady).toBe(true);
			expect(view.city).toBeUndefined();
			await player.reload();
			expect(player.toJSON()).toEqual(before);
			expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
			expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
		}
	});

	it("returns to a passive city after closing an explicitly opened shop", async () => {
		const player = await createPlayer("report-view-shop");
		const {LogsReadRequests} = loadProductionModule<typeof import("../../src/core/database/logs/LogsReadRequests")>("core/database/logs/LogsReadRequests");
		vi.spyOn(LogsReadRequests, "getAmountOfDailyPotionsBoughtByPlayer").mockResolvedValue(0);
		const city = (await readView(player)).city!;
		const action = city.actions.find(choice => choice.reaction.type === cityPackets.ReactionCollectorCityShopReaction.name)!;
		expect(action).toBeDefined();
		const opened = await dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}));
		expect(opened).toContainEqual(expect.objectContaining({result: "executed"}));
		const shop = collectors.getCollectorsOfPlayer(player.keycloakId)[0];
		expect(shop).toBeDefined();
		expect(shop.creationPacket.data.type).not.toBe(cityPackets.ReactionCollectorCityData.name);
		const response: CrowniclesPacket[] = [];
		const {ReactionCollectorShopCloseReaction} = loadProductionModule<typeof import("../../../Lib/src/packets/interaction/ReactionCollectorShop")>("../../Lib/src/packets/interaction/ReactionCollectorShop");
		const closeIndex = shop.creationPacket.reactions.findIndex(reaction => reaction.type === ReactionCollectorShopCloseReaction.name);
		expect(closeIndex).toBeGreaterThanOrEqual(0);
		await shop.react(player.keycloakId, closeIndex, response);
		expect(response.some(packet => packet instanceof views.CommandReportViewRes && packet.city?.actions.length)).toBe(true);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
		await player.reload();
		expect(player.insideCity).toBe(true);
	});

	it("preserves the legacy interactive city report and its close-without-travelling behavior", async () => {
		const player = await createPlayer("report-view-legacy");
		await dispatch(player, new reports.CommandReportPacketReq());
		const collector = collectors.getCollectorsOfPlayer(player.keycloakId)[0];
		expect(collector.creationPacket.data.type).toBe(cityPackets.ReactionCollectorCityData.name);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toContain("reportCommand");
		const closeIndex = collector.creationPacket.reactions.findIndex(reaction => reaction.type === genericPackets.ReactionCollectorRefuseReaction.name);
		const response: CrowniclesPacket[] = [];
		await collector.react(player.keycloakId, closeIndex, response);
		expect(response.some(packet => packet instanceof reports.CommandReportStayInCity)).toBe(true);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
		await player.reload();
		expect(player.insideCity).toBe(true);
	});

	it("rejects a previously offered action after the player has left the city", async () => {
		const player = await createPlayer("report-view-moved");
		const city = (await readView(player)).city!;
		const action = city.actions.find(choice => choice.reaction.type === cityPackets.ReactionCollectorExitCityReaction.name)!;
		await Player.update({insideCity: false, mapLinkId: 11}, {where: {id: player.id}});
		const response = await dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}));
		expect(response).toContainEqual(expect.objectContaining({result: "stale"}));
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
		await player.reload();
		expect(player.mapLinkId).toBe(11);
	});

	it("rejects an old home upgrade after its level and offer have changed", async () => {
		const player = await createPlayer("report-view-upgrade");
		const home = await Home.create({ownerId: player.id, cityId: "boug_coton", level: 3});
		const city = (await readView(player)).city!;
		const action = city.actions.find(choice => choice.reaction.type === cityPackets.ReactionCollectorCityUpgradeHomeReaction.name)!;
		expect(action).toBeDefined();
		await Home.update({level: 4}, {where: {id: home.id}});
		const response = await dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}));
		expect(response).toContainEqual(expect.objectContaining({result: "stale"}));
		await home.reload();
		await player.reload();
		expect(home.level).toBe(4);
		expect(player.money).toBe(100000);
	});

	it("charges and grants a home upgrade once across concurrent requests", async () => {
		const player = await createPlayer("report-view-upgrade-race");
		const home = await Home.create({ownerId: player.id, cityId: "boug_coton", level: 3});
		const city = (await readView(player)).city!;
		const action = city.actions.find(choice => choice.reaction.type === cityPackets.ReactionCollectorCityUpgradeHomeReaction.name)!;
		const price = city.data.home.manage!.upgrade!.price;
		const moneyBefore = player.money;
		const responses = await runAllOrThrow(Array.from({length: CONCURRENT_ACTIONS}, () => dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}))));
		expect(responses.flat().filter(packet => packet instanceof views.CommandReportCityActionRes && packet.result === "executed")).toHaveLength(1);
		await player.reload();
		await home.reload();
		expect(home.level).toBe(4);
		expect(player.money).toBe(moneyBefore - price);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
	});

	it("releases the temporary action block when rebuilding the offer fails", async () => {
		const player = await createPlayer("report-view-failed-action");
		const city = (await readView(player)).city!;
		const action = city.actions[0];
		const report = loadProductionModule<typeof import("../../src/commands/player/ReportCommand")>("commands/player/ReportCommand");
		vi.spyOn(report, "buildCitySnapshot").mockRejectedValueOnce(new Error("city lookup failed"));
		await expect(dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}))).rejects.toThrow("city lookup failed");
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual([]);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toEqual([]);
	});

	it("executes concurrent city departure requests once and leaves the destination decision protected", async () => {
		const player = await createPlayer("report-view-concurrent");
		const city = (await readView(player)).city!;
		const action = city.actions.find(choice => choice.reaction.type === cityPackets.ReactionCollectorExitCityReaction.name)!;
		const responses = await runAllOrThrow(Array.from({length: CONCURRENT_ACTIONS}, () => dispatch(player, Object.assign(new views.CommandReportCityActionReq(), {mapLocationId: city.data.mapLocationId, actionId: action.id}))));
		expect(responses.flat().filter(packet => packet instanceof views.CommandReportCityActionRes && packet.result === "executed")).toHaveLength(1);
		expect(collectors.getCollectorsOfPlayer(player.keycloakId)).toHaveLength(1);
		expect(blocking.getPlayerBlockingReason(player.keycloakId)).toEqual(["chooseDestination"]);
	});
});