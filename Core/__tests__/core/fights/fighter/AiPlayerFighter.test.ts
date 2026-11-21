import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../src/core/database/game/models/InventorySlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../../src/core/database/game/models/InventorySlot")>(),
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		countObjectsOfPlayer: vi.fn().mockResolvedValue(0),
		getOfPlayer: vi.fn().mockResolvedValue([])
	}
}));

import { AiPlayerFighter } from "../../../../src/core/fights/fighter/AiPlayerFighter";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import Player from "../../../../src/core/database/game/models/Player";
import { Class } from "../../../../src/data/Class";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import PetEntity, { PetEntities } from "../../../../src/core/database/game/models/PetEntity";
import { PetUtils } from "../../../../src/core/utils/PetUtils";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { FighterStatus } from "../../../../src/core/fights/FighterStatus";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import type { FightView } from "../../../../src/core/fights/FightView";
import type { FightController } from "../../../../src/core/fights/FightController";
import type { ClassBehavior } from "../../../../src/core/fights/AiBehaviorController";
import {
	fightActionById
} from "../FightTestData";

// Class data reduced to what the AI fighter reads
const AI_CLASS = {
	id: 0, fightActionsIds: [FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK]
} as unknown as Class;
const PET = { id: 4 } as PetEntity;

// Equipment only passed through to the player model, whose stat methods are mocked
const activeObjects = {
	weapon: {
		item: {}, itemLevel: 0, itemEnchantmentId: null
	},
	armor: {
		item: {}, itemLevel: 0, itemEnchantmentId: null
	},
	potion: { item: {} },
	object: { item: {} }
} as unknown as PlayerActiveObjects;

function buildPlayer(petId: number | null = null): Player {
	// Player model without database, exposing the methods the AI fighter calls
	return {
		id: 3,
		level: 120,
		petId,
		getGloryPoints: vi.fn().mockReturnValue(1500),
		getMaxCumulativeEnergy: vi.fn().mockReturnValue(800),
		getCumulativeEnergy: vi.fn().mockReturnValue(10),
		getCumulativeStats: vi.fn().mockReturnValue({
			attack: 10, defense: 10, speed: 10
		}),
		getBaseBreath: vi.fn().mockReturnValue(2),
		getMaxBreath: vi.fn().mockReturnValue(6),
		getBreathRegen: vi.fn().mockReturnValue(2)
	} as unknown as Player;
}

function fightViewPlaying(): {
	fightView: FightView; executeFightAction: ReturnType<typeof vi.fn>; displayAiChooseAction: ReturnType<typeof vi.fn>;
} {
	const executeFightAction = vi.fn();
	const displayAiChooseAction = vi.fn();
	// Only the parts of the fight view the AI fighter uses to play its action
	return {
		fightView: {
			displayAiChooseAction,
			fightController: { executeFightAction } as unknown as FightController
		} as unknown as FightView,
		executeFightAction,
		displayAiChooseAction
	};
}

describe("AiPlayerFighter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(activeObjects);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("defends with its full energy, whatever the current energy of the player", async () => {
		const player = buildPlayer();
		const fighter = new AiPlayerFighter(player, AI_CLASS, { levelCap: 100 });

		await fighter.loadStats();

		expect([fighter.getEnergy(), fighter.getMaxEnergy(), fighter.level]).toEqual([800, 800, 100]);
		expect(player.getMaxCumulativeEnergy).toHaveBeenCalledWith(activeObjects, 100);
		expect(player.getCumulativeStats).toHaveBeenCalledWith(activeObjects, {
			includePotion: true, level: 100
		});
	});

	it("leaves its potion out of a fight without consequences and uses the preloaded equipment", async () => {
		const player = buildPlayer();
		const preloaded = { ...activeObjects };
		const fighter = new AiPlayerFighter(player, AI_CLASS, {
			withoutConsequences: true, preloadedActiveObjects: preloaded
		});

		await fighter.loadStats();

		expect(InventorySlots.getPlayerActiveObjects).not.toHaveBeenCalled();
		expect(player.getCumulativeStats).toHaveBeenCalledWith(preloaded, {
			includePotion: false, level: 120
		});
	});

	describe("pet", () => {
		async function petOf(player: Player, options: ConstructorParameters<typeof AiPlayerFighter>[2] = {}, attacking = false): Promise<PetEntity | undefined> {
			vi.spyOn(PetEntities, "getById").mockResolvedValue(PET);
			const fighter = new AiPlayerFighter(player, AI_CLASS, options);
			if (attacking) {
				fighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
			}
			await fighter.loadStats();
			return fighter.pet;
		}

		it("brings the pet of the player when it is available for a defense", async () => {
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);

			expect(await petOf(buildPlayer(PET.id))).toBe(PET);
			expect(PetUtils.isPetAvailable).toHaveBeenCalledWith(expect.anything(), PetConstants.AVAILABILITY_CONTEXT.DEFENSE_FIGHT);
		});

		it("checks the availability of the pet for an attack when the AI attacks", async () => {
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);

			await petOf(buildPlayer(PET.id), {}, true);

			expect(PetUtils.isPetAvailable).toHaveBeenCalledWith(expect.anything(), PetConstants.AVAILABILITY_CONTEXT.ATTACK_FIGHT);
		});

		it("leaves an unavailable pet, or no pet, at home", async () => {
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(false);

			expect(await petOf(buildPlayer(PET.id))).toBeUndefined();
			expect(await petOf(buildPlayer(null))).toBeUndefined();
			expect(PetUtils.isPetAvailable).toHaveBeenCalledTimes(1);
		});

		it("uses the preloaded pet without loading it, even when there is none", async () => {
			const isPetAvailable = vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
			const preloadedPet = { id: 9 } as PetEntity;

			expect(await petOf(buildPlayer(PET.id), { preloadedPetEntity: preloadedPet })).toBe(preloadedPet);
			expect(await petOf(buildPlayer(PET.id), { preloadedPetEntity: null })).toBeUndefined();
			expect(isPetAvailable).not.toHaveBeenCalled();
		});
	});

	describe("potion", () => {
		it("may drink its potion at the start of the fight", async () => {
			vi.spyOn(Math, "random").mockReturnValue(FightConstants.POTION_NO_DRINK_PROBABILITY.AI);
			const fighter = new AiPlayerFighter(buildPlayer(), AI_CLASS);

			await fighter.startFight({} as FightView, FighterStatus.DEFENDER, []);

			expect(InventorySlots.getOfPlayer).toHaveBeenCalledWith(3);
		});

		it("sometimes forgets to drink its potion", async () => {
			vi.spyOn(Math, "random").mockReturnValue(FightConstants.POTION_NO_DRINK_PROBABILITY.AI - 0.01);
			const fighter = new AiPlayerFighter(buildPlayer(), AI_CLASS);

			await fighter.startFight({} as FightView, FighterStatus.DEFENDER, []);

			expect(InventorySlots.getOfPlayer).not.toHaveBeenCalled();
		});

		it("never drinks a potion when it is not allowed to", async () => {
			vi.spyOn(Math, "random").mockReturnValue(0.99);
			const fighter = new AiPlayerFighter(buildPlayer(), AI_CLASS, { allowPotionConsumption: false });

			await fighter.startFight({} as FightView, FighterStatus.DEFENDER, []);

			expect(InventorySlots.getOfPlayer).not.toHaveBeenCalled();
		});
	});

	describe("action choice", () => {
		it("plays the action chosen by its class behavior after a thinking time", async () => {
			const chosenAction = fightActionById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK);
			const classBehavior: ClassBehavior = { chooseAction: vi.fn().mockReturnValue(chosenAction) };
			const fighter = new AiPlayerFighter(buildPlayer(), AI_CLASS, { classBehavior });
			const {
				fightView, executeFightAction, displayAiChooseAction
			} = fightViewPlaying();
			vi.spyOn(RandomUtils, "randInt").mockReturnValue(900);

			await fighter.chooseAction(fightView, []);

			expect(RandomUtils.randInt).toHaveBeenCalledWith(800, 2500);
			expect(displayAiChooseAction).toHaveBeenCalledWith([], 900);
			expect(classBehavior.chooseAction).toHaveBeenCalledWith(fighter, fightView);
			expect(executeFightAction).toHaveBeenCalledWith(chosenAction, true, []);
		});

		it("falls back to a simple attack for a class without behavior", async () => {
			// Class data reduced to what the AI fighter reads
			const unknownClass = {
				id: 9999, fightActionsIds: []
			} as unknown as Class;
			const fighter = new AiPlayerFighter(buildPlayer(), unknownClass);
			const { fightView, executeFightAction } = fightViewPlaying();

			await fighter.chooseAction(fightView, []);

			expect(executeFightAction.mock.calls[0][0].id).toBe(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK);
		});
	});
});
