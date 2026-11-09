import {afterAll, beforeAll, describe, expect, it} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {Home as HomeType} from "../../src/core/database/game/models/Home";
import type {PlayerPlantSlot as PlayerPlantSlotType} from "../../src/core/database/game/models/PlayerPlantSlot";
import type {HomeGardenSlot as HomeGardenSlotType} from "../../src/core/database/game/models/HomeGardenSlot";
import type {CrowniclesPacket} from "../../../Lib/src/packets/CrowniclesPacket";

type GardenModule = typeof import("../../src/commands/player/GardenCommand");
type GardenPackets = typeof import("../../../Lib/src/packets/commands/CommandGardenPacket");
type ReportPackets = typeof import("../../../Lib/src/packets/commands/CommandReportPacket");
type PlantConstantsModule = typeof import("../../../Lib/src/constants/PlantConstants");
const CONCURRENT_PLANTINGS = 10;

describe("garden direct actions", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let PlayerPlantSlot: ModelStatic<PlayerPlantSlotType>;
	let HomeGardenSlot: ModelStatic<HomeGardenSlotType>;
	let garden: InstanceType<GardenModule["GardenCommand"]>;
	let packets: GardenPackets;
	let reportPackets: ReportPackets;
	let plants: PlantConstantsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("gardenactions");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		PlayerPlantSlot = models.PlayerPlantSlot as ModelStatic<PlayerPlantSlotType>;
		HomeGardenSlot = models.HomeGardenSlot as ModelStatic<HomeGardenSlotType>;
		const {GardenCommand} = loadProductionModule<GardenModule>("commands/player/GardenCommand");
		garden = new GardenCommand();
		packets = loadProductionModule<GardenPackets>("../../Lib/src/packets/commands/CommandGardenPacket");
		reportPackets = loadProductionModule<ReportPackets>("../../Lib/src/packets/commands/CommandReportPacket");
		plants = loadProductionModule<PlantConstantsModule>("../../Lib/src/constants/PlantConstants");
		await pinInertDailyMission(env);
	});
	afterAll(async () => {await env?.teardown();});

	it("consumes a seed exactly once and returns the planted plot in the refreshed snapshot", async () => {
		const player = await Player.create({keycloakId: "garden-actions-owner", level: 45, mapLinkId: 103, insideCity: true, startTravelDate: new Date(0)});
		const home = await Home.create({ownerId: player.id, cityId: "boug_coton", level: 4});
		await PlayerPlantSlot.create({playerId: player.id, slotType: plants.PLANT_SLOT_TYPE.SEED, slot: 0, plantId: plants.PlantId.COMMON_HERB});
		const before: CrowniclesPacket[] = [];
		await garden.info(before, player);
		expect(before[0]).toBeInstanceOf(packets.CommandGardenInfoRes);
		const responses = Array.from({length: CONCURRENT_PLANTINGS}, (): CrowniclesPacket[] => []);
		await runAllOrThrow(responses.map(response => garden.action(response, player, {operation: {type: "plant", gardenSlot: 0}})));
		expect(responses.flat().filter(packet => packet instanceof reportPackets.CommandReportGardenPlantRes)).toHaveLength(1);
		const seed = await PlayerPlantSlot.findOne({where: {playerId: player.id, slotType: plants.PLANT_SLOT_TYPE.SEED}});
		expect(seed!.plantId).toBe(0);
		const plots = await HomeGardenSlot.findAll({where: {homeId: home.id}});
		expect(plots.filter(plot => plot.plantId !== 0)).toHaveLength(1);
		const after: CrowniclesPacket[] = [];
		await garden.info(after, player);
		expect(after[0]).toMatchObject({garden: {hasSeed: false, plots: expect.arrayContaining([expect.objectContaining({slot: 0, plantId: plants.PlantId.COMMON_HERB})])}});
	});

	it("does not reveal another player's garden or consume a seed away from home", async () => {
		const player = await Player.create({keycloakId: "garden-away-owner", level: 45, mapLinkId: 103, insideCity: true, startTravelDate: new Date(0)});
		await Home.create({ownerId: player.id, cityId: "boug_coton", level: 4});
		await PlayerPlantSlot.create({playerId: player.id, slotType: plants.PLANT_SLOT_TYPE.SEED, slot: 0, plantId: plants.PlantId.COMMON_HERB});
		await Player.update({mapLinkId: 11}, {where: {id: player.id}});
		const response: CrowniclesPacket[] = [];
		await garden.action(response, player, {operation: {type: "plant", gardenSlot: 0}});
		expect(response[0]).toMatchObject({reason: "noTalisman"});
		const seed = await PlayerPlantSlot.findOne({where: {playerId: player.id, slotType: plants.PLANT_SLOT_TYPE.SEED}});
		expect(seed!.plantId).toBe(plants.PlantId.COMMON_HERB);
	});
});