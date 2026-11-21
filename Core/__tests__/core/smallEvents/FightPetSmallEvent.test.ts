import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/fightPet";
import {
	FightPetActionDataController, FightPetActionFunc
} from "../../../src/data/FightPetAction";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ReactionCollectorFightPetReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorFightPet";
import { SmallEventFightPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import {
	createTestPlayer, endWithoutReaction, isBlocked, packetOf, react, runSmallEvent, SmallEventRun, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

// The game loads these functions from the compiled sources: the tests read them from the sources
const fightPetActionModules = import.meta.glob<{ fightPetAction?: FightPetActionFunc }>("../../../src/core/smallEvents/fightPet/*.ts", { eager: true });
const fightPetActionFunctions = new Map(Object.entries(fightPetActionModules)
	.map(([path, module]) => [path.slice(path.lastIndexOf("/") + 1, -".ts".length), module.fightPetAction]));

const LEVEL_TO_UNLOCK = SmallEventConstants.FIGHT_PET.LEVEL_TO_UNLOCK_NEW_ACTION;

function offeredActionIds(run: SmallEventRun): string[] {
	return (run.collector?.creationPacket.reactions ?? []).map(reaction => (reaction.data as ReactionCollectorFightPetReaction).actionId);
}

async function offeredActionsCount(player: TestPlayer): Promise<number> {
	return offeredActionIds(await runSmallEvent(smallEventFuncs, player)).length;
}

describe("fight pet small event", () => {
	useSmallEventHarness();

	beforeEach(() => {
		vi.spyOn(FightPetActionDataController, "getFightPetActionFunction").mockImplementation(id => {
			const action = fightPetActionFunctions.get(id);
			if (!action) {
				throw new Error(`Unknown fight pet action ${id}`);
			}
			return action;
		});
	});

	describe("offered actions", () => {
		it("offers distinct actions against a pet of the game", async () => {
			const run = await runSmallEvent(smallEventFuncs, createTestPlayer({ class: ClassConstants.CLASSES_ID.GUNNER }));

			const actionIds = offeredActionIds(run);
			expect(new Set(actionIds).size).toBe(actionIds.length);
			for (const actionId of actionIds) {
				expect(FightPetActionDataController.instance.getById(actionId)).toBeDefined();
			}
			expect(run.response).toContain(run.collector?.creationPacket);
		});

		it("offers one more action above the unlock level", async () => {
			expect(await offeredActionsCount(createTestPlayer({
				class: ClassConstants.CLASSES_ID.GUNNER, level: LEVEL_TO_UNLOCK
			}))).toBe(SmallEventConstants.FIGHT_PET.BASE_ACTION_AMOUNT);
			expect(await offeredActionsCount(createTestPlayer({
				class: ClassConstants.CLASSES_ID.GUNNER, level: LEVEL_TO_UNLOCK + 1
			}))).toBe(SmallEventConstants.FIGHT_PET.BASE_ACTION_AMOUNT + 1);
		});

		it("offers a bonus action to the infantrymen", async () => {
			for (const infantryClass of [ClassConstants.CLASSES_ID.INFANTRYMAN, ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN]) {
				expect(await offeredActionsCount(createTestPlayer({
					class: infantryClass, level: LEVEL_TO_UNLOCK
				}))).toBe(SmallEventConstants.FIGHT_PET.BASE_ACTION_AMOUNT + 1);
			}
		});

		it("does not offer a bonus action to the recruits and the fighters", async () => {
			for (const otherClass of [ClassConstants.CLASSES_ID.RECRUIT, ClassConstants.CLASSES_ID.FIGHTER]) {
				expect(await offeredActionsCount(createTestPlayer({
					class: otherClass, level: LEVEL_TO_UNLOCK
				}))).toBe(SmallEventConstants.FIGHT_PET.BASE_ACTION_AMOUNT);
			}
		});
	});

	it("makes a player who does not choose do nothing, and enrages them when it works", async () => {
		const player = createTestPlayer({ class: ClassConstants.CLASSES_ID.GUNNER });
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValueOnce(true)
			.mockReturnValueOnce(true);

		const run = await runSmallEvent(smallEventFuncs, player);
		const response = await endWithoutReaction(run);

		expect(RandomUtils.crowniclesRandom.bool).toHaveBeenLastCalledWith(SmallEventConstants.FIGHT_PET.DO_NOTHING_VERY_LUCKY_THRESHOLD);
		expect(packetOf(response, SmallEventFightPetPacket)).toEqual(expect.objectContaining({
			isSuccess: true, fightPetActionId: "doNothing", isFemale: true
		}));
		expect(player.rage).toBe(1);
		expect(player.addRage).toHaveBeenCalledWith(expect.objectContaining({ reason: NumberChangeReason.FIGHT_PET_SMALL_EVENT }));
		expect(player.save).toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	describe("chosen action", () => {
		async function throwRock(player: TestPlayer, success: boolean): Promise<SmallEventFightPetPacket> {
			vi.spyOn(InventorySlots, "countObjectsOfPlayer").mockResolvedValue(0);
			const throwRockAction = FightPetActionDataController.instance.getById("throwRock");
			if (!throwRockAction) {
				throw new Error("Unknown fight pet action throwRock");
			}
			vi.spyOn(FightPetActionDataController.instance, "getRandomFightPetAction").mockReturnValueOnce(throwRockAction);
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValueOnce(false)
				.mockReturnValueOnce(success);
			const run = await runSmallEvent(smallEventFuncs, player);
			return packetOf(await react(run, reaction => (reaction.data as ReactionCollectorFightPetReaction).actionId === "throwRock"), SmallEventFightPetPacket);
		}

		it("enrages the player when the action works", async () => {
			const player = createTestPlayer({ class: ClassConstants.CLASSES_ID.SOLDIER });

			const packet = await throwRock(player, true);

			expect(packet).toEqual(expect.objectContaining({
				isSuccess: true, fightPetActionId: "throwRock", isFemale: false
			}));
			expect(player.rage).toBe(1);
		});

		it("does not enrage the player when the action fails", async () => {
			const player = createTestPlayer({ class: ClassConstants.CLASSES_ID.SOLDIER });

			const packet = await throwRock(player, false);

			expect(packet.isSuccess).toBe(false);
			expect(player.rage).toBe(0);
			expect(player.save).toHaveBeenCalled();
		});
	});
});
