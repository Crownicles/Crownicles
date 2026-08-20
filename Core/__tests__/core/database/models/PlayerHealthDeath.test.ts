import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import Player from "../../../../src/core/database/game/models/Player";
import { Crownicles } from "../../../../src/core/bot/Crownicles";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { TravelTime } from "../../../../src/core/maps/TravelTime";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import { Effect } from "../../../../../Lib/src/types/Effect";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerDeathPacket } from "../../../../../Lib/src/packets/events/PlayerDeathPacket";

// Instance the mocked row lock hands back, so health mutations apply to the player under test.
let lockedPlayer: Player;

/**
 * Build a bare Player instance without going through Sequelize's constructor/DB,
 * only setting the fields read by the health methods under test.
 */
function buildPlayer(params: {
	level: number;
	classId: number;
	health: number;
	fightPointsLost?: number;
}): Player {
	const player = Object.create(Player.prototype) as Player;
	player.level = params.level;
	player.class = params.classId;
	player.health = params.health;
	player.fightPointsLost = params.fightPointsLost ?? 0;
	player.effectId = Effect.NO_EFFECT.id;
	player.keycloakId = "test-keycloak-id";
	lockedPlayer = player;
	return player;
}

/**
 * Active objects without any enchantment, so the max energy only depends on the class
 */
const noEnchantmentActiveObjects = {
	weapon: { itemEnchantmentId: null },
	armor: { itemEnchantmentId: null }
} as PlayerActiveObjects;

function countDeathPackets(response: CrowniclesPacket[]): number {
	return response.filter(packet => packet instanceof PlayerDeathPacket).length;
}

describe("Player health and death", () => {
	let applyEffectSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setCrowniclesInstanceForTests({
			logsDatabase: {
				logHealthChange: vi.fn().mockResolvedValue(undefined),
				logEnergyChange: vi.fn().mockResolvedValue(undefined)
			}
		} as unknown as Crownicles);
		applyEffectSpy = vi.spyOn(TravelTime, "applyEffect")
			.mockResolvedValue(undefined);
		vi.spyOn(Player, "withLocked").mockImplementation((_id, body) => body(lockedPlayer));
		vi.spyOn(Player.prototype, "save").mockImplementation(function(this: Player) {
			return Promise.resolve(this);
		});
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.restoreAllMocks();
	});

	describe("addHealth", () => {
		it("kills the player when the damage empties their health bar", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 26
			});
			const response: CrowniclesPacket[] = [];

			await player.addHealth({
				amount: -26,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			expect(player.getHealthValue()).toBe(0);
			expect(countDeathPackets(response)).toBe(1);
			expect(applyEffectSpy).toHaveBeenCalledWith(player, Effect.DEAD, 0, expect.any(Date), NumberChangeReason.SMALL_EVENT);
		});

		it("never lets the health go below 0 and still kills the player on overkill", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 3
			});
			const response: CrowniclesPacket[] = [];

			await player.addHealth({
				amount: -100,
				response,
				reason: NumberChangeReason.BIG_EVENT
			});

			expect(player.getHealthValue()).toBe(0);
			expect(countDeathPackets(response)).toBe(1);
		});

		it("does not kill the player when some health is left", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 26
			});
			const response: CrowniclesPacket[] = [];

			await player.addHealth({
				amount: -25,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			expect(player.getHealthValue()).toBe(1);
			expect(countDeathPackets(response)).toBe(0);
			expect(applyEffectSpy).not.toHaveBeenCalled();
		});

		it("caps the health to the maximum before applying the change", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 500
			});
			const response: CrowniclesPacket[] = [];

			await player.addHealth({
				amount: -5,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			// Class 0 tops at 65 + 10 = 75 health at level 10
			expect(player.getHealthValue()).toBe(70);
		});
	});

	describe("killIfNeeded", () => {
		it("re-applies the dead effect but pushes a single death packet per response", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 0
			});
			const response: CrowniclesPacket[] = [];

			expect(await player.killIfNeeded(response, NumberChangeReason.BIG_EVENT)).toBe(true);

			// Simulate an outcome effect overwriting the dead effect before the final safety check
			player.effectId = Effect.OCCUPIED.id;

			expect(await player.killIfNeeded(response, NumberChangeReason.BIG_EVENT)).toBe(true);
			expect(applyEffectSpy).toHaveBeenCalledTimes(2);
			expect(countDeathPackets(response)).toBe(1);
		});

		it("does not re-apply the dead effect when the player is already dead", async () => {
			const player = buildPlayer({
				level: 10,
				classId: 0,
				health: 0
			});
			player.effectId = Effect.DEAD.id;
			const response: CrowniclesPacket[] = [];

			expect(await player.killIfNeeded(response, NumberChangeReason.BIG_EVENT)).toBe(true);
			expect(applyEffectSpy).not.toHaveBeenCalled();
			expect(countDeathPackets(response)).toBe(1);
		});
	});

	describe("changeClass", () => {
		it("keeps the health ratio when switching to a frailer class instead of dropping to 0", async () => {
			const player = buildPlayer({
				level: 9,
				classId: 0,
				health: 71
			});
			const response: CrowniclesPacket[] = [];

			// Class 0 tops at 65 + 9 = 74 health at level 9, class 8 only at 10 + 9 = 19
			expect(player.getMaxHealth()).toBe(74);

			await player.changeClass(8, noEnchantmentActiveObjects, response);

			expect(player.getMaxHealth()).toBe(19);
			expect(player.getHealthValue()).toBe(19);
			expect(countDeathPackets(response)).toBe(0);
		});

		it("keeps the health ratio when switching to a sturdier class", async () => {
			const player = buildPlayer({
				level: 9,
				classId: 8,
				health: 10
			});
			const response: CrowniclesPacket[] = [];

			await player.changeClass(0, noEnchantmentActiveObjects, response);

			// 10 / 19 of a 74 health bar
			expect(player.getHealthValue()).toBe(39);
			expect(countDeathPackets(response)).toBe(0);
		});

		it("caps the health to the previous maximum before rescaling", async () => {
			const player = buildPlayer({
				level: 9,
				classId: 0,
				health: 500
			});
			const response: CrowniclesPacket[] = [];

			await player.changeClass(8, noEnchantmentActiveObjects, response);

			expect(player.getHealthValue()).toBe(19);
		});

		it("keeps the lost energy ratio", async () => {
			const player = buildPlayer({
				level: 9,
				classId: 0,
				health: 74
			});
			const response: CrowniclesPacket[] = [];

			// Class 0 tops at 351 cumulative energy at level 9, class 8 only at 281
			expect(player.getMaxCumulativeEnergy(noEnchantmentActiveObjects)).toBe(351);
			player.fightPointsLost = 175;

			await player.changeClass(8, noEnchantmentActiveObjects, response);

			expect(player.getMaxCumulativeEnergy(noEnchantmentActiveObjects)).toBe(281);
			expect(player.fightPointsLost).toBe(141);
		});
	});
});
