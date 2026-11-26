import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { NumberChangeReason } from "../../Lib/src/constants/LogsConstants";
import {
	CrowniclesPacket, PacketContext
} from "../../Lib/src/packets/CrowniclesPacket";
import Player from "../src/core/database/game/models/Player";
import { applyPossibilityOutcome } from "../src/data/events/PossibilityOutcome";
import PetEntity from "../src/core/database/game/models/PetEntity";
import { MissionsController } from "../src/core/missions/MissionsController";
import { Crownicles } from "../src/core/bot/Crownicles";
import { setCrowniclesInstanceForTests } from "../src/app";
import { PetConstants } from "../../Lib/src/constants/PetConstants";
import { CommandReportBigEventResultRes } from "../../Lib/src/packets/commands/CommandReportPacket";

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

vi.mock("../src/core/blessings/BlessingManager", () => ({
	BlessingManager: {
		getInstance: () => ({
			applyMoneyBlessing: (amount: number): number => amount,
			getPetLoveMultiplier: (): number => 1
		})
	}
}));

describe("applyPossibilityOutcome", () => {
	it("persists money lost before experience reloads the player", async () => {
		let persistedMoney = 1000;
		const player = Object.create(Player.prototype) as Player;
		Object.assign(player, {
			id: 1,
			level: 10,
			money: persistedMoney,
			effectDuration: 0,
			effectId: "",
			addEnergy: vi.fn(),
			addExperience: vi.fn(async () => {
				player.money = persistedMoney;
				return player;
			}),
			addHealth: vi.fn().mockResolvedValue(undefined),
			addMoney: vi.fn(async ({ amount }: { amount: number }) => {
				player.money += amount;
				return player;
			}),
			addScore: vi.fn().mockResolvedValue(undefined),
			addTokens: vi.fn().mockResolvedValue(undefined),
			save: vi.fn(async () => {
				persistedMoney = player.money;
				return player;
			}),
			setLastReportWithEffect: vi.fn().mockResolvedValue(undefined)
		});

		await applyPossibilityOutcome({
			eventId: 1,
			possibilityName: "loseMoney",
			outcome: ["1", { money: -100 }],
			time: 0
		}, player, {} as PacketContext, []);

		expect(player.money).toBe(900);
		expect(player.save).toHaveBeenCalledOnce();
		expect(vi.mocked(player.save).mock.invocationCallOrder[0])
			.toBeLessThan(vi.mocked(player.addExperience).mock.invocationCallOrder[0]);
	});

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

	it.each([
		[true, 1],
		[false, 0]
	])("persists the bed use only when the outcome puts the player to bed (useBed: %s)", async (useBed, bedSaves) => {
		const lockedRow = Object.assign(Object.create(Player.prototype) as Player, {
			lastBedUsedAt: null,
			save: vi.fn().mockResolvedValue(undefined)
		});
		vi.spyOn(Player, "withLocked").mockImplementation(async (_id, mutation) => await mutation(lockedRow as never));
		const player = Object.create(Player.prototype) as Player;
		Object.assign(player, {
			id: 1,
			level: 10,
			lastBedUsedAt: null,
			effectDuration: 0,
			effectId: "",

			// The bare prototype has no Sequelize attribute setters, so the change tracking a real instance owns is provided here.
			_changed: new Set<string>(),
			addEnergy: vi.fn(),
			addExperience: vi.fn().mockResolvedValue(undefined),
			addHealth: vi.fn().mockResolvedValue(undefined),
			addMoney: vi.fn().mockResolvedValue(undefined),
			addScore: vi.fn().mockResolvedValue(undefined),
			addTokens: vi.fn().mockResolvedValue(undefined),
			setLastReportWithEffect: vi.fn().mockResolvedValue(undefined)
		});

		await applyPossibilityOutcome({
			eventId: 13,
			possibilityName: "goInn",
			outcome: ["0", { effect: "sleeping", useBed }],
			time: 0
		}, player, {} as PacketContext, []);

		expect(lockedRow.save).toHaveBeenCalledTimes(bedSaves);
		expect(player.lastBedUsedAt !== null).toBe(useBed);
		vi.restoreAllMocks();
	});

	describe("Pet love", () => {
		beforeEach(() => {
			setCrowniclesInstanceForTests({
				logsDatabase: { logPetLoveChange: vi.fn().mockResolvedValue(undefined) }
			} as unknown as Crownicles); // Only the log used by the pet love changes
			vi.spyOn(MissionsController, "update").mockResolvedValue(undefined);
		});

		afterEach(() => {
			setCrowniclesInstanceForTests(null);
			vi.restoreAllMocks();
		});

		const makePlayer = (): Player => Object.assign(Object.create(Player.prototype) as Player, {
			id: 1,
			level: 10,
			effectDuration: 0,
			effectId: "",
			addEnergy: vi.fn(),
			addExperience: vi.fn().mockResolvedValue(undefined),
			addHealth: vi.fn().mockResolvedValue(undefined),
			addMoney: vi.fn().mockResolvedValue(undefined),
			addScore: vi.fn().mockResolvedValue(undefined),
			addTokens: vi.fn().mockResolvedValue(undefined),
			setLastReportWithEffect: vi.fn().mockResolvedValue(undefined)
		});
		const resultPacket = (response: CrowniclesPacket[]): CommandReportBigEventResultRes =>
			response.find(packet => packet instanceof CommandReportBigEventResultRes) as CommandReportBigEventResultRes;

		it("saves the love the pet won and shows the change actually applied, capped at the maximum", async () => {
			const pet = Object.assign(Object.create(PetEntity.prototype) as PetEntity, {
				typeId: 1,
				lovePoints: PetConstants.MAX_LOVE_POINTS - 2,
				save: vi.fn().mockResolvedValue(undefined)
			});
			const response: CrowniclesPacket[] = [];

			await applyPossibilityOutcome({
				eventId: 19,
				possibilityName: "cook",
				outcome: ["5", { petLove: 5 }],
				time: 0,
				pet
			}, makePlayer(), {} as PacketContext, response);

			expect(pet.lovePoints).toBe(PetConstants.MAX_LOVE_POINTS);
			expect(pet.save).toHaveBeenCalledWith({ fields: ["lovePoints"] });
			expect(resultPacket(response).petLove).toBe(2);
		});

		it("changes nothing when the player has no pet available for the event", async () => {
			const response: CrowniclesPacket[] = [];

			await applyPossibilityOutcome({
				eventId: 19,
				possibilityName: "cook",
				outcome: ["5", { petLove: -3 }],
				time: 0,
				pet: null
			}, makePlayer(), {} as PacketContext, response);

			expect(resultPacket(response).petLove).toBeUndefined();
		});
	});
});