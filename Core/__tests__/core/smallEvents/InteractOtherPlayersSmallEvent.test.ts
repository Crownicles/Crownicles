import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { Op } from "sequelize";
import { smallEventFuncs } from "../../../src/core/smallEvents/interactOtherPlayers";
import Player, { Players } from "../../../src/core/database/game/models/Player";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { LogsDatabase } from "../../../src/core/database/logs/LogsDatabase";
import { LogsPveFightsResults } from "../../../src/core/database/logs/models/LogsPveFightsResults";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import {
	InteractOtherPlayerInteraction,
	SmallEventInteractOtherPlayersAcceptToGivePoorPacket,
	SmallEventInteractOtherPlayersPacket,
	SmallEventInteractOtherPlayersRefuseToGivePoorPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import {
	ReactionCollectorAcceptReaction, ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, reactWith, runSmallEvent, SmallEventRun, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

const { lockedRows } = vi.hoisted(() => ({ lockedRows: { rows: [] as unknown[] } }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn((_keys: unknown, body: (rows: unknown[]) => Promise<unknown>) => body(lockedRows.rows))
}));

const CONSTANTS = SmallEventConstants.INTERACT_OTHER_PLAYERS;
const NUMBER_OF_PLAYERS = 1000;
const PLAYER_RANK = 500;
const I = InteractOtherPlayerInteraction;

type OtherPlayer = TestPlayer & {
	effectId: string;
	underEffect: boolean;
	leagueId: number;
	isUnderEffect: () => boolean;
	getHealth: () => number;
	getLeague: () => { id: number };
};

type Ranks = {
	other: number | null;
	weekly: number;
	glory: number | Error;
};

type TestSlot = {
	itemId: number;
	isWeapon: () => boolean;
	isArmor: () => boolean;
	isPotion: () => boolean;
	isObject: () => boolean;
	isEquipped: () => boolean;
};

function equippedSlot(kind: "weapon" | "armor" | "potion" | "object", itemId: number): TestSlot {
	return {
		itemId,
		isWeapon: () => kind === "weapon",
		isArmor: () => kind === "armor",
		isPotion: () => kind === "potion",
		isObject: () => kind === "object",
		isEquipped: () => true
	};
}

/**
 * A player met on the road who matches none of the specific interactions: only their class can be talked about
 */
function createOtherPlayer(): OtherPlayer {
	const otherPlayer = Object.assign(createTestPlayer({
		id: 2, keycloakId: "other-player", level: 50, class: 3, money: 5000, health: 50
	}), {
		effectId: "none",
		underEffect: false,
		leagueId: 2,
		isUnderEffect: (): boolean => otherPlayer.underEffect,
		getHealth: (): number => otherPlayer.health,
		getLeague: (): { id: number } => ({ id: otherPlayer.leagueId })
	});
	return otherPlayer;
}

describe("interact with other players small event", () => {
	useSmallEventHarness();
	let player: TestPlayer & { getLeague: () => { id: number } };
	let otherPlayer: OtherPlayer;
	let ranks: Ranks;
	let slots: TestSlot[];

	async function meet(): Promise<SmallEventRun> {
		return await runSmallEvent(smallEventFuncs, player);
	}

	/**
	 * Interactions the small event can draw about the met player
	 */
	async function availableInteractions(): Promise<InteractOtherPlayerInteraction[]> {
		const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick");
		await meet();
		return pick.mock.lastCall?.[0] as InteractOtherPlayerInteraction[];
	}

	beforeEach(() => {
		player = Object.assign(createTestPlayer({
			class: 4, money: 1000
		}), {
			getDestinationId: (): number => 7,
			getPreviousMapId: (): number => 6,
			getLeague: (): { id: number } => ({ id: 1 })
		});
		otherPlayer = createOtherPlayer();
		ranks = {
			other: PLAYER_RANK, weekly: CONSTANTS.TOP_WEEK_MAX_RANK + 1, glory: 0
		};
		slots = (["weapon", "armor", "potion", "object"] as const).map(kind => equippedSlot(kind, 0));
		lockedRows.rows = [otherPlayer, player];

		vi.spyOn(Player, "count").mockResolvedValue(NUMBER_OF_PLAYERS as never);
		vi.spyOn(MapLocationDataController.instance, "getPlayersOnMap").mockResolvedValue([{ keycloakId: otherPlayer.keycloakId }]);
		vi.spyOn(Players, "getOrRegister").mockImplementation(() => Promise.resolve(otherPlayer as never));
		vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(Players, "getRankById").mockImplementation(playerId => Promise.resolve((playerId === player.id ? PLAYER_RANK : ranks.other) as number));
		vi.spyOn(Players, "getWeeklyRankById").mockImplementation(() => Promise.resolve(ranks.weekly));
		vi.spyOn(Players, "getGloryRankById").mockImplementation(() => (ranks.glory instanceof Error ? Promise.reject(ranks.glory) : Promise.resolve(ranks.glory)));
		vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ gems: 0 } as never);
		vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue({
			hasTalisman: false, hasCloneTalisman: false
		} as never);
		vi.spyOn(PlayerBadgesManager, "getOfPlayer").mockResolvedValue([]);
		vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(false);
		vi.spyOn(PetUtils, "isPetOnExpedition").mockResolvedValue(false);
		vi.spyOn(Guilds, "getById").mockResolvedValue(null);
		vi.spyOn(InventorySlots, "getOfPlayer").mockImplementation(() => Promise.resolve(slots as never));
		vi.spyOn(LogsDatabase, "findOrCreatePlayer").mockResolvedValue({ id: 22 } as never);
		vi.spyOn(LogsPveFightsResults, "findAll").mockResolvedValue([]);
	});

	describe("nobody to meet", () => {
		it("meets nobody when the player has no destination", async () => {
			Object.assign(player, { getDestinationId: (): null => null });

			const { response } = await meet();

			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).keycloakId).toBeUndefined();
			expect(Players.getOrRegister).not.toHaveBeenCalled();
		});

		it("meets nobody when nobody else travels on the path", async () => {
			vi.spyOn(MapLocationDataController.instance, "getPlayersOnMap").mockResolvedValue([]);

			const { response } = await meet();

			expect(MapLocationDataController.instance.getPlayersOnMap).toHaveBeenCalledWith(7, 6, player.id);
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).playerInteraction).toBeUndefined();
		});

		it("looks on the destination alone when the player has no previous map", async () => {
			Object.assign(player, { getPreviousMapId: (): null => null });
			vi.spyOn(MapLocationDataController.instance, "getPlayersOnMap").mockResolvedValue([]);

			await meet();

			expect(MapLocationDataController.instance.getPlayersOnMap).toHaveBeenCalledWith(7, 7, player.id);
		});
	});

	it("only talks about the class of an ordinary player, and counts the meeting for the missions", async () => {
		expect(await availableInteractions()).toEqual([I.CLASS]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "meetDifferentPlayers", params: { metPlayerKeycloakId: otherPlayer.keycloakId }
		});
		expect(Player.count).toHaveBeenCalledWith({ where: { score: { [Op.gt]: CONSTANTS.MIN_SCORE_FOR_COUNTING } } });
		expect(Guilds.getById).not.toHaveBeenCalled();
	});

	it("describes the met player in the packet", async () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => list[0] as never);
		slots = [equippedSlot("weapon", 11), equippedSlot("armor", 12), equippedSlot("potion", 13), equippedSlot("object", 14)];
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ gems: 42 } as never);
		ranks.glory = 77;
		otherPlayer.tokens = 3;

		const { response } = await meet();

		expect(packetOf(response, SmallEventInteractOtherPlayersPacket)).toEqual(expect.objectContaining({
			keycloakId: otherPlayer.keycloakId,
			playerInteraction: I.CLASS,
			data: expect.objectContaining({
				rank: PLAYER_RANK,
				level: 50,
				classId: 3,
				weaponId: 11,
				armorId: 12,
				potionId: 13,
				objectId: 14,
				effectId: "none",
				leagueId: 2,
				gloryRank: 77,
				gems: 42,
				tokens: 3,
				petId: undefined,
				guildName: undefined,
				bossId: undefined
			})
		}));
	});

	describe("rank", () => {
		it.each([
			[1, I.TOP1],
			[2, I.TOP10],
			[CONSTANTS.TOP_RANKS.TOP10, I.TOP10],
			[CONSTANTS.TOP_RANKS.TOP10 + 1, I.TOP50],
			[CONSTANTS.TOP_RANKS.TOP50, I.TOP50],
			[CONSTANTS.TOP_RANKS.TOP50 + 1, I.TOP100],
			[CONSTANTS.TOP_RANKS.TOP100, I.TOP100]
		])("talks about the top of a player ranked %i", async (rank, interaction) => {
			ranks.other = rank;
			const interactions = await availableInteractions();
			expect(interactions).toContain(interaction);
			expect(interactions).toContain(I.LOWER_RANK_THAN_THEM);
		});

		it("does not talk about the top beyond the hundredth", async () => {
			ranks.other = CONSTANTS.TOP_RANKS.TOP100 + 1;
			expect(await availableInteractions()).not.toContain(I.TOP100);
		});

		it("compares the ranks of the players", async () => {
			ranks.other = PLAYER_RANK + 1;
			expect(await availableInteractions()).toContain(I.BETTER_RANK_THAN_THEM);

			ranks.other = NUMBER_OF_PLAYERS + 1;
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.UNRANKED);
			expect(interactions).not.toContain(I.BETTER_RANK_THAN_THEM);
		});

		it("still ranks the last ranked player", async () => {
			ranks.other = NUMBER_OF_PLAYERS;
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => list[0] as never);

			const { response } = await meet();

			expect(vi.mocked(RandomUtils.crowniclesRandom.pick).mock.lastCall?.[0]).toEqual([I.BETTER_RANK_THAN_THEM, I.CLASS]);
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).data?.rank).toBe(NUMBER_OF_PLAYERS);
		});

		it("hides the rank of an unranked player", async () => {
			ranks.other = NUMBER_OF_PLAYERS + 1;
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => list[0] as never);

			const { response } = await meet();

			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).data?.rank).toBeUndefined();
		});

		it("talks about the top of the week and of the glory", async () => {
			ranks.weekly = CONSTANTS.TOP_WEEK_MAX_RANK;
			ranks.glory = CONSTANTS.TOP_GLORY_MAX_RANK;
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.TOP_WEEK);
			expect(interactions).toContain(I.TOP_GLORY);
		});

		it("does not talk about the glory of a player without glory rank", async () => {
			ranks.glory = CONSTANTS.TOP_GLORY_MAX_RANK + 1;
			expect(await availableInteractions()).not.toContain(I.TOP_GLORY);
			ranks.glory = new Error("no glory");
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => list[0] as never);
			const { response } = await meet();
			expect(vi.mocked(RandomUtils.crowniclesRandom.pick).mock.lastCall?.[0]).not.toContain(I.TOP_GLORY);
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).data?.gloryRank).toBe(-1);
		});
	});

	describe("player state", () => {
		it.each([
			[CONSTANTS.LEVEL.BEGINNER_MAX - 1, I.BEGINNER],
			[CONSTANTS.LEVEL.ADVANCED_MIN, I.ADVANCED]
		])("talks about the experience of a level %i player", async (level, interaction) => {
			otherPlayer.level = level;
			expect(await availableInteractions()).toEqual([interaction, I.CLASS]);
		});

		it("does not talk about the experience of a player of an intermediate level", async () => {
			otherPlayer.level = CONSTANTS.LEVEL.BEGINNER_MAX;
			expect(await availableInteractions()).toEqual([I.CLASS]);
			otherPlayer.level = CONSTANTS.LEVEL.ADVANCED_MIN - 1;
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it("talks about the class and the guild the players share", async () => {
			otherPlayer.class = player.class;
			otherPlayer.guildId = 5;
			player.guildId = 5;
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.SAME_CLASS);
			expect(interactions).toContain(I.SAME_GUILD);
		});

		it("does not talk about sharing no guild or the recruit class", async () => {
			otherPlayer.class = 0;
			player.class = 0;
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it.each([
			[19, I.LOW_HP],
			[100, I.FULL_HP]
		])("talks about the health of a player at %i of 100 health", async (health, interaction) => {
			otherPlayer.health = health;
			expect(await availableInteractions()).toEqual([interaction, I.CLASS]);
		});

		it("does not talk about the health of a player at a fifth of their health", async () => {
			otherPlayer.health = 20;
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it("talks about a rich player", async () => {
			otherPlayer.money = CONSTANTS.MONEY.RICH_MIN + 1;
			expect(await availableInteractions()).toContain(I.RICH);
			otherPlayer.money = CONSTANTS.MONEY.RICH_MIN;
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it("lets a player with money help a poor player", async () => {
			otherPlayer.money = CONSTANTS.MONEY.POOR_MAX - 1;
			expect(await availableInteractions()).toContain(I.POOR);

			otherPlayer.money = CONSTANTS.MONEY.POOR_MAX;
			expect(await availableInteractions()).not.toContain(I.POOR);

			otherPlayer.money = 0;
			player.money = 0;
			expect(await availableInteractions()).not.toContain(I.POOR);
		});

		it("talks about an altered player", async () => {
			otherPlayer.underEffect = true;
			expect(await availableInteractions()).toContain(I.EFFECT);
		});

		it("talks about the equipped items of the player", async () => {
			slots = [equippedSlot("weapon", 1), equippedSlot("armor", 0), equippedSlot("potion", 3), equippedSlot("object", 0)];
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.WEAPON);
			expect(interactions).not.toContain(I.ARMOR);
			expect(interactions).toContain(I.POTION);
			expect(interactions).not.toContain(I.OBJECT);

			slots = [equippedSlot("weapon", 0), equippedSlot("armor", 2), equippedSlot("potion", 0), equippedSlot("object", 4)];
			expect(await availableInteractions()).toEqual([I.CLASS, I.ARMOR, I.OBJECT]);
		});

		it("ignores the items of the backpack", async () => {
			slots = [
				{
					...equippedSlot("weapon", 7), isEquipped: (): boolean => false
				},
				{
					...equippedSlot("potion", 9), isEquipped: (): boolean => false
				},
				...(["weapon", "armor", "potion", "object"] as const).map(kind => equippedSlot(kind, 0))
			];
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => list[0] as never);

			const { response } = await meet();

			expect(vi.mocked(RandomUtils.crowniclesRandom.pick).mock.lastCall?.[0]).toEqual([I.CLASS]);
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).data).toMatchObject({
				weaponId: 0, potionId: 0
			});
		});

		it("talks about the league of the player", async () => {
			otherPlayer.leagueId = CONSTANTS.HIGH_LEAGUE_MIN_ID;
			expect(await availableInteractions()).toContain(I.HIGH_LEAGUE);

			otherPlayer.leagueId = 1;
			expect(await availableInteractions()).toEqual([I.CLASS, I.SAME_LEAGUE]);
		});

		it("talks about the gems and the tokens of the player", async () => {
			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ gems: CONSTANTS.MANY_GEMS_MIN } as never);
			otherPlayer.tokens = CONSTANTS.MANY_TOKENS_MIN;
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.MANY_GEMS);
			expect(interactions).toContain(I.MANY_TOKENS);

			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ gems: CONSTANTS.MANY_GEMS_MIN - 1 } as never);
			otherPlayer.tokens = CONSTANTS.MANY_TOKENS_MIN - 1;
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it("talks about the talismans of the player, the clone one first", async () => {
			vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue({
				hasTalisman: true, hasCloneTalisman: false
			} as never);
			expect(await availableInteractions()).toContain(I.HAS_TALISMAN);

			vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue({
				hasTalisman: true, hasCloneTalisman: true
			} as never);
			const interactions = await availableInteractions();
			expect(interactions).toContain(I.HAS_CLONE_TALISMAN);
			expect(interactions).not.toContain(I.HAS_TALISMAN);
		});

		it("talks once about each badge kind of the player", async () => {
			vi.spyOn(PlayerBadgesManager, "getOfPlayer").mockResolvedValue([Badge.POWERFUL_GUILD, Badge.VERY_POWERFUL_GUILD, Badge.TECHNICAL_TEAM, Badge.ANIMAL_LOVER]);
			expect(await availableInteractions()).toEqual([I.POWERFUL_GUILD, I.STAFF_MEMBER, I.ANIMAL_LOVER, I.CLASS]);
		});
	});

	describe("guild", () => {
		it.each([
			["chief", { chiefId: 2, elderId: 9 }, I.GUILD_CHIEF],
			["elder", { chiefId: 9, elderId: 2 }, I.GUILD_ELDER]
		])("talks about the guild %s and names the guild", async (_role, roles, interaction) => {
			otherPlayer.guildId = 5;
			vi.spyOn(Guilds, "getById").mockResolvedValue({
				name: "Les Crownicleurs", ...roles
			} as never);
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(interaction) ? interaction : list[0]) as never);

			const { response } = await meet();

			expect(Guilds.getById).toHaveBeenCalledWith(5);
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket)).toMatchObject({
				playerInteraction: interaction, data: { guildName: "Les Crownicleurs" }
			});
		});

		it("does not talk about a simple member", async () => {
			otherPlayer.guildId = 5;
			vi.spyOn(Guilds, "getById").mockResolvedValue({
				name: "Les Crownicleurs", chiefId: 9, elderId: 8
			} as never);
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});
	});

	describe("pet", () => {
		function mockPets(otherPetTypeId: number, playerPetTypeId: number | null, tags: string[] = []): void {
			otherPlayer.petId = 20;
			player.petId = playerPetTypeId === null ? null : 10;
			vi.spyOn(PetEntities, "getById").mockImplementation(petId => Promise.resolve((petId === 20
				? {
					typeId: otherPetTypeId, nickname: "Rex", sex: "m"
				}
				: petId === 10 ? { typeId: playerPetTypeId } : null) as never));
			vi.spyOn(PetDataController.instance, "getById").mockReturnValue({ hasTag: (tag: string) => tags.includes(tag) } as never);
		}

		it("talks about the pet of the player and describes it", async () => {
			mockPets(3, null);
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(I.PET) ? I.PET : list[0]) as never);

			const { response } = await meet();

			expect(packetOf(response, SmallEventInteractOtherPlayersPacket)).toMatchObject({
				playerInteraction: I.PET, data: {
					petName: "Rex", petId: 3, petSex: "m"
				}
			});
		});

		it("talks about a pet on an expedition or a clone instead", async () => {
			mockPets(3, null);
			vi.spyOn(PetUtils, "isPetOnExpedition").mockResolvedValue(true);
			let interactions = await availableInteractions();
			expect(interactions).toContain(I.PET_ON_EXPEDITION);
			expect(interactions).not.toContain(I.PET);
			expect(PetUtils.isPetOnExpedition).toHaveBeenCalledWith(otherPlayer.id);

			vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(true);
			interactions = await availableInteractions();
			expect(interactions).toContain(I.PET_CLONE);
			expect(interactions).not.toContain(I.PET_ON_EXPEDITION);
		});

		it("talks about the same kind of pet rather than the pet", async () => {
			mockPets(3, 3);
			expect(await availableInteractions()).toEqual([I.CLASS, I.SAME_PET]);
		});

		it("keeps the other interactions when the pet of the same kind is a clone", async () => {
			mockPets(3, 3);
			vi.spyOn(PetUtils, "isPetClone").mockResolvedValue(true);
			expect(await availableInteractions()).toEqual([I.PET_CLONE, I.CLASS, I.SAME_PET]);
		});

		it("does not talk about the pet of a player without pet", async () => {
			mockPets(3, 4);
			otherPlayer.petId = null;
			vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
			expect(await availableInteractions()).toEqual([I.CLASS]);
		});

		it("does not talk about the kind of an unknown pet", async () => {
			mockPets(3, 4);
			vi.spyOn(PetDataController.instance, "getById").mockReturnValue(undefined);
			expect(await availableInteractions()).toEqual([I.PET, I.CLASS]);
		});

		it.each([
			[PetConstants.TAGS.FLYING, I.FLYING_PET],
			[PetConstants.TAGS.AQUATIC, I.AQUATIC_PET]
		])("talks about a %s pet", async (tag, interaction) => {
			mockPets(3, 4, [tag]);
			expect(await availableInteractions()).toEqual([I.PET, I.CLASS, interaction]);
		});
	});

	describe("boss kills", () => {
		it("talks about each final boss the player beat, with their best level", async () => {
			vi.spyOn(LogsPveFightsResults, "findAll").mockResolvedValue([
				{
					monsterId: "kraken", monsterLevel: 3
				},
				{
					monsterId: "kraken", monsterLevel: 5
				},
				{
					monsterId: "kraken", monsterLevel: 4
				},
				{
					monsterId: "magmaTitan", monsterLevel: 1
				}
			] as never);
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(I.BEATEN_KRAKEN) ? I.BEATEN_KRAKEN : list[0]) as never);

			const { response } = await meet();

			expect(LogsDatabase.findOrCreatePlayer).toHaveBeenCalledWith(otherPlayer.keycloakId);
			expect(LogsPveFightsResults.findAll).toHaveBeenCalledWith({
				where: {
					playerId: 22,
					monsterId: { [Op.in]: ["magmaTitan", "maleIceDragon", "femaleIceDragon", "kraken", "leviathan"] },
					winner: 1
				}
			});
			expect(vi.mocked(RandomUtils.crowniclesRandom.pick).mock.lastCall?.[0]).toEqual(expect.arrayContaining([I.BEATEN_KRAKEN, I.BEATEN_MAGMA_TITAN]));
			expect(packetOf(response, SmallEventInteractOtherPlayersPacket).data).toMatchObject({
				bossId: "kraken", bossLevel: 5
			});
		});

		it("does not look for the boss kills of a player unknown to the logs", async () => {
			vi.spyOn(LogsDatabase, "findOrCreatePlayer").mockResolvedValue(null);
			expect(await availableInteractions()).toEqual([I.CLASS]);
			expect(LogsPveFightsResults.findAll).not.toHaveBeenCalled();
		});
	});

	describe("poor player", () => {
		async function meetPoorPlayer(): Promise<SmallEventRun> {
			otherPlayer.money = 0;
			ranks.other = 3;
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(I.POOR) ? I.POOR : list[0]) as never);
			return await meet();
		}

		it("asks the player to give a coin to the poor player", async () => {
			const run = await meetPoorPlayer();

			expect(run.collector?.creationPacket.data.data).toMatchObject({
				keycloakId: otherPlayer.keycloakId, rank: 3
			});
			expect(run.response).toContain(run.collector?.creationPacket);
			expect(isBlocked(player)).toBe(true);
			expect(await ignoresOtherPlayers(run)).toBe(true);
		});

		it("transfers a coin when the player accepts", async () => {
			const response = await reactWith(await meetPoorPlayer(), ReactionCollectorAcceptReaction);

			expect(response.some(packet => packet instanceof SmallEventInteractOtherPlayersAcceptToGivePoorPacket)).toBe(true);
			expect(withLockedEntities).toHaveBeenCalled();
			expect(player.money).toBe(999);
			expect(otherPlayer.money).toBe(1);
			expect(otherPlayer.addMoney).toHaveBeenCalledWith(expect.objectContaining({ reason: NumberChangeReason.RECEIVE_COIN }));
			expect(player.save).toHaveBeenCalled();
			expect(otherPlayer.save).toHaveBeenCalled();
			expect(PlayerMissionsInfos.getOfPlayer).toHaveBeenCalledWith(player.id);
			expect(isBlocked(player)).toBe(false);
		});

		it("transfers the last coin of the player", async () => {
			const run = await meetPoorPlayer();
			player.money = 1;

			await reactWith(run, ReactionCollectorAcceptReaction);

			expect(player.money).toBe(0);
			expect(otherPlayer.money).toBe(1);
		});

		it("transfers nothing when the player spent their last coin in the meantime", async () => {
			const run = await meetPoorPlayer();
			player.money = 0;

			const response = await reactWith(run, ReactionCollectorAcceptReaction);

			expect(response.some(packet => packet instanceof SmallEventInteractOtherPlayersAcceptToGivePoorPacket)).toBe(true);
			expect(otherPlayer.money).toBe(0);
			expect(otherPlayer.save).not.toHaveBeenCalled();
		});

		it.each([
			["refuses", (run: SmallEventRun): ReturnType<typeof endWithoutReaction> => reactWith(run, ReactionCollectorRefuseReaction)],
			["does not answer", endWithoutReaction]
		])("keeps the coin when the player %s", async (_case, answer) => {
			const response = await answer(await meetPoorPlayer());

			expect(response.some(packet => packet instanceof SmallEventInteractOtherPlayersRefuseToGivePoorPacket)).toBe(true);
			expect(player.money).toBe(1000);
			expect(otherPlayer.money).toBe(0);
			expect(isBlocked(player)).toBe(false);
		});
	});
});
