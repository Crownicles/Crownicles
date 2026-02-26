import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { MissionSlot, MissionSlots } from "../../../src/core/database/game/models/MissionSlot";
import Player from "../../../src/core/database/game/models/Player";
import { resetExpeditionStreakMission } from "../../../src/core/missions/ExpeditionStreakUtils";

/**
 * Regression test for bug #4048:
 * When a player has multiple expeditionStreak missions (campaign + side quest),
 * failing an expedition must reset ALL of them, not just the first one found.
 */
describe("resetExpeditionStreakMission", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createMockPlayer(id = 1): Player {
		const player = Object.create(Player.prototype);
		Object.assign(player, { id, keycloakId: "test-kc-id" });
		return player as Player;
	}

	function createMockSlot(overrides: Partial<{
		missionId: string;
		numberDone: number;
		missionObjective: number;
	}> = {}): MissionSlot {
		const slot = Object.create(MissionSlot.prototype);
		Object.assign(slot, {
			missionId: overrides.missionId ?? "expeditionStreak",
			numberDone: overrides.numberDone ?? 3,
			missionObjective: overrides.missionObjective ?? 5,
			save: vi.fn().mockResolvedValue(undefined)
		});
		return slot as MissionSlot;
	}

	it("should reset a single incomplete expeditionStreak mission", async () => {
		const slot = createMockSlot({ numberDone: 3, missionObjective: 5 });
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([slot]);

		await resetExpeditionStreakMission(createMockPlayer());

		expect(slot.numberDone).toBe(0);
		expect(slot.save).toHaveBeenCalledOnce();
	});

	it("should reset ALL incomplete expeditionStreak missions (#4048)", async () => {
		const campaignSlot = createMockSlot({ numberDone: 2, missionObjective: 10 });
		const sideQuestSlot = createMockSlot({ numberDone: 4, missionObjective: 5 });
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([campaignSlot, sideQuestSlot]);

		await resetExpeditionStreakMission(createMockPlayer());

		expect(campaignSlot.numberDone).toBe(0);
		expect(campaignSlot.save).toHaveBeenCalledOnce();
		expect(sideQuestSlot.numberDone).toBe(0);
		expect(sideQuestSlot.save).toHaveBeenCalledOnce();
	});

	it("should not reset completed expeditionStreak missions", async () => {
		const completedSlot = createMockSlot({ numberDone: 5, missionObjective: 5 });
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([completedSlot]);

		await resetExpeditionStreakMission(createMockPlayer());

		expect(completedSlot.numberDone).toBe(5);
		expect(completedSlot.save).not.toHaveBeenCalled();
	});

	it("should only reset incomplete ones when mix of completed and incomplete", async () => {
		const completedSlot = createMockSlot({ numberDone: 5, missionObjective: 5 });
		const incompleteSlot = createMockSlot({ numberDone: 3, missionObjective: 10 });
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([completedSlot, incompleteSlot]);

		await resetExpeditionStreakMission(createMockPlayer());

		expect(completedSlot.numberDone).toBe(5);
		expect(completedSlot.save).not.toHaveBeenCalled();
		expect(incompleteSlot.numberDone).toBe(0);
		expect(incompleteSlot.save).toHaveBeenCalledOnce();
	});

	it("should ignore non-expeditionStreak missions", async () => {
		const otherSlot = createMockSlot({ missionId: "doExpeditions", numberDone: 2 });
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([otherSlot]);

		await resetExpeditionStreakMission(createMockPlayer());

		expect(otherSlot.numberDone).toBe(2);
		expect(otherSlot.save).not.toHaveBeenCalled();
	});

	it("should handle no mission slots gracefully", async () => {
		vi.spyOn(MissionSlots, "getOfPlayer").mockResolvedValue([]);

		await expect(resetExpeditionStreakMission(createMockPlayer())).resolves.toBeUndefined();
	});
});
