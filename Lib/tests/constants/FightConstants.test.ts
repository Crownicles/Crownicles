import {describe, expect, it} from "vitest";
import {FightConstants} from "../../src/constants/FightConstants";
import * as path from "node:path";
import * as fs from "node:fs";
import {CrowniclesIcons} from "../../src/CrowniclesIcons";

describe("FightConstants fight_actions models.json validation", () => {
	const modelsPath = path.join(__dirname, "../../../Lang/fr/models.json");
	const models = JSON.parse(fs.readFileSync(modelsPath, "utf-8"));
	const fightActions = models.fight_actions;

	describe("MONSTER actions", () => {
		const ids = Object.values(FightConstants.FIGHT_ACTIONS.MONSTER);
		for (const id of ids) {
			it(`${id} should not have description, should have name_one and name_other, should not have active or success`, () => {
				const entry = fightActions[id];
				expect(entry).toBeDefined();
				// Descriptions for monster attacks should be written in sir rowan small event
				expect(entry.description).toBeUndefined();
				expect(entry.name_one).toBeDefined();
				expect(entry.name_other).toBeDefined();
				expect(entry.active).toBeUndefined();
				expect(entry.success).toBeUndefined();
			});
		}
	});

	describe("PLAYER actions", () => {
		const ids = Object.values(FightConstants.FIGHT_ACTIONS.PLAYER);
		// Some attacks must not have a description: notably two turns attacks
		const noDescriptionExceptions = new Set([
			"chargingAttack",
			"ultimateAttack"
		]);
		for (const id of ids) {
			if (id === "none") {
				it(`${id} is a valid fight action and does not require validation`, () => {
					expect(true).toBe(true);
				});
				continue;
			}
			it(`${id} should have description, name_one and name_other, not active or success`, () => {
				const entry = fightActions[id];
				expect(entry).toBeDefined();
				if (!noDescriptionExceptions.has(id)) {
					expect(entry.description).toBeDefined();
				}
				else {
					expect(entry.description).toBeUndefined();
				}
				expect(entry.name_one).toBeDefined();
				expect(entry.name_other).toBeDefined();
				expect(entry.active).toBeUndefined();
				expect(entry.success).toBeUndefined();
			});
		}
	});

	describe("PET actions", () => {
		const ids = Object.values(FightConstants.FIGHT_ACTIONS.PET);
		for (const id of ids) {
			it(`${id} should have only success, customMessage or afraid`, () => {
				const entry = fightActions[id];
				expect(entry).toBeDefined();
				const allowed = ["success", "customMessage", "afraid", "generalEffect", "failure"];
				for (const key of Object.keys(entry)) {
					expect(allowed).toContain(key);
				}
				expect(entry.success || entry.customMessage || entry.afraid || entry.generalEffect || entry.failure).toBeDefined();
			});
		}
	});

	describe("ALTERATION actions", () => {
		const ids = Object.values(FightConstants.FIGHT_ACTIONS.ALTERATION);
		const noNameExceptions = new Set([
			"outOfBreath"
		]);
		for (const id of ids) {
			it(`${id} should not have description, should have name but not name_other, can have other props`, () => {
				const entry = fightActions[id];
				expect(entry).toBeDefined();
				expect(entry.description).toBeUndefined();
				if (!noNameExceptions.has(id)) {
					expect(entry.name).toBeDefined();
				}
				else {
					expect(entry.name).toBeUndefined();
				}
				expect(entry.name_other).toBeUndefined();
			});
		}
	});

	describe("PLAYER and MONSTER actions have infoFight event entries", () => {
		const smallEventsPath = path.join(__dirname, "../../../Lang/fr/smallEvents.json");
		const smallEvents = JSON.parse(fs.readFileSync(smallEventsPath, "utf-8"));
		const infoFightActions = smallEvents.infoFight.fightActions;

		// Some attacks, it's okay to not have an entry in infoFight.fightActions
		const EXCEPTIONS = [
			"chargeChargingAttack", // Multiple turns attack is merged into one entry
			"chargeUltimateAttack", // Multiple turns attack is merged into one entry
			"getDirty", // Only triggered by the whale
			"none", // Not really an attack
			"chargeChargeRadiantBlastAttack", // Multiple turns attack is merged into one entry
			"chargeRadiantBlastAttack", // Multiple turns attacks are merged into one entry
			"chargeClubSmashAttack", // Multiple turns attacks are merged into one entry
		];

		function hasFightActionEntry(id) {
			const emote = `{emote:fightActions.${id}}`;
			return infoFightActions.some((entry) => typeof entry === "string" && entry.includes(emote));
		}

		describe("PLAYER actions", () => {
			const ids = Object.values(FightConstants.FIGHT_ACTIONS.PLAYER);
			for (const id of ids) {
				it(`${id} should have an entry in infoFight.fightActions (unless excepted)`, () => {
					if (EXCEPTIONS.includes(id)) {
						expect(true).toBe(true);
						return;
					}
					expect(hasFightActionEntry(id)).toBe(true);
				});
			}
		});

		describe("MONSTER actions", () => {
			const ids = Object.values(FightConstants.FIGHT_ACTIONS.MONSTER);
			for (const id of ids) {
				it(`${id} should have an entry in infoFight.fightActions (unless excepted)`, () => {
					if (EXCEPTIONS.includes(id)) {
						expect(true).toBe(true);
						return;
					}
					expect(hasFightActionEntry(id)).toBe(true);
				});
			}
		});
	});

	describe("All fight actions (except PET) have an associated icon in CrowniclesIcons.fightActions", () => {
		const iconKeys = Object.keys(CrowniclesIcons.fightActions);

		const allFightActionIds = [
			...Object.values(FightConstants.FIGHT_ACTIONS.MONSTER),
			...Object.values(FightConstants.FIGHT_ACTIONS.PLAYER),
			...Object.values(FightConstants.FIGHT_ACTIONS.ALTERATION)
		];

		for (const id of allFightActionIds) {
			it(`${id} should have an icon in CrowniclesIcons.fightActions`, () => {
				expect(iconKeys).toContain(id);
			});
		}
	});
});
