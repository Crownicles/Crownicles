import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import type { ReactionCollectorInnMealReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import type { Player } from "../../../src/core/database/game/models/Player";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { handleInnMealReaction } from "../../../src/core/report/ReportCityInnService";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logInnMeal: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../src/core/database/game/models/InventorySlot", () => ({
	InventorySlots: {
		getPlayerActiveObjects: vi.fn()
	}
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: {
		update: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));

describe("handleInnMealReaction", () => {
	const activeObjects = {};
	const player = {
		id: 1,
		keycloakId: "inn-meal-player",
		money: 1000,
		fightPointsLost: 10,
		lastMealAt: null as Date | null,
		canEat: vi.fn().mockReturnValue(true),
		nextMealAvailableAt: vi.fn(),
		getCumulativeEnergy: vi.fn().mockReturnValue(5),
		spendMoney: vi.fn(),
		addEnergy: vi.fn(),
		eatMeal: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined),
		getCurrentCityId: vi.fn().mockReturnValue(null)
	};
	const reaction = {
		innId: "inn",
		meal: {
			mealId: "meal",
			price: 100,
			energy: 4
		}
	} as ReactionCollectorInnMealReaction;

	beforeEach(() => {
		vi.clearAllMocks();
		player.money = 1000;
		player.fightPointsLost = 10;
		player.lastMealAt = null;
		player.canEat.mockReturnValue(true);
		player.spendMoney.mockImplementation(async () => {
			player.fightPointsLost = 10;
			player.lastMealAt = null;
		});
		player.addEnergy.mockImplementation(() => {
			player.fightPointsLost = 6;
		});
		player.eatMeal.mockImplementation(() => {
			player.lastMealAt = new Date();
		});
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue(activeObjects as never);
		vi.mocked(withLockedPlayerAndMissions).mockImplementation(async (_playerId, callback) => await callback(player as Player));
	});

	it("applies energy and cooldown after spendMoney reloads the player", async () => {
		await handleInnMealReaction(player as Player, reaction, []);

		expect(player.spendMoney).toHaveBeenCalledWith({
			response: expect.any(Array),
			amount: reaction.meal.price,
			reason: NumberChangeReason.INN_MEAL
		});
		expect(player.fightPointsLost).toBe(6);
		expect(player.lastMealAt).toBeInstanceOf(Date);
		expect(player.spendMoney.mock.invocationCallOrder[0])
			.toBeLessThan(player.addEnergy.mock.invocationCallOrder[0]);
		expect(player.addEnergy.mock.invocationCallOrder[0])
			.toBeLessThan(player.save.mock.invocationCallOrder[0]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), { missionId: "innMeal" });
	});
});
