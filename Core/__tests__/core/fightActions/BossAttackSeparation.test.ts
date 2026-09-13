import {
	describe, expect, it
} from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

type BossAttackPlan = {
	monster: string;
	attacks: string[];
};

const BOSS_ATTACK_PLANS: BossAttackPlan[] = [
	{
		monster: "skeleton",
		attacks: ["skeletonSimpleAttack", "skeletonShieldAttack", "skeletonCursedAttack"]
	},
	{
		monster: "spider",
		attacks: ["spiderPoisonAttack"]
	},
	{
		monster: "celestialGuardian",
		attacks: ["guardianPowerfulAttack", "chargeChargeRadiantBlastAttack"]
	},
	{
		monster: "magmaTitan",
		attacks: ["titanFireAttack"]
	},
	{
		monster: "shinyElementary",
		attacks: ["elementaryPiercingAttack"]
	}
];

const fightActionsPath = path.join(__dirname, "../../../resources/fightActions");
const playerActionsPath = path.join(__dirname, "../../../src/core/fights/actions/interfaces/players");
const monsterActionsPath = path.join(__dirname, "../../../src/core/fights/actions/interfaces/monsters");
const monstersPath = path.join(__dirname, "../../../resources/monsters");

function readJson(filePath: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

describe("boss attack separation", () => {
	it("keeps the reworked boss attacks out of the player action directory", () => {
		for (const plan of BOSS_ATTACK_PLANS) {
			const monster = readJson(path.join(monstersPath, `${plan.monster}.json`));
			const attacks = monster.attacks as { id: string }[];
			const configuredIds = attacks.map(attack => attack.id);

			for (const attackId of plan.attacks) {
				expect(configuredIds).toContain(attackId);
				expect(fs.existsSync(path.join(monsterActionsPath, `${attackId}.ts`))).toBe(true);
				expect(fs.existsSync(path.join(playerActionsPath, `${attackId}.ts`))).toBe(false);
			}
			}
	});

	it("gives every separated action a monster-only resource definition", () => {
		for (const plan of BOSS_ATTACK_PLANS) {
			for (const attackId of plan.attacks) {
				const action = readJson(path.join(fightActionsPath, `${attackId}.json`));
				expect(action.missionVariant).toBe(-1);
				expect(typeof action.breath).toBe("number");
				expect(["physical", "magic", "charge"]).toContain(action.type);
			}
		}
	});

	it("keeps the Leviathan nerf lighter than the Kraken's attack profile", () => {
		const leviathan = readJson(path.join(monstersPath, "leviathan.json"));
		const kraken = readJson(path.join(monstersPath, "kraken.json"));

		expect(leviathan.attackRatio).toBe(235);
		expect(leviathan.speedRatio).toBe(180);
		expect(leviathan.breathRegen).toBe(10);
		expect(leviathan.attackRatio).toBeLessThan(kraken.attackRatio as number);
	});
});
