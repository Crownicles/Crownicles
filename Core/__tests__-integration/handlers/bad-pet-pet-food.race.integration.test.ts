import {
	afterAll, afterEach, beforeAll, describe, expect, it, vi
} from "vitest";
import type {
	Model, ModelStatic
} from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { PetEntity as PetEntityType } from "../../src/core/database/game/models/PetEntity";
import type { PlayerActiveObjects } from "../../src/core/database/game/models/PlayerActiveObjects";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import type { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";
import { MapConstants } from "../../../Lib/src/constants/MapConstants";

type SmallEventModule = typeof import("../../src/core/smallEvents/badPet");
type ReactionsCollectorModule = typeof import("../../src/core/utils/ReactionsCollector");
type RandomUtilsModule = typeof import("../../../Lib/src/utils/RandomUtils");
type MapLinkModule = typeof import("../../src/data/MapLink");
type ReactionCollectorInstance = InstanceType<ReactionsCollectorModule["ReactionCollectorInstance"]>;

const CONCURRENT_LOVE_GAIN = 3;
const CONCURRENT_FOOD_GAIN = 5;
const INITIAL_LOVE = 50;
const INITIAL_MEAT = 4;
const CARNIVOROUS_PET_TYPE = 1;
const OMNIVOROUS_PET_TYPE = 29;

/**
 * How long the concurrent write is given to commit before the small event goes on: it waits for the end of the
 * transaction of the small event when the row is locked, and commits right away when it is not
 */
const CONCURRENT_WRITE_GRACE_MS = 300;

/**
 * The end callback of a small event collector runs after the lock of the report is released: the pet (and the guild
 * food) it changes must be read and saved under their own row locks, or a concurrent write committed in between — the
 * daily training ground love gain, another guild member using the pantry — is lost (#5176).
 */
describe("badPet and petFood outcomes under concurrent writes", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let PetEntity: ModelStatic<PetEntityType>;
	let badPet: SmallEventModule["smallEventFuncs"];
	let petFood: SmallEventModule["smallEventFuncs"];
	let reactionsCollector: ReactionsCollectorModule;
	let randomUtils: RandomUtilsModule;
	let mapLinks: MapLinkModule;

	beforeAll(async () => {
		env = await setupCoreForTests("badpetpetfoodrace");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		PetEntity = models.PetEntity as ModelStatic<PetEntityType>;
		badPet = loadProductionModule<SmallEventModule>("core/smallEvents/badPet").smallEventFuncs;
		petFood = loadProductionModule<SmallEventModule>("core/smallEvents/petFood").smallEventFuncs;
		reactionsCollector = loadProductionModule<ReactionsCollectorModule>("core/utils/ReactionsCollector");
		randomUtils = loadProductionModule<RandomUtilsModule>("../../Lib/src/utils/RandomUtils");
		mapLinks = loadProductionModule<MapLinkModule>("data/MapLink");
		await pinInertDailyMission(env);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	async function createPetOwner(keycloakId: string, petTypeId: number, guildId: number | null): Promise<PlayerType> {
		const pet = await PetEntity.create({
			typeId: petTypeId, sex: "f", lovePoints: INITIAL_LOVE
		});
		const player = await Player.create({
			keycloakId,
			petId: pet.id,
			guildId,
			mapLinkId: mapLinks.MapLinkDataController.instance.getLinksByMapStart(MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS)[0].id
		});
		await env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo.create({ playerId: player.id });
		return player;
	}

	/**
	 * Commit `sql` from another connection right before the first save of a row of `model`, the moment a lost update
	 * would happen. The write is awaited at the end of the test, once the small event committed.
	 */
	function commitConcurrentlyBeforeSave(model: ModelStatic<Model>, sql: string, pendingWrites: Promise<unknown>[]): void {
		const save = model.prototype.save;
		let fired = false;
		vi.spyOn(model.prototype, "save").mockImplementation(async function (this: Model, ...args: Parameters<Model["save"]>) {
			if (!fired) {
				fired = true;
				const write = env.crownicles.gameDatabase.sequelize.query(sql, { transaction: null });
				pendingWrites.push(write);
				await Promise.race([write, new Promise(resolve => setTimeout(resolve, CONCURRENT_WRITE_GRACE_MS))]);
			}
			return await save.apply(this, args);
		});
	}

	async function runSmallEventAndReact(
		funcs: SmallEventModule["smallEventFuncs"],
		player: PlayerType,
		matches: (reaction: ReactionCollectorCreationPacket["reactions"][number]) => boolean,
		testArgs?: string[]
	): Promise<CrowniclesPacket[]> {
		let collector: ReactionCollectorInstance | undefined;
		const build = reactionsCollector.ReactionCollectorInstance.prototype.build;
		vi.spyOn(reactionsCollector.ReactionCollectorInstance.prototype, "build").mockImplementation(function (this: ReactionCollectorInstance) {
			collector = this;
			return build.call(this);
		});
		await funcs.executeSmallEvent(player, {
			response: [],
			context: { keycloakId: player.keycloakId } as PacketContext,
			playerActiveObjects: {} as PlayerActiveObjects,
			testArgs
		});
		if (!collector) {
			throw new Error("The small event should open a collector");
		}
		const response: CrowniclesPacket[] = [];
		await collector.react(player.keycloakId, collector.creationPacket.reactions.findIndex(matches), response);
		return response;
	}

	function outcomePacket<T>(response: CrowniclesPacket[], packetName: string): T {
		const packet = response.find(candidate => candidate.constructor.name === packetName);
		if (!packet) {
			throw new Error(`Missing ${packetName}`);
		}
		return packet as unknown as T;
	}

	it("badPet keeps the love and the guild food committed concurrently while the pet eats from the pantry", async () => {
		const guild = await Guild.create({
			name: "BadPetGuild", chiefId: 0, carnivorousFood: INITIAL_MEAT
		});
		const player = await createPetOwner("bad-pet-concurrent", CARNIVOROUS_PET_TYPE, guild.id);
		const pendingWrites: Promise<unknown>[] = [];
		commitConcurrentlyBeforeSave(Guild, `UPDATE guilds SET carnivorousFood = carnivorousFood + ${CONCURRENT_FOOD_GAIN} WHERE id = ${guild.id}`, pendingWrites);
		commitConcurrentlyBeforeSave(PetEntity, `UPDATE pet_entities SET lovePoints = lovePoints + ${CONCURRENT_LOVE_GAIN} WHERE id = ${player.petId}`, pendingWrites);
		const giveMeat = SmallEventConstants.BAD_PET.ACTION_IDS.GIVE_MEAT;

		const response = await runSmallEventAndReact(badPet, player, reaction => (reaction.data as { id: string }).id === giveMeat, [giveMeat]);
		await Promise.all(pendingWrites);

		const { loveLost } = outcomePacket<{ loveLost: number }>(response, "SmallEventBadPetPacket");
		expect(loveLost).toBeGreaterThan(0);
		expect(pendingWrites).toHaveLength(2);
		expect((await Guild.findByPk(guild.id))?.carnivorousFood).toBe(INITIAL_MEAT - 1 + CONCURRENT_FOOD_GAIN);
		expect((await PetEntity.findByPk(player.petId ?? -1))?.lovePoints).toBe(INITIAL_LOVE - loveLost + CONCURRENT_LOVE_GAIN);
	});

	it("petFood keeps the love committed concurrently while the pet eats what it found", async () => {
		const player = await createPetOwner("pet-food-concurrent", OMNIVOROUS_PET_TYPE, null);
		vi.spyOn(randomUtils.RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);
		const pendingWrites: Promise<unknown>[] = [];
		commitConcurrentlyBeforeSave(PetEntity, `UPDATE pet_entities SET lovePoints = lovePoints + ${CONCURRENT_LOVE_GAIN} WHERE id = ${player.petId}`, pendingWrites);

		const response = await runSmallEventAndReact(petFood, player, reaction => reaction.type === "ReactionCollectorPetFoodContinueReaction");
		await Promise.all(pendingWrites);

		const { loveChange } = outcomePacket<{ loveChange: number }>(response, "SmallEventPetFoodPacket");
		expect(loveChange).toBeGreaterThan(0);
		expect(pendingWrites).toHaveLength(1);
		expect((await PetEntity.findByPk(player.petId ?? -1))?.lovePoints).toBe(INITIAL_LOVE + loveChange + CONCURRENT_LOVE_GAIN);
	});
});
