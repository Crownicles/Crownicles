import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/witch";
import {
	WitchAction, WitchActionDataController, WitchActionFuncs
} from "../../../src/data/WitchAction";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import {
	generateRandomItem, giveItemToPlayer
} from "../../../src/core/utils/ItemUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import {
	ItemCategory, ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../../Lib/src/types/WitchActionOutcomeType";
import { ReactionCollectorWitchReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import { SmallEventWitchResultPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, react, runSmallEvent, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

vi.mock("../../../src/core/utils/ItemUtils", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../src/core/utils/ItemUtils")>();
	return {
		...actual,
		generateRandomItem: vi.fn(actual.generateRandomItem),
		giveItemToPlayer: vi.fn().mockResolvedValue(undefined)
	};
});

// The game loads these functions from the compiled sources: the tests read them from the sources
const witchActionModules = import.meta.glob<{ witchSmallEvent?: WitchActionFuncs }>("../../../src/core/smallEvents/witch/*.ts", { eager: true });
const witchActionFunctions = new Map(Object.entries(witchActionModules)
	.map(([path, module]) => [path.slice(path.lastIndexOf("/") + 1, -".ts".length), module.witchSmallEvent ?? {}]));

const LIFE_LOSS = SmallEventConstants.WITCH.BASE_LIFE_POINTS_REMOVED_AMOUNT;

function witchAction(id: string): WitchAction {
	const action = WitchActionDataController.instance.getById(id);
	if (!action) {
		throw new Error(`Unknown witch action ${id}`);
	}
	return action;
}

function mockDraws(outcome: WitchActionOutcomeType, noEffectPotion = false): void {
	vi.spyOn(WitchAction.prototype, "generateOutcome").mockReturnValue(outcome);
	vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(noEffectPotion);
}

async function chooseIngredient(player: TestPlayer, id: string): Promise<CrowniclesPacket[]> {
	const run = await runSmallEvent(smallEventFuncs, player, { testArgs: ["nothing", id, "bat"] });
	return await react(run, reaction => (reaction.data as ReactionCollectorWitchReaction).id === id);
}

describe("witch small event", () => {
	useSmallEventHarness();
	let applyEffect: ReturnType<typeof vi.spyOn>;
	let missionUpdate: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.spyOn(WitchActionDataController, "getWitchActionFunction").mockImplementation(id => witchActionFunctions.get(id) ?? {});
		applyEffect = vi.spyOn(TravelTime, "applyEffect").mockResolvedValue();
		missionUpdate = vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(RecipeDiscoveryService, "discoverWitchRecipe").mockResolvedValue(null);
		vi.mocked(generateRandomItem).mockClear();
		vi.mocked(giveItemToPlayer).mockClear();
	});

	describe("offered actions", () => {
		function offeredActions(run: Awaited<ReturnType<typeof runSmallEvent>>): WitchAction[] {
			return (run.collector?.creationPacket.reactions ?? []).map(reaction => witchAction((reaction.data as ReactionCollectorWitchReaction).id));
		}

		it("offers an advice, an ingredient and a third distinct action", async () => {
			for (let i = 0; i < 100; i++) {
				const actions = offeredActions(await runSmallEvent(smallEventFuncs, createTestPlayer()));
				expect(actions).toHaveLength(3);
				expect(actions[0].isIngredient).toBe(false);
				expect(actions[1].isIngredient).toBe(true);
				expect(new Set(actions).size).toBe(3);
			}

			const run = await runSmallEvent(smallEventFuncs, createTestPlayer());
			expect(run.response).toContain(run.collector?.creationPacket);
			expect(await ignoresOtherPlayers(run)).toBe(true);
		});

		it("offers a fourth action, which is not to do nothing, to a mystic mage", async () => {
			for (let i = 0; i < 20; i++) {
				const actions = offeredActions(await runSmallEvent(smallEventFuncs, createTestPlayer({ class: ClassConstants.CLASSES_ID.MYSTIC_MAGE })));
				expect(actions).toHaveLength(4);
				expect(new Set(actions).size).toBe(4);
				// The additional action comes third
				expect(actions[2].id).not.toBe("nothing");
			}
		});

		it("offers the actions forced by the test command", async () => {
			const run = await runSmallEvent(smallEventFuncs, createTestPlayer(), { testArgs: ["stir", "rat", "bat"] });
			expect(offeredActions(run).map(action => action.id)).toEqual(["stir", "rat", "bat"]);
		});
	});

	it("does nothing to a player who does not choose", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.NOTHING);

		const response = await endWithoutReaction(await runSmallEvent(smallEventFuncs, player));

		expect(packetOf(response, SmallEventWitchResultPacket)).toMatchObject({
			outcome: WitchActionOutcomeType.NOTHING, ingredientId: "nothing", isIngredient: false, effectId: Effect.OCCUPIED.id, lifeLoss: LIFE_LOSS
		});
		expect(player.health).toBe(100);
		expect(applyEffect).not.toHaveBeenCalled();
		expect(giveItemToPlayer).not.toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	it("hurts the player on a life loss", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.LIFE_LOSS);

		const response = await chooseIngredient(player, "rat");

		expect(packetOf(response, SmallEventWitchResultPacket)).toMatchObject({
			outcome: WitchActionOutcomeType.LIFE_LOSS, ingredientId: "rat", isIngredient: true
		});
		expect(player.health).toBe(100 - LIFE_LOSS);
		expect(giveItemToPlayer).not.toHaveBeenCalled();
	});

	it("gives the potion of the chosen ingredient", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.POTION);

		const response = await chooseIngredient(player, "rat");

		expect(generateRandomItem).toHaveBeenCalledWith({
			maxRarity: ItemRarity.COMMON, subType: ItemNature.ATTACK, itemCategory: ItemCategory.POTION
		});
		const potion = vi.mocked(generateRandomItem).mock.results[0].value;
		expect(giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), expect.anything(), player, potion);
		expect(RecipeDiscoveryService.discoverWitchRecipe).toHaveBeenCalledWith(player, ItemNature.ATTACK);
		expect(packetOf(response, SmallEventWitchResultPacket).discoveredRecipe).toBeUndefined();
		expect(player.health).toBe(100);
		expect(player.save).toHaveBeenCalled();
	});

	it("reveals the recipe of the potion the player discovers", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.POTION);
		const recipe = {
			id: "recipe", level: 2
		};
		vi.spyOn(RecipeDiscoveryService, "discoverWitchRecipe").mockResolvedValue(recipe as never);

		const response = await chooseIngredient(player, "rat");

		expect(packetOf(response, SmallEventWitchResultPacket).discoveredRecipe).toEqual(RecipeDiscoveryService.toDisplayInfo(recipe as never));
		expect(player.save).toHaveBeenCalled();
	});

	it("gives a potion without effect when the ingredient has no potion of its own", async () => {
		mockDraws(WitchActionOutcomeType.POTION);

		await chooseIngredient(createTestPlayer(), "smallWait");

		expect(generateRandomItem).toHaveBeenCalledWith({ itemCategory: ItemCategory.POTION });
		expect(RecipeDiscoveryService.discoverWitchRecipe).toHaveBeenCalledWith(expect.anything(), ItemNature.NONE);
	});

	it("applies the effect of the ingredient and its missions", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.EFFECT);

		const response = await chooseIngredient(player, "beer");

		expect(applyEffect).toHaveBeenCalledWith(player, Effect.DRUNK, undefined, expect.any(Date), expect.anything());
		expect(packetOf(response, SmallEventWitchResultPacket)).toMatchObject({
			outcome: WitchActionOutcomeType.EFFECT, effectId: Effect.DRUNK.id
		});
		expect(missionUpdate).toHaveBeenCalledWith(player, response, {
			missionId: "drinkAlcohol", params: { tags: ["drinkAlcohol"] }
		});
	});

	it("always applies the forced effect of an action, whatever its outcome", async () => {
		const player = createTestPlayer();
		mockDraws(WitchActionOutcomeType.NOTHING);

		const response = await chooseIngredient(player, "stir");

		expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, 5, expect.any(Date), expect.anything());
		expect(packetOf(response, SmallEventWitchResultPacket)).toMatchObject({
			outcome: WitchActionOutcomeType.NOTHING, forceEffect: true, timeLost: 5
		});
	});

	describe("potion without effect, whatever the choice", () => {
		it("replaces the outcome of the chosen action", async () => {
			const player = createTestPlayer();
			mockDraws(WitchActionOutcomeType.LIFE_LOSS, true);

			const response = await chooseIngredient(player, "rat");

			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenCalledWith(SmallEventConstants.WITCH.NO_EFFECT_CHANCE);
			expect(packetOf(response, SmallEventWitchResultPacket).outcome).toBe(WitchActionOutcomeType.POTION);
			expect(generateRandomItem).toHaveBeenCalledWith({
				itemCategory: ItemCategory.POTION, subType: ItemNature.NONE
			});
			expect(giveItemToPlayer).toHaveBeenCalledTimes(1);
			expect(player.health).toBe(100);
			expect(applyEffect).not.toHaveBeenCalled();
			expect(missionUpdate).not.toHaveBeenCalled();
		});

		it("still applies the forced effect of the chosen action", async () => {
			const player = createTestPlayer();
			mockDraws(WitchActionOutcomeType.NOTHING, true);

			await chooseIngredient(player, "stir");

			expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, 5, expect.any(Date), expect.anything());
		});
	});
});
