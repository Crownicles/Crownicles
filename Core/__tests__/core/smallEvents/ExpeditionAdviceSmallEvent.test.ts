import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/expeditionAdvice";
import { Maps } from "../../../src/core/maps/Maps";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { PotionDataController } from "../../../src/data/Potion";
import { notifyQuestStepCompleted } from "../../../src/core/quests/Quests";
import {
	generateRandomItem, giveItemToPlayer
} from "../../../src/core/utils/ItemUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { FightItemNatures } from "../../../../Lib/src/constants/ItemConstants";
import { QUEST_IDS } from "../../../../Lib/src/constants/QuestConstants";
import {
	ExpeditionAdviceInteractionType, SmallEventExpeditionAdvicePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventExpeditionAdvicePacket";
import {
	asPlayer, createTestPlayer, packetOf, runSmallEvent, TEST_CONTEXT, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/quests/Quests", () => ({
	notifyQuestStepCompleted: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../src/core/utils/ItemUtils", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../src/core/utils/ItemUtils")>();
	return {
		...actual,
		generateRandomItem: vi.fn(actual.generateRandomItem),
		giveItemToPlayer: vi.fn().mockResolvedValue(undefined)
	};
});

const TALISMAN = ExpeditionConstants.TALISMAN_EVENT;
const BONUS = TALISMAN.BONUS_IF_PET_IN_EXPEDITION;
const PET_INFO = {
	petTypeId: 12, petSex: "m", petNickname: "Rex"
};

type TestTalismans = {
	hasTalisman: boolean;
	save: ReturnType<typeof vi.fn>;
};

function mockTalismans(hasTalisman: boolean): TestTalismans {
	const talismans = {
		hasTalisman, save: vi.fn().mockResolvedValue(undefined)
	};
	vi.spyOn(PlayerTalismansManager, "getOfPlayer").mockResolvedValue(talismans as never);
	return talismans;
}

function mockPet(pet: {
	feedCooldown?: number; isFeisty?: boolean;
} = {}): void {
	vi.spyOn(PetEntities, "getById").mockResolvedValue({
		typeId: PET_INFO.petTypeId,
		getBasicInfo: () => PET_INFO,
		getFeedCooldown: () => pet.feedCooldown ?? 1,
		isFeisty: () => pet.isFeisty ?? false
	} as never);
}

/**
 * Integers drawn in order: the bonus points, the roll of the bonus, then the money or the potion rarity
 */
function mockIntegers(...integers: number[]): void {
	const integer = vi.spyOn(RandomUtils.crowniclesRandom, "integer");
	for (const value of integers) {
		integer.mockReturnValueOnce(value);
	}
}

async function meet(player: TestPlayer): Promise<SmallEventExpeditionAdvicePacket> {
	const { response } = await runSmallEvent(smallEventFuncs, player);
	return packetOf(response, SmallEventExpeditionAdvicePacket);
}

describe("Velanna, the expedition advice small event", () => {
	useSmallEventHarness();
	let player: TestPlayer;
	let missionUpdate: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		player = createTestPlayer({
			petId: 5, guildId: 3, level: TALISMAN.TALISMAN_MIN_LEVEL
		});
		missionUpdate = vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(BlessingManager.getInstance(), "getMoneyMultiplier").mockReturnValue(1.5);
		vi.mocked(notifyQuestStepCompleted).mockClear();
		vi.mocked(generateRandomItem).mockClear();
		vi.mocked(giveItemToPlayer).mockClear();
		mockPet();
	});

	it("happens on the continent only", () => {
		vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
		expect(smallEventFuncs.canBeExecuted(asPlayer(player), {} as never)).toBe(true);
		vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);
		expect(smallEventFuncs.canBeExecuted(asPlayer(player), {} as never)).toBe(false);
	});

	describe("player with the talisman", () => {
		beforeEach(() => {
			mockTalismans(true);
			vi.spyOn(PetUtils, "isPetOnExpedition").mockResolvedValue(true);
		});

		it("only gives advice when the pet of the player is not on an expedition", async () => {
			vi.spyOn(PetUtils, "isPetOnExpedition").mockResolvedValue(false);

			const packet = await meet(player);

			expect(missionUpdate).toHaveBeenCalledWith(player, expect.any(Array), { missionId: "meetVelanna" });
			expect(PetUtils.isPetOnExpedition).toHaveBeenCalledWith(player.id);
			expect(packet).toEqual(expect.objectContaining({
				interactionType: ExpeditionAdviceInteractionType.ADVICE, alreadyHasTalisman: true, talismanGiven: false, petInExpedition: false
			}));
			expect(packet.bonusPoints).toBeUndefined();
			expect(player.score).toBe(0);
		});

		it("only gives advice to a player without pet, or whose pet cannot be loaded", async () => {
			player.petId = null;
			expect((await meet(player)).interactionType).toBe(ExpeditionAdviceInteractionType.ADVICE);

			player.petId = 5;
			vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
			expect(await meet(player)).toEqual(expect.objectContaining({
				interactionType: ExpeditionAdviceInteractionType.ADVICE, petInExpedition: false
			}));
			expect(player.score).toBe(0);
		});

		it("always gives points and sometimes nothing more when the pet is on an expedition", async () => {
			mockIntegers(17, BONUS.POTION_THRESHOLD);

			const packet = await meet(player);

			expect(RandomUtils.crowniclesRandom.integer).toHaveBeenNthCalledWith(1, BONUS.POINTS_MIN, BONUS.POINTS_MAX);
			expect(RandomUtils.crowniclesRandom.integer).toHaveBeenNthCalledWith(2, 0, 99);
			expect(packet).toEqual(expect.objectContaining({
				interactionType: ExpeditionAdviceInteractionType.EXPEDITION_BONUS, alreadyHasTalisman: true, talismanGiven: false, petInExpedition: true, bonusPoints: 17, ...PET_INFO
			}));
			expect(packet.bonusMoney).toBeUndefined();
			expect(packet.bonusItem).toBeUndefined();
			expect(packet.bonusCombatPotion).toBeUndefined();
			expect(player.score).toBe(17);
			expect(player.save).toHaveBeenCalled();
			expect(giveItemToPlayer).not.toHaveBeenCalled();
		});

		it("gives a random item on the lowest rolls", async () => {
			mockIntegers(1, BONUS.ITEM_THRESHOLD - 1);

			const packet = await meet(player);

			expect(generateRandomItem).toHaveBeenCalledWith({});
			const item = vi.mocked(generateRandomItem).mock.results[0].value;
			expect(packet.bonusItem?.id).toBe(item.id);
			expect(giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), TEST_CONTEXT, player, item);
			expect(player.money).toBe(1000);
		});

		it.each([BONUS.ITEM_THRESHOLD, BONUS.MONEY_THRESHOLD - 1])("gives money on a roll of %i and shows the blessed amount", async roll => {
			mockIntegers(1, roll, 80);

			const packet = await meet(player);

			expect(RandomUtils.crowniclesRandom.integer).toHaveBeenNthCalledWith(3, BONUS.MONEY_MIN, BONUS.MONEY_MAX);
			expect(player.money).toBe(1080);
			expect(packet.bonusMoney).toBe(120);
			expect(packet.bonusItem).toBeUndefined();
			expect(giveItemToPlayer).not.toHaveBeenCalled();
		});

		it.each([BONUS.MONEY_THRESHOLD, BONUS.POTION_THRESHOLD - 1])("gives a combat potion on a roll of %i", async roll => {
			mockIntegers(1, roll, 6);
			const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick");

			const packet = await meet(player);

			expect(RandomUtils.crowniclesRandom.integer).toHaveBeenNthCalledWith(3, BONUS.COMBAT_POTION_MIN_RARITY, BONUS.COMBAT_POTION_MAX_RARITY);
			expect(pick).toHaveBeenCalledWith(FightItemNatures);
			const potion = PotionDataController.instance.getById(packet.bonusCombatPotion?.id ?? -1);
			expect(potion?.rarity).toBe(6);
			expect(FightItemNatures).toContain(potion?.nature);
			expect(giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), TEST_CONTEXT, player, potion);
			expect(player.money).toBe(1000);
		});
	});

	describe("player without the talisman", () => {
		let talismans: TestTalismans;

		beforeEach(() => {
			talismans = mockTalismans(false);
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(TALISMAN.TALISMAN_INTRO_ENCOUNTERS + 1);
			vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(true);
		});

		it("tells about the talisman and starts the quest on the first encounter", async () => {
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(1);

			const { response } = await runSmallEvent(smallEventFuncs, player);

			expect(LogsReadRequests.getSmallEventEncounterCount).toHaveBeenCalledWith(TEST_CONTEXT.keycloakId, SmallEventConstants.EXPEDITION_ADVICE.SMALL_EVENT_NAME);
			expect(packetOf(response, SmallEventExpeditionAdvicePacket)).toEqual(expect.objectContaining({
				interactionType: ExpeditionAdviceInteractionType.TALISMAN_INTRO, alreadyHasTalisman: false, talismanGiven: false, petInExpedition: false, encounterCount: 1
			}));
			expect(notifyQuestStepCompleted).toHaveBeenCalledWith(response, player, {
				questId: QUEST_IDS.EXPEDITION_TALISMANS, stepId: "meetVelanna"
			});
			expect(talismans.save).not.toHaveBeenCalled();
		});

		it("keeps telling about the talisman during the intro encounters", async () => {
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(TALISMAN.TALISMAN_INTRO_ENCOUNTERS);

			const packet = await meet(player);

			expect(packet).toMatchObject({
				interactionType: ExpeditionAdviceInteractionType.TALISMAN_INTRO, encounterCount: TALISMAN.TALISMAN_INTRO_ENCOUNTERS
			});
			expect(notifyQuestStepCompleted).not.toHaveBeenCalled();
			expect(talismans.hasTalisman).toBe(false);
		});

		it("gives the talisman to a player fulfilling every condition", async () => {
			const { response } = await runSmallEvent(smallEventFuncs, player);

			expect(talismans.hasTalisman).toBe(true);
			expect(talismans.save).toHaveBeenCalled();
			expect(packetOf(response, SmallEventExpeditionAdvicePacket)).toEqual(expect.objectContaining({
				interactionType: ExpeditionAdviceInteractionType.TALISMAN_RECEIVED, talismanGiven: true, alreadyHasTalisman: false, encounterCount: TALISMAN.TALISMAN_INTRO_ENCOUNTERS + 1, ...PET_INFO
			}));
			expect(notifyQuestStepCompleted).toHaveBeenCalledWith(response, player, {
				questId: QUEST_IDS.EXPEDITION_TALISMANS, stepId: "anchorTalisman"
			});
		});

		describe("explains the first missing condition", () => {
			async function expectMissing(interactionType: ExpeditionAdviceInteractionType, withPetInfo = true): Promise<SmallEventExpeditionAdvicePacket> {
				const packet = await meet(player);
				expect(packet).toEqual(expect.objectContaining({
					interactionType,
					talismanGiven: false,
					requiredLevel: TALISMAN.TALISMAN_MIN_LEVEL,
					playerLevel: player.level,
					...withPetInfo ? PET_INFO : {}
				}));
				expect(talismans.hasTalisman).toBe(false);
				expect(talismans.save).not.toHaveBeenCalled();
				expect(notifyQuestStepCompleted).not.toHaveBeenCalled();
				return packet;
			}

			it("to a player without pet", async () => {
				player.petId = null;
				const packet = await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET, false);
				expect(packet.petTypeId).toBeUndefined();
			});

			it("to a player whose pet cannot be loaded", async () => {
				vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
				await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_PET, false);
			});

			it("to a player whose pet is hungry", async () => {
				mockPet({ feedCooldown: 0 });
				await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_HUNGRY);
			});

			it("to a player whose pet is feisty", async () => {
				mockPet({ isFeisty: true });
				await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_FEISTY);
			});

			it("to a player without guild", async () => {
				player.guildId = null;
				await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_NO_GUILD);
			});

			it("to a player whose pet Talvar never saw", async () => {
				vi.spyOn(DwarfPetsSeen, "isPetSeen").mockResolvedValue(false);
				await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR);
				expect(DwarfPetsSeen.isPetSeen).toHaveBeenCalledWith(player, PET_INFO.petTypeId);
			});

			it("to a player of a too low level, with a token as consolation", async () => {
				player.level = TALISMAN.TALISMAN_MIN_LEVEL - 1;
				player.tokens = TokensConstants.MAX - 1;

				const packet = await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW);

				expect(packet).toMatchObject({
					consolationTokenGiven: true, consolationTokensAmount: TALISMAN.LEVEL_TOO_LOW_TOKEN_COMPENSATION
				});
				expect(player.tokens).toBe(TokensConstants.MAX);
			});

			it("to a player of a too low level whose tokens are full, without consolation", async () => {
				player.level = TALISMAN.TALISMAN_MIN_LEVEL - 1;
				player.tokens = TokensConstants.MAX + 1;

				const packet = await expectMissing(ExpeditionAdviceInteractionType.CONDITION_NOT_MET_LEVEL_TOO_LOW);

				expect(packet).toMatchObject({
					consolationTokenGiven: false, consolationTokensAmount: 0
				});
				expect(player.addTokens).not.toHaveBeenCalled();
			});
		});
	});
});
