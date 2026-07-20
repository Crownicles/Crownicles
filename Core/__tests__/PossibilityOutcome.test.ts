import {
	describe, expect, it, vi
} from "vitest";
import { NumberChangeReason } from "../../Lib/src/constants/LogsConstants";
import {
	CrowniclesPacket, PacketContext
} from "../../Lib/src/packets/CrowniclesPacket";
import Player from "../src/core/database/game/models/Player";
import { applyPossibilityOutcome } from "../src/data/events/PossibilityOutcome";

vi.mock("../src/core/database/game/models/InventorySlot", () => ({
	InventorySlots: { getPlayerActiveObjects: vi.fn().mockResolvedValue({}) }
}));

vi.mock("../src/core/database/game/models/PlayerSmallEvent", () => ({
	PlayerSmallEvents: { calculateCurrentScore: vi.fn().mockResolvedValue(0) }
}));

vi.mock("../src/core/maps/TravelTime", () => ({
	TravelTime: { timeTravelledToScore: vi.fn().mockReturnValue(0) }
}));

vi.mock("../../Lib/src/utils/RandomUtils", () => ({
	RandomUtils: {
		crowniclesRandom: {
			bool: vi.fn(),
			integer: vi.fn().mockReturnValue(0),
			pick: vi.fn()
		}
	}
}));

describe("applyPossibilityOutcome", () => {
	it("keeps experience and health gained when experience reloads the player", async () => {
		const persistedHealth = 1;
		const initialExperience = 100;
		let currentHealth = persistedHealth;
		let currentExperience = initialExperience;
		const player = Object.create(Player.prototype) as Player;
		Object.assign(player, {
			id: 1,
			level: 10,
			effectDuration: 0,
			effectId: "",
			addEnergy: vi.fn(),
			addExperience: vi.fn(async ({ amount }: { amount: number }) => {
				currentHealth = persistedHealth;
				currentExperience += amount;
				return player;
			}),
			addHealth: vi.fn(async ({ amount }: { amount: number }) => {
				currentHealth += amount;
				return true;
			}),
			addMoney: vi.fn().mockResolvedValue(undefined),
			addScore: vi.fn().mockResolvedValue(undefined),
			addTokens: vi.fn().mockResolvedValue(undefined),
			setLastReportWithEffect: vi.fn().mockResolvedValue(undefined)
		});
		const response: CrowniclesPacket[] = [];

		await applyPossibilityOutcome({
			eventId: 67,
			possibilityName: "accept",
			outcome: ["1", { health: 15 }],
			time: 0
		}, player, {} as PacketContext, response);

		expect(player.addExperience).toHaveBeenCalledWith({
			amount: expect.any(Number),
			reason: NumberChangeReason.BIG_EVENT,
			response
		});
		expect(player.addHealth).toHaveBeenCalledWith({
			amount: 15,
			reason: NumberChangeReason.BIG_EVENT,
			response
		});
		expect(vi.mocked(player.addExperience).mock.invocationCallOrder[0])
			.toBeLessThan(vi.mocked(player.addHealth).mock.invocationCallOrder[0]);
		expect(currentExperience).toBeGreaterThan(initialExperience);
		expect(currentHealth).toBe(16);
	});
});