import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {PetEntity as PetEntityType} from "../../src/core/database/game/models/PetEntity";
import type {Guild as GuildType} from "../../src/core/database/game/models/Guild";
import type {ReactionCollectorInstance} from "../../src/core/utils/ReactionsCollector";
import type {CrowniclesPacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";

type SaleModule = typeof import("../../src/commands/pet/PetSellCommand");
type SalePacketsModule = typeof import("../../../Lib/src/packets/commands/CommandPetSellPacket");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");
type SaleFixture = {seller: PlayerType; buyer: PlayerType; pet: PetEntityType; guild: GuildType; collector: ReactionCollectorInstance};
const PRICE = 321;
const BUYER_MONEY = 1000;
const MAP_LINK_ID = 1;

describe("targeted pet sale consent", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PetEntity: ModelStatic<PetEntityType>;
	let Guild: ModelStatic<GuildType>;
	let sale: SaleModule;
	let packets: SalePacketsModule;
	let collectors: CollectorsModule;
	const activeCollectors: ReactionCollectorInstance[] = [];

	beforeAll(async () => {
		env = await setupCoreForTests("petsellconsent");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		PetEntity = models.PetEntity as ModelStatic<PetEntityType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		sale = loadProductionModule<SaleModule>("commands/pet/PetSellCommand");
		packets = loadProductionModule<SalePacketsModule>("../../Lib/src/packets/commands/CommandPetSellPacket");
		collectors = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector");
		const {PacketUtils} = loadProductionModule<typeof import("../../src/core/utils/PacketUtils")>("core/utils/PacketUtils");
		vi.spyOn(PacketUtils, "sendPackets").mockImplementation(() => undefined);
		const {LogsDatabase} = loadProductionModule<typeof import("../../src/core/database/logs/LogsDatabase")>("core/database/logs/LogsDatabase");
		vi.spyOn(LogsDatabase, "logPetSell").mockImplementation(() => Promise.resolve());
		const {MapCache} = loadProductionModule<typeof import("../../src/core/maps/MapCache")>("core/maps/MapCache");
		MapCache.continentMapLinks = [MAP_LINK_ID];
		await pinInertDailyMission(env);
	});
	afterEach(async () => {
		for (const collector of activeCollectors.splice(0)) await collector.end([]);
	});
	afterAll(async () => {
		vi.restoreAllMocks();
		await env?.teardown();
	});

	async function offer(name: string): Promise<SaleFixture> {
		const seller = await Player.create({keycloakId: `seller-${name}`, level: 10, effectId: "", mapLinkId: MAP_LINK_ID});
		const guild = await Guild.create({name: `sale-${name}`, chiefId: seller.id, treasury: 0});
		const pet = await PetEntity.create({typeId: 1, sex: "m", nickname: "Offered", lovePoints: 50});
		await seller.update({guildId: guild.id, petId: pet.id});
		const buyer = await Player.create({keycloakId: `buyer-${name}`, level: 10, effectId: "", mapLinkId: MAP_LINK_ID, money: BUYER_MONEY, petId: null});
		const {PetDataController} = loadProductionModule<typeof import("../../src/data/Pet")>("data/Pet");
		const context: PacketContext = {keycloakId: seller.keycloakId, frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
		sale.createAndPushPetSale({player: seller, pet, guild, petModel: PetDataController.instance.getById(pet.typeId)!, petCost: PRICE}, Object.assign(new packets.CommandPetSellPacketReq(), {price: PRICE, askedPlayer: {keycloakId: buyer.keycloakId}}), context, []);
		const collector = collectors.ReactionCollectorController.getCollectorsOfPlayer(seller.keycloakId)[0];
		activeCollectors.push(collector);
		return {seller, buyer, pet, guild, collector};
	}

	it("refuses outsider answers and restores the offer only for its participants", async () => {
		const fixture = await offer("privacy");
		await fixture.collector.react("outsider", 0, []);
		expect(fixture.collector.getReactionsHistory()).toEqual([]);
		expect(collectors.ReactionCollectorController.getCollectorsOfPlayer(fixture.buyer.keycloakId)).toContain(fixture.collector);
		await fixture.collector.react(fixture.buyer.keycloakId, 1, []);
		await fixture.buyer.reload();
		await fixture.seller.reload();
		expect(fixture.buyer.money).toBe(BUYER_MONEY);
		expect(fixture.buyer.petId).toBeNull();
		expect(fixture.seller.petId).toBe(fixture.pet.id);
	});

	it("does not sell a replacement pet after the offer was created", async () => {
		const fixture = await offer("changed");
		const replacement = await PetEntity.create({typeId: 1, sex: "f", nickname: "Replacement", lovePoints: 50});
		await Player.update({petId: replacement.id}, {where: {id: fixture.seller.id}});
		const response: CrowniclesPacket[] = [];
		await fixture.collector.react(fixture.buyer.keycloakId, 0, response);
		await fixture.buyer.reload();
		await fixture.seller.reload();
		expect(fixture.buyer.money).toBe(BUYER_MONEY);
		expect(fixture.buyer.petId).toBeNull();
		expect(fixture.seller.petId).toBe(replacement.id);
		expect(response.some(packet => packet instanceof packets.CommandPetSellInitiatorSituationChangedErrorPacket)).toBe(true);
	});

	it("does not charge when cancellation wins a simultaneous purchase", async () => {
		const fixture = await offer("cancel");
		await Promise.all([
			fixture.collector.react(fixture.seller.keycloakId, 1, []),
			fixture.collector.react(fixture.buyer.keycloakId, 0, [])
		]);
		await Promise.all([fixture.buyer.reload(), fixture.seller.reload(), fixture.guild.reload()]);
		expect(fixture.buyer.money).toBe(BUYER_MONEY);
		expect(fixture.buyer.petId).toBeNull();
		expect(fixture.seller.petId).toBe(fixture.pet.id);
		expect(fixture.guild.treasury).toBe(0);
	});

	it("charges and transfers once when the buyer submits twice", async () => {
		const fixture = await offer("duplicate");
		const responses: CrowniclesPacket[][] = [[], []];
		await Promise.all(responses.map(response => fixture.collector.react(fixture.buyer.keycloakId, 0, response)));
		await Promise.all([fixture.buyer.reload(), fixture.seller.reload(), fixture.guild.reload()]);
		expect(fixture.buyer.money).toBe(BUYER_MONEY - PRICE);
		expect(fixture.buyer.petId).toBe(fixture.pet.id);
		expect(fixture.seller.petId).toBeNull();
		const {GuildDomainConstants} = loadProductionModule<typeof import("../../../Lib/src/constants/GuildDomainConstants")>("../../Lib/src/constants/GuildDomainConstants");
		expect(fixture.guild.treasury).toBe(GuildDomainConstants.computeTreasuryGain(PRICE));
		const successes = responses.flat().filter(packet => packet instanceof packets.CommandPetSellSuccessPacket);
		expect(successes).toHaveLength(1);
		expect(successes[0].pet).toEqual((await fixture.pet.reload()).asOwnedPet());
	});
});