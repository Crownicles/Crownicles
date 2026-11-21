import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn() }
}));
vi.mock("../../../../src/core/database/game/models/InventorySlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../../src/core/database/game/models/InventorySlot")>(),
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		countObjectsOfPlayer: vi.fn().mockResolvedValue(0),
		getOfPlayer: vi.fn().mockResolvedValue([]),
		getMainSlotsItems: vi.fn()
	}
}));
vi.mock("../../../../src/data/FightAction", async importOriginal => ({
	...await importOriginal<typeof import("../../../../src/data/FightAction")>(),
	FightActionDataController: {
		instance: {
			getListById: vi.fn().mockReturnValue([]),
			getById: (id: string): { id: string } => ({ id })
		}
	}
}));
vi.mock("../../../../src/core/database/game/models/MissionSlot", () => ({
	MissionSlots: { getOfPlayer: vi.fn().mockResolvedValue([]) }
}));
vi.mock("../../../../src/core/utils/ItemUtils", () => ({
	checkDrinkPotionMissions: vi.fn()
}));

import { PlayerFighter } from "../../../../src/core/fights/fighter/PlayerFighter";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import Player from "../../../../src/core/database/game/models/Player";
import { Class } from "../../../../src/data/Class";
import {
	InventorySlot
} from "../../../../src/core/database/game/models/InventorySlot";
import { MissionSlot, MissionSlots } from "../../../../src/core/database/game/models/MissionSlot";
import { FightAction } from "../../../../src/data/FightAction";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { getDayNumber } from "../../../../../Lib/src/utils/TimeUtils";
import { FighterStatus } from "../../../../src/core/fights/FighterStatus";
import type { FightView } from "../../../../src/core/fights/FightView";
import { BlockingUtils } from "../../../../src/core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../../Lib/src/constants/BlockingConstants";
import {
	ItemCategory, ItemConstants
} from "../../../../../Lib/src/constants/ItemConstants";
import { checkDrinkPotionMissions } from "../../../../src/core/utils/ItemUtils";
import { PetUtils } from "../../../../src/core/utils/PetUtils";
import PetEntity, { PetEntities } from "../../../../src/core/database/game/models/PetEntity";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { Maps } from "../../../../src/core/maps/Maps";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { missionInterface as finishWithAttack } from "../../../../src/core/missions/interfaces/finishWithAttack";
import { FightActionController } from "../../../../src/core/fights/actions/FightActionController";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import { required } from "../FightTestData";

function buildPlayer(level = 20): Player {
	return {
		id: 1,
		level,
		petId: null,
		keycloakId: "player-keycloak-id",
		reload: vi.fn(),
		save: vi.fn(),
		drinkPotion: vi.fn(),
		setEnergyLost: vi.fn(),
		getMaxCumulativeEnergy: vi.fn().mockReturnValue(500),
		getCumulativeEnergy: vi.fn().mockReturnValue(120),
		getCumulativeStats: vi.fn().mockReturnValue({
			attack: 10, defense: 10, speed: 10
		}),
		getBaseBreath: vi.fn().mockReturnValue(2),
		getMaxBreath: vi.fn().mockReturnValue(6),
		getBreathRegen: vi.fn().mockReturnValue(2)
	} as unknown as Player;
}

const playerClass = { fightActionsIds: [] } as unknown as Class;

const activeObjects = {
	weapon: {
		item: {}, itemLevel: 0, itemEnchantmentId: null
	},
	armor: {
		item: {}, itemLevel: 0, itemEnchantmentId: null
	},
	potion: { item: {} },
	object: { item: {} }
};

describe("PlayerFighter without consequences", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(activeObjects as never);
	});

	it("fights with full energy whatever the current energy of the player", async () => {
		const fighter = new PlayerFighter(buildPlayer(), playerClass, { withoutConsequences: true });

		await fighter.loadStats();

		expect(fighter.getEnergy()).toBe(500);
	});

	it("does not persist energy loss nor progress missions at the end of the fight", async () => {
		const player = buildPlayer();
		const fighter = new PlayerFighter(player, playerClass, { withoutConsequences: true });
		await fighter.loadStats();
		fighter.damage(200);

		await fighter.endFight(true, [], false, 5);

		expect(player.setEnergyLost).not.toHaveBeenCalled();
		expect(player.save).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("keeps applying consequences to regular fights", async () => {
		const player = buildPlayer();
		const fighter = new PlayerFighter(player, playerClass);
		await fighter.loadStats();

		expect(fighter.getEnergy()).toBe(120);
	});
});

describe("PlayerFighter with a level cap", () => {
	const levelCap = 100;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(activeObjects as never);
	});

	it("fights at the capped level when the player is above it", async () => {
		const player = buildPlayer(150);
		const fighter = new PlayerFighter(player, playerClass, {
			withoutConsequences: true, levelCap
		});

		await fighter.loadStats();

		expect(fighter.level).toBe(levelCap);
		expect(player.getMaxCumulativeEnergy).toHaveBeenCalledWith(activeObjects, levelCap);
		expect(player.getCumulativeStats).toHaveBeenCalledWith(activeObjects, {
			includePotion: false, level: levelCap
		});
	});

	it("keeps the player level when it is below the cap", async () => {
		const player = buildPlayer(42);
		const fighter = new PlayerFighter(player, playerClass, {
			withoutConsequences: true, levelCap
		});

		await fighter.loadStats();

		expect(fighter.level).toBe(42);
		expect(player.getCumulativeStats).toHaveBeenCalledWith(activeObjects, {
			includePotion: false, level: 42
		});
	});
});

const FIGHT_POTION_ID = 12;
const HEALTH_POTION_ID = 1;

function equippedPotion(itemId: number, remainingPotionUsages: number | null = null): InventorySlot {
	return Object.assign(Object.create(InventorySlot.prototype) as InventorySlot, {
		slot: 0, itemCategory: ItemCategory.POTION, itemId, remainingPotionUsages, save: vi.fn()
	});
}

function action(id: string): FightAction {
	return { id } as FightAction;
}

function missionUpdates(): unknown[] {
	return vi.mocked(MissionsController.update).mock.calls.map(call => call[2]);
}

describe("PlayerFighter with consequences", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(activeObjects as never);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
		vi.mocked(MissionSlots.getOfPlayer).mockResolvedValue([]);
	});

	async function foughtFighter(player = buildPlayer()): Promise<PlayerFighter> {
		const fighter = new PlayerFighter(player, playerClass);
		await fighter.loadStats();
		return fighter;
	}

	it("counts its metallic items when loading its stats", async () => {
		vi.mocked(InventorySlots.countObjectsOfPlayer).mockResolvedValueOnce(3);

		const fighter = await foughtFighter();

		expect(fighter.metallicItemCount).toBe(3);
		expect(InventorySlots.countObjectsOfPlayer).toHaveBeenCalledWith(1, ItemConstants.TAGS.METALLIC);
	});

	it("persists the energy lost during the fight from the reloaded player", async () => {
		const player = buildPlayer();
		const fighter = await foughtFighter(player);
		fighter.damage(20);

		await fighter.endFight(false, [], false, 5);

		expect(player.reload).toHaveBeenCalled();
		expect(player.setEnergyLost).toHaveBeenCalledWith(500 - 100, NumberChangeReason.FIGHT, activeObjects);
		expect(player.save).toHaveBeenCalled();
	});

	it("only persists the energy of a bugged fight, without progressing the missions", async () => {
		const player = buildPlayer();
		const fighter = await foughtFighter(player);

		await fighter.endFight(true, [], true, 5);

		expect(player.setEnergyLost).toHaveBeenCalledWith(380, NumberChangeReason.FIGHT, activeObjects);
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("progresses the missions of every fight, counting each action used", async () => {
		const fighter = await foughtFighter();
		fighter.fightActionsHistory = [action("simpleAttack"), action("quickAttack"), action("simpleAttack")];

		await fighter.endFight(false, [], false, 5);

		expect(missionUpdates()).toEqual([
			{
				missionId: "fightAttacks", count: 2, params: { attackType: "simpleAttack" }
			},
			{
				missionId: "fightAttacks", count: 1, params: { attackType: "quickAttack" }
			},
			{ missionId: "anyFight" }
		]);
	});

	it("progresses the pet mission when the pet helped", async () => {
		const fighter = await foughtFighter();
		fighter.markPetAssisted();

		await fighter.endFight(false, [], false, 5);

		expect(missionUpdates()).toContainEqual({ missionId: "petAssistedFight" });
	});

	it("progresses the winning missions with the remaining energy, the last attack and the number of turns", async () => {
		const fighter = await foughtFighter();
		fighter.fightActionsHistory = [action("simpleAttack"), action("quickAttack"), action("heavyAttack")];

		await fighter.endFight(true, [], false, 12);

		expect(missionUpdates().slice(-3)).toEqual([
			{
				missionId: "fightHealthPercent", params: { remainingPercent: 120 / 500 }
			},
			{
				missionId: "finishWithAttack", params: { lastAttack: fighter.fightActionsHistory[2].id }
			},
			{
				missionId: "fightMinTurns", params: { turnCount: 12 }
			}
		]);
	});

	it("lets the last attack of a won fight complete the matching finishWithAttack mission", async () => {
		const fighter = await foughtFighter();
		fighter.fightActionsHistory = [action("heavyAttack")];
		vi.spyOn(FightActionController, "variantToFightActionId").mockReturnValue("heavyAttack");

		await fighter.endFight(true, [], false, 12);

		const finishWithAttackUpdate = required(vi.mocked(MissionsController.update).mock.calls.find(call => call[2].missionId === "finishWithAttack"), "finishWithAttack update");
		expect(finishWithAttack.areParamsMatchingVariantAndBlob(0, required(finishWithAttackUpdate[2].params, "finishWithAttack params"), null)).toBe(true);
	});

	it("does not progress the winning missions after a defeat", async () => {
		const fighter = await foughtFighter();

		await fighter.endFight(false, [], false, 12);

		expect(missionUpdates().map(update => (update as { missionId: string }).missionId)).not.toContain("fightMinTurns");
	});

	describe("fight streak", () => {
		function streakSlot(lastFightDay: number | null): MissionSlot {
			let saveBlob: Buffer | null = null;
			if (lastFightDay !== null) {
				saveBlob = Buffer.alloc(4);
				saveBlob.writeInt32LE(lastFightDay);
			}
			return {
				missionId: "fightStreak", saveBlob
			} as MissionSlot;
		}

		async function streakUpdatesAfterFightOn(lastFightDay: number | null): Promise<unknown[]> {
			vi.mocked(MissionsController.update).mockClear();
			vi.mocked(MissionSlots.getOfPlayer).mockResolvedValue([streakSlot(lastFightDay), {
				missionId: "anyFight", saveBlob: null
			} as MissionSlot]);
			const fighter = await foughtFighter();
			await fighter.endFight(false, [], false, 5);
			return missionUpdates().filter(update => (update as { missionId: string }).missionId === "fightStreak");
		}

		it("extends the streak when the last fight was yesterday", async () => {
			expect(await streakUpdatesAfterFightOn(getDayNumber() - 1)).toEqual([{ missionId: "fightStreak" }]);
		});

		it("does not count a second fight on the same day", async () => {
			expect(await streakUpdatesAfterFightOn(getDayNumber())).toEqual([]);
		});

		it("restarts the streak after a day without fight", async () => {
			const restart = {
				missionId: "fightStreak", count: 1, set: true
			};
			expect(await streakUpdatesAfterFightOn(getDayNumber() - 2)).toEqual([restart]);
			expect(await streakUpdatesAfterFightOn(null)).toEqual([restart]);
		});
	});

	describe("start of the fight", () => {
		it("takes the status given by the fight and blocks the player", async () => {
			const fighter = await foughtFighter();

			await fighter.startFight({} as FightView, FighterStatus.DEFENDER, []);

			expect(fighter.isDeadOrBug()).toBe(false);
			fighter.setStatus(FighterStatus.BUG);
			expect(fighter.isDeadOrBug()).toBe(true);
			expect(BlockingUtils.isPlayerBlockedWithReason("player-keycloak-id", BlockingConstants.REASONS.FIGHT)).toBe(true);
			fighter.unblock();
			expect(BlockingUtils.isPlayerBlockedWithReason("player-keycloak-id", BlockingConstants.REASONS.FIGHT)).toBe(false);
		});

		it("uses one of the remaining usages of the equipped fight potion", async () => {
			const potion = equippedPotion(FIGHT_POTION_ID);
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([potion]);
			const player = buildPlayer();
			const fighter = await foughtFighter(player);

			await fighter.startFight({} as FightView, FighterStatus.ATTACKER, []);

			expect(potion.remainingPotionUsages).toBe(1);
			expect(potion.save).toHaveBeenCalled();
			expect(player.drinkPotion).not.toHaveBeenCalled();
			expect(checkDrinkPotionMissions).toHaveBeenCalledWith([], player, potion.getItem(), [potion]);
		});

		it("considers a potion without stored usages as a full one", async () => {
			const potion = equippedPotion(FIGHT_POTION_ID, 0);
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([potion]);
			const fighter = await foughtFighter();

			await fighter.startFight({} as FightView, FighterStatus.ATTACKER, []);

			expect(potion.remainingPotionUsages).toBe(1);
		});

		it("drinks the potion when its last usage is used", async () => {
			const potion = equippedPotion(FIGHT_POTION_ID, 1);
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([potion]);
			const player = buildPlayer();
			const fighter = await foughtFighter(player);

			await fighter.startFight({} as FightView, FighterStatus.ATTACKER, []);

			expect(player.drinkPotion).toHaveBeenCalledWith(0);
			expect(player.save).toHaveBeenCalled();
			expect(potion.save).not.toHaveBeenCalled();
		});

		it("does not drink a potion that does not help in fights, nor an unequipped one", async () => {
			const unequipped = Object.assign(equippedPotion(FIGHT_POTION_ID), { slot: 1 });
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([unequipped, equippedPotion(HEALTH_POTION_ID)]);
			const player = buildPlayer();
			const fighter = await foughtFighter(player);

			await fighter.startFight({} as FightView, FighterStatus.ATTACKER, []);

			expect(player.drinkPotion).not.toHaveBeenCalled();
			expect(unequipped.save).not.toHaveBeenCalled();
			expect(checkDrinkPotionMissions).not.toHaveBeenCalled();
		});

		it("does not use any potion in a fight without consequences", async () => {
			const fighter = new PlayerFighter(buildPlayer(), playerClass, { withoutConsequences: true });

			await fighter.startFight({} as FightView, FighterStatus.ATTACKER, []);

			expect(InventorySlots.getOfPlayer).not.toHaveBeenCalled();
		});
	});

	describe("pet", () => {
		const PET = { id: 7 } as PetEntity;

		async function petOfFighterWith(params: {
			available: boolean; defending?: boolean;
		}): Promise<PetEntity | undefined> {
			const player = Object.assign(buildPlayer(), { petId: PET.id });
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(params.available);
			vi.spyOn(PetEntities, "getById").mockResolvedValue(PET);
			const fighter = new PlayerFighter(player, playerClass);
			if (params.defending) {
				fighter.setFightRole(FightConstants.FIGHT_ROLES.DEFENDER);
			}
			await fighter.loadStats();
			return fighter.pet;
		}

		it("brings the pet of the player when it is available for an attack", async () => {
			expect(await petOfFighterWith({ available: true })).toBe(PET);
			expect(PetUtils.isPetAvailable).toHaveBeenCalledWith(expect.anything(), PetConstants.AVAILABILITY_CONTEXT.ATTACK_FIGHT);
		});

		it("checks the availability of the pet for a defense when the player defends", async () => {
			await petOfFighterWith({
				available: true, defending: true
			});

			expect(PetUtils.isPetAvailable).toHaveBeenCalledWith(expect.anything(), PetConstants.AVAILABILITY_CONTEXT.DEFENSE_FIGHT);
		});

		it("leaves an unavailable pet at home", async () => {
			expect(await petOfFighterWith({ available: false })).toBeUndefined();
		});
	});

	describe("action choice", () => {
		// Only the action menu of the fight view is used to offer the actions
		function fightView(): FightView & { displayFightActionMenu: ReturnType<typeof vi.fn> } {
			return { displayFightActionMenu: vi.fn() } as unknown as FightView & { displayFightActionMenu: ReturnType<typeof vi.fn> };
		}

		function offeredActions(view: ReturnType<typeof fightView>): string[] {
			return [...(view.displayFightActionMenu.mock.calls[0][2] as Map<string, FightAction>).keys()];
		}

		it("offers the guild attack on the PVE island when guild members are there", async () => {
			// Guild member reduced to the stats the guild attack reads
			const member = {
				id: 2, getCumulativeStats: vi.fn().mockReturnValue({
					attack: 30, defense: 0, speed: 12
				})
			};
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(true);
			vi.spyOn(Maps, "getGuildMembersOnPveIsland").mockResolvedValue([member] as unknown as Player[]);
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);
			const fighter = await foughtFighter();
			const view = fightView();

			await fighter.chooseAction(view, []);
			await fighter.chooseAction(fightView(), []);

			expect(offeredActions(view)).toEqual(["guildAttack"]);
			expect(view.displayFightActionMenu.mock.calls[0][2].get("guildAttack").id).toBe("guildAttack");
			expect(fighter.getPveMembersOnIsland()).toEqual([{
				attack: 30, speed: 12
			}]);
			expect(Maps.getGuildMembersOnPveIsland).toHaveBeenCalledTimes(1);
		});

		it("does not always offer the guild attack", async () => {
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(true);
			// Guild member reduced to the stats the guild attack reads
			vi.spyOn(Maps, "getGuildMembersOnPveIsland").mockResolvedValue([{
				id: 2, getCumulativeStats: vi.fn().mockReturnValue({
					attack: 30, defense: 0, speed: 12
				})
			}] as unknown as Player[]);
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(PVEConstants.GUILD_ATTACK_PROBABILITY);
			const fighter = await foughtFighter();
			const view = fightView();

			await fighter.chooseAction(view, []);

			expect(offeredActions(view)).toEqual([]);
		});

		it("does not offer the guild attack when the draw fails or no member is there", async () => {
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(true);
			vi.spyOn(Maps, "getGuildMembersOnPveIsland").mockResolvedValue([]);
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);
			const fighter = await foughtFighter();
			const view = fightView();

			await fighter.chooseAction(view, []);

			expect(offeredActions(view)).toEqual([]);
		});

		it("does not look for guild members outside of the PVE island", async () => {
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(false);
			vi.spyOn(Maps, "getGuildMembersOnPveIsland").mockResolvedValue([]);
			const fighter = await foughtFighter();

			await fighter.chooseAction(fightView(), []);

			expect(Maps.getGuildMembersOnPveIsland).not.toHaveBeenCalled();
		});
	});
});
