import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import { Constants } from "../../../Lib/src/constants/Constants";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import type { ReactionCollectorBigEventPossibilityReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import type { ReactionCollectorChooseDestinationReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";

type LocksModule = typeof import("../../../Lib/src/locks/withLockedEntities");
type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type MissionsInfoModelModule = typeof import("../../src/core/database/game/models/PlayerMissionsInfo");
type DestinationServiceModule = typeof import("../../src/core/report/ReportDestinationService");
type BigEventServiceModule = typeof import("../../src/core/report/ReportBigEventService");
type MapsModule = typeof import("../../src/core/maps/Maps");
type MapCacheModule = typeof import("../../src/core/maps/MapCache");
type MapLinksModule = typeof import("../../src/data/MapLink");
type CitiesModule = typeof import("../../src/data/City");
type TravelTimeModule = typeof import("../../src/core/maps/TravelTime");
type LogsMapLinksModule = typeof import("../../src/core/database/logs/models/LogsMapLinks");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");
type ReportPacketsModule = typeof import("../../../Lib/src/packets/commands/CommandReportPacket");
type CollectorStopModule = typeof import("../../../Lib/src/packets/interaction/ReactionCollectorStopPacket");

const N_CONCURRENT = 20;
const MONEY_DELTA = 10;
const RECEPTION_MAP_ID = 29;
const RECEPTION_MAP_LINK_ID = 75;
const ROYAL_AUDIENCE_EVENT_ID = 60;

/**
 * Race coverage for the `applyLockedOutcomeUnderLock` body in
 * {@link ReportBigEventService.doPossibility}: race N concurrent
 * outcome applications under
 * `withLockedEntities([Player, PlayerMissionsInfo])` and assert that
 * every money delta lands (no lost writes), which mirrors the safety
 * invariant of `#3760` — the bug that motivated wrapping the outcome
 * application in a row-level lock in the first place.
 *
 * Also covers the real royal audience and destination collectors:
 * expiry and explicit choices must persist a valid departure, while
 * duplicate closures must not grant another reward or restart travel.
 */
describe("doPossibility locked outcome race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let locks: LocksModule;
	let playerMod: PlayerModelModule;
	let missionsInfoMod: MissionsInfoModelModule;

	beforeAll(async () => {
		env = await setupCoreForTests("dopossibilitylock");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		locks = loadProductionModule<LocksModule>("../../Lib/src/locks/withLockedEntities");
		playerMod = loadProductionModule<PlayerModelModule>("core/database/game/models/Player");
		missionsInfoMod = loadProductionModule<MissionsInfoModelModule>("core/database/game/models/PlayerMissionsInfo");
		const { MapCache } = loadProductionModule<MapCacheModule>("core/maps/MapCache");
		const { LogsMapLinks } = loadProductionModule<LogsMapLinksModule>("core/database/logs/models/LogsMapLinks");
		const loggedLinks = vi.spyOn(LogsMapLinks, "findAll").mockResolvedValue([]);
		try {
			await MapCache.init();
		}
		finally {
			loggedLinks.mockRestore();
		}
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await env.crownicles.gameDatabase.sequelize.models.MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	it.each([
		{ mode: "destination", resolution: "timeout" },
		{ mode: "audience", resolution: "timeout" },
		{ mode: "ordinary", resolution: "timeout" },
		{ mode: "destination", resolution: "selection" },
		{ mode: "audience", resolution: "selection" },
		{ mode: "ordinary", resolution: "selection" }
	])("persists a valid $mode journey after $resolution", async ({ mode, resolution }) => {
		const { Maps } = loadProductionModule<MapsModule>("core/maps/Maps");
		const { MapLinkDataController } = loadProductionModule<MapLinksModule>("data/MapLink");
		const { CityDataController } = loadProductionModule<CitiesModule>("data/City");
		const ordinaryLink = MapLinkDataController.instance.getAll().find(link => {
			const candidate = Player.build({ mapLinkId: link.id });
			return candidate.getDestinationId() !== RECEPTION_MAP_ID
				&& !CityDataController.instance.getCityByMapId(link.endMap)
				&& !Maps.isOnPveIsland(candidate)
				&& Maps.getNextPlayerAvailableMaps(candidate).length > 1;
		});
		expect(ordinaryLink).toBeDefined();
		const player = await Player.create({
			keycloakId: `destination-${mode}-${resolution}`,
			mapLinkId: mode === "ordinary" ? ordinaryLink!.id : RECEPTION_MAP_LINK_ID,
			startTravelDate: new Date(),
			effectId: "no_effect",
			effectEndDate: new Date(0)
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		const { chooseDestination } = loadProductionModule<DestinationServiceModule>("core/report/ReportDestinationService");
		const { doRandomBigEvent } = loadProductionModule<BigEventServiceModule>("core/report/ReportBigEventService");
		const { TravelTime } = loadProductionModule<TravelTimeModule>("core/maps/TravelTime");
		const { ReactionCollectorController } = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector");
		const { PacketUtils } = loadProductionModule<PacketUtilsModule>("core/utils/PacketUtils");
		const { CommandReportChooseDestinationRes, CommandReportBigEventResultRes } = loadProductionModule<ReportPacketsModule>("../../Lib/src/packets/commands/CommandReportPacket");
		const { ReactionCollectorStopPacket, REACTION_COLLECTOR_STOP_REASONS } = loadProductionModule<CollectorStopModule>("../../Lib/src/packets/interaction/ReactionCollectorStopPacket");
		const availableMaps = Maps.getNextPlayerAvailableMaps(player);
		const originMapId = player.getDestinationId();
		const selectedMapId = availableMaps[availableMaps.length - 1];
		const context: PacketContext = {
			frontEndOrigin: "test",
			frontEndSubOrigin: "test",
			keycloakId: player.keycloakId,
			webSocket: {}
		};
		const now = new Date();
		now.setMilliseconds(0);
		const clock = vi.spyOn(Date, "now").mockReturnValue(now.valueOf());
		const timers = vi.spyOn(globalThis, "setTimeout");
		const sentPackets = vi.spyOn(PacketUtils, "sendPackets").mockImplementation(() => {});
		try {
			const response: CrowniclesPacket[] = [];
			await locks.withLockedEntities([
				playerMod.Player.lockKey(player.id),
				missionsInfoMod.PlayerMissionsInfo.lockKey(player.id)
			] as const, async ([lockedPlayer]) => {
				if (mode === "audience") {
					await doRandomBigEvent(context, response, lockedPlayer, ROYAL_AUDIENCE_EVENT_ID);
				}
				else {
					await chooseDestination(context, lockedPlayer, null, response, { allowStayInCity: false });
				}
			});
			const initialCollector = ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
			expect(initialCollector).toBeDefined();
			const timer = timers.mock.calls.find(([, delay]) => delay === Constants.MESSAGES.COLLECTOR_TIME);
			expect(timer).toBeDefined();
			if (!timer) {
				throw new Error("Expected the destination collector timeout");
			}
			if (resolution === "timeout") {
				clock.mockReturnValue(now.valueOf() + Constants.MESSAGES.COLLECTOR_TIME);
				await timer[0]();
			}
			else {
				if (mode === "audience") {
					const startIndex = initialCollector.creationPacket.reactions.findIndex(reaction => (reaction.data as ReactionCollectorBigEventPossibilityReaction).name === "start");
					expect(startIndex).toBeGreaterThanOrEqual(0);
					await initialCollector.react(player.keycloakId, startIndex, response);
					expect(response.some(packet => packet instanceof CommandReportChooseDestinationRes)).toBe(false);
					expect((await Player.findByPk(player.id))!.mapLinkId).toBe(RECEPTION_MAP_LINK_ID);
				}
				const destinationCollector = ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)[0];
				const destinationIndex = destinationCollector.creationPacket.reactions.findIndex(reaction => (reaction.data as ReactionCollectorChooseDestinationReaction).mapId === selectedMapId);
				expect(destinationIndex).toBeGreaterThanOrEqual(0);
				await destinationCollector.react(player.keycloakId, destinationIndex, response);
			}

			const packets = resolution === "timeout" ? sentPackets.mock.calls.flatMap(([, packets]) => packets) : response;
			const destination = packets.find(packet => packet instanceof CommandReportChooseDestinationRes);
			const stopped = packets.find(packet => packet instanceof ReactionCollectorStopPacket);
			const fresh = await Player.findByPk(player.id);
			expect(fresh!.getDestinationId()).not.toBe(originMapId);
			expect(availableMaps).toContain(fresh!.getDestinationId());
			expect(fresh!.getPreviousMapId()).toBe(originMapId);
			expect(destination).toBeDefined();
			expect(stopped?.reason).toBe(resolution === "timeout" ? REACTION_COLLECTOR_STOP_REASONS.EXPIRED : REACTION_COLLECTOR_STOP_REASONS.RESOLVED);
			expect(destination?.mapId).toBe(fresh!.getDestinationId());
			const departureTime = now.valueOf() + (resolution === "timeout" ? Constants.MESSAGES.COLLECTOR_TIME : 0);
			expect(fresh!.startTravelDate.valueOf()).toBe(departureTime);
			expect(Maps.isArrived(fresh!, new Date(departureTime))).toBe(false);
			expect((await TravelTime.getTravelData(fresh!, new Date(departureTime))).nextSmallEventTime).toBeGreaterThan(departureTime);
			expect(ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)).toHaveLength(0);
			if (resolution === "selection") {
				expect(destination?.mapId).toBe(selectedMapId);
			}
			if (mode === "audience") {
				expect(packets.filter(packet => packet instanceof CommandReportBigEventResultRes)).toHaveLength(1);
			}
			await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => initialCollector.end([])));
			if (resolution === "timeout") {
				await timer[0]();
				expect(sentPackets).toHaveBeenCalledTimes(1);
			}
			expect((await Player.findByPk(player.id))!.toJSON()).toEqual(fresh!.toJSON());
		}
		finally {
			for (const collector of ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)) {
				collector.discardUnpublished();
			}
			sentPackets.mockRestore();
			timers.mockRestore();
			clock.mockRestore();
		}
	});

	it(`serialises ${N_CONCURRENT} concurrent outcome applications — money is exact`, async () => {
		const player = await Player.create({
			keycloakId: "race-do-possibility-money",
			money: 0
		});
		// Pre-create the missions-info row so the lock body does not
		// race an INSERT, exactly as `doPossibility` does via
		// `PlayerMissionsInfos.getOfPlayer` before entering the lock.
		await PlayerMissionsInfo.create({ playerId: player.id });

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => locks.withLockedEntities(
				[
					playerMod.Player.lockKey(player.id),
					missionsInfoMod.PlayerMissionsInfo.lockKey(player.id)
				] as const,
				async ([lockedPlayer]) => {
					lockedPlayer.money += MONEY_DELTA;
					lockedPlayer.nextEvent = null;
					await lockedPlayer.save();
				}
			))
		);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT * MONEY_DELTA);
		expect(fresh!.nextEvent).toBeNull();
	});
});
