import fs from "node:fs";
import path from "node:path";
import {
	describe, expect, it
} from "vitest";
import {
	QUEST_IDS, QuestConstants
} from "../../../Lib/src/constants/QuestConstants";

type QuestTranslations = {
	name?: string;
	icon?: string;
	description?: string;
	steps?: Record<string, {
		label?: string;
		hint?: string;
	}>;
};

const frenchCommands = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../Lang/fr/commands.json"), "utf8")) as {
	missions: { quests: { list: Record<string, QuestTranslations> } };
};
const questsTranslations = frenchCommands.missions.quests.list;

describe("Quest translations", () => {
	for (const questId of Object.values(QUEST_IDS)) {
		it(`translates the name, icon, description, and the label and hint of every step of the ${questId} quest`, () => {
			const quest = questsTranslations[questId];
			expect(quest?.name).toBeTruthy();
			expect(quest?.icon).toMatch(/^\{emote:[\w.]+\}$/);
			expect(quest?.description).toBeTruthy();
			const expectedSteps: readonly string[] = QuestConstants.STEPS[questId];
			expect(Object.keys(quest?.steps ?? {})).toEqual(expectedSteps);
			for (const step of expectedSteps) {
				expect(quest!.steps![step].label).toBeTruthy();
				expect(quest!.steps![step].hint).toBeTruthy();
			}
		});
	}

	it("has no translation for an undeclared quest", () => {
		expect(Object.keys(questsTranslations)).toEqual(Object.values(QUEST_IDS));
	});
});
