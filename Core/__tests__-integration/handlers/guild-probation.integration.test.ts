import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {PetEntity as PetEntityType} from "../../src/core/database/game/models/PetEntity";
import type {Guild as GuildType} from "../../src/core/database/game/models/Guild";
import type {GuildPet as GuildPetType} from "../../src/core/database/game/models/GuildPet";
import type {CrowniclesPacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";

type TransferModule = typeof import("../../src/commands/pet/PetTransferCommand");
type RecruitmentModule = typeof import("../../src/commands/guild/GuildRecruitmentCommand");
type TransferPacketsModule = typeof import("../../../Lib/src/packets/commands/CommandPetTransferPacket");
type RecruitmentPacketsModule = typeof import("../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");

const MAP_LINK_ID = 1;
const HOUR_MS = 3_600_000;
const PROBATION_HOURS = 72;

/**
 * A newcomer who joins a recruiting guild on their own must not be able to walk away with a shelter pet:
 * for 72 h the shelter offers them no withdrawal, unless the chief names them elder.
 */
describe("guild probation", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PetEntity: ModelStatic<PetEntityType>;
	let Guild: ModelStatic<GuildType>;
	let GuildPet: ModelStatic<GuildPetType>;
	let transfer: TransferModule;
	let recruitment: RecruitmentModule;
	let transferPackets: TransferPacketsModule;
	let recruitmentPackets: RecruitmentPacketsModule;
	let collectors: CollectorsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("guildprobation");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		PetEntity = models.PetEntity as ModelStatic<PetEntityType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		GuildPet = models.GuildPet as ModelStatic<GuildPetType>;
		transfer = loadProductionModule<TransferModule>("commands/pet/PetTransferCommand");
		recruitment = loadProductionModule<RecruitmentModule>("commands/guild/GuildRecruitmentCommand");
		transferPackets = loadProductionModule<TransferPacketsModule>("../../Lib/src/packets/commands/CommandPetTransferPacket");
		recruitmentPackets = loadProductionModule<RecruitmentPacketsModule>("../../Lib/src/packets/commands/CommandGuildRecruitmentPacket");
		collectors = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector");
		const {PacketUtils} = loadProductionModule<typeof import("../../src/core/utils/PacketUtils")>("core/utils/PacketUtils");
		vi.spyOn(PacketUtils, "sendPackets").mockImplementation(() => undefined);
		const {LogsDatabase} = loadProductionModule<typeof import("../../src/core/database/logs/LogsDatabase")>("core/database/logs/LogsDatabase");
		vi.spyOn(LogsDatabase, "logGuildJoin").mockImplementation(() => Promise.resolve());
		const {MapCache} = loadProductionModule<typeof import("../../src/core/maps/MapCache")>("core/maps/MapCache");
		MapCache.continentMapLinks = [MAP_LINK_ID];
		MapCache.pveIslandMapLinks = [];
		MapCache.boatEntryMapLinks = [];
		MapCache.entryAndExitBoatMapLinks = [];
		await pinInertDailyMission(env);
	});
	afterEach(async () => {
		for (const player of await Player.findAll()) {
			for (const collector of collectors.ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId)) await collector.end([]);
		}
	});
	afterAll(async () => {
		vi.restoreAllMocks();
		await env?.teardown();
	});

	async function recruitingGuildWithShelterPet(name: string): Promise<{guild: GuildType; newcomer: PlayerType}> {
		const chief = await Player.create({keycloakId: `chief-${name}`, level: 20, effectId: "", mapLinkId: MAP_LINK_ID});
		const guild = await Guild.create({name: `probation-${name}`, chiefId: chief.id, recruitmentOfficeLevel: 1, recruitmentOpen: true, recruitmentMinScore: 0});
		await chief.update({guildId: guild.id});
		const pet = await PetEntity.create({typeId: 1, sex: "m", nickname: "Rare", lovePoints: 50});
		await GuildPet.create({guildId: guild.id, petEntityId: pet.id});
		const newcomer = await Player.create({keycloakId: `newcomer-${name}`, level: 20, effectId: "", mapLinkId: MAP_LINK_ID, petId: null});
		const joined: CrowniclesPacket[] = [];
		await new recruitment.default().join(joined, newcomer, Object.assign(new recruitmentPackets.CommandGuildJoinPacketReq(), {guildId: guild.id}));
		expect(joined.some(packet => packet instanceof recruitmentPackets.CommandGuildJoinPacketRes)).toBe(true);
		return {guild, newcomer: (await Player.findByPk(newcomer.id))!};
	}

	async function openTransfer(player: PlayerType): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		const context: PacketContext = {keycloakId: player.keycloakId, frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
		await new transfer.default().execute(response, player, new transferPackets.CommandPetTransferPacketReq(), context);
		return response;
	}

	it("keeps shelter pets out of reach of a newcomer for 72 hours, and says until when", async () => {
		const before = Date.now();
		const {newcomer} = await recruitingGuildWithShelterPet("fresh");
		expect(newcomer.guildJoinedAt!.valueOf()).toBeGreaterThanOrEqual(before - 1000);

		const response = await openTransfer(newcomer);
		const refusal = response.find(packet => packet instanceof transferPackets.CommandPetTransferProbationErrorPacket) as InstanceType<TransferPacketsModule["CommandPetTransferProbationErrorPacket"]> | undefined;
		expect(refusal).toBeDefined();
		expect(refusal!.probationEndsAt).toBeCloseTo(newcomer.guildJoinedAt!.valueOf() + PROBATION_HOURS * HOUR_MS, -4);
		expect(await GuildPet.count()).toBeGreaterThan(0);
		expect((await Player.findByPk(newcomer.id))!.petId).toBeNull();
	});

	it("lets the newcomer take a shelter pet once named elder, or once the probation is over", async () => {
		const promoted = await recruitingGuildWithShelterPet("elder");
		await Guild.update({elderId: promoted.newcomer.id}, {where: {id: promoted.guild.id}});
		expect((await openTransfer(promoted.newcomer)).some(packet => packet instanceof transferPackets.CommandPetTransferProbationErrorPacket)).toBe(false);
		expect(collectors.ReactionCollectorController.getCollectorsOfPlayer(promoted.newcomer.keycloakId)).toHaveLength(1);

		const veteran = await recruitingGuildWithShelterPet("veteran");
		await veteran.newcomer.update({guildJoinedAt: new Date(Date.now() - (PROBATION_HOURS + 1) * HOUR_MS)});
		expect((await openTransfer(veteran.newcomer)).some(packet => packet instanceof transferPackets.CommandPetTransferProbationErrorPacket)).toBe(false);
		expect(collectors.ReactionCollectorController.getCollectorsOfPlayer(veteran.newcomer.keycloakId)).toHaveLength(1);
	});
});
