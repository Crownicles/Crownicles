import {
	describe, expect, it
} from "vitest";
import { QuestUtils } from "../../src/utils/QuestUtils";
import { LANGUAGE } from "../../../Lib/src/Language";
import {
	QUEST_IDS, QuestConstants
} from "../../../Lib/src/constants/QuestConstants";
import {
	PlantConstants, PlantId
} from "../../../Lib/src/constants/PlantConstants";
import { ExpeditionConstants } from "../../../Lib/src/constants/ExpeditionConstants";

function getHint(questId: typeof QUEST_IDS[keyof typeof QUEST_IDS], stepId: string): string {
	const stepIndex = (QuestConstants.STEPS[questId] as readonly string[]).indexOf(stepId);
	return QuestUtils.getStep({
		questId,
		stepsDone: stepIndex
	}, stepIndex, LANGUAGE.FRENCH).hint;
}

describe("Quest step hints (fr)", () => {
	it("resolves every interpolation of every hint", () => {
		for (const questId of Object.values(QUEST_IDS)) {
			for (const stepId of QuestConstants.STEPS[questId]) {
				expect(getHint(questId, stepId)).not.toMatch(/\{\{|\$t\(|undefined/);
			}
		}
	});

	it("gives the level required by Velanna for the anchor talisman", () => {
		expect(getHint(QUEST_IDS.EXPEDITION_TALISMANS, "anchorTalisman"))
			.toContain(`Niveau ${ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL} minimum`);
	});

	it("gives the level, inn night duration, night hours and moon illumination the gardener requires for the lunar moss", () => {
		const hint = getHint(QUEST_IDS.SEEDS, "lunarMoss");
		expect(hint).toContain(`Niveau ${PlantConstants.SEED_LEVEL_REQUIREMENTS[PlantId.LUNAR_MOSS]} minimum`);
		expect(hint).toContain(`moins de ${PlantConstants.INN_NIGHT_FAVOR_HOURS} h`);
		expect(hint).toContain(`${PlantConstants.NIGHT_THRESHOLDS.EVENING} h – ${PlantConstants.NIGHT_THRESHOLDS.MORNING} h`);
		expect(hint).toContain(new Intl.NumberFormat(LANGUAGE.FRENCH, { style: "percent" }).format(PlantConstants.MOON_ILLUMINATION_THRESHOLD));
	});

	it("gives the price of the paid seeds", () => {
		const price = new Intl.NumberFormat(LANGUAGE.FRENCH).format(PlantConstants.SEED_COSTS[PlantId.CRYSTAL_FLOWER]);
		expect(getHint(QUEST_IDS.SEEDS, "crystalFlower")).toContain(price);
	});
});
