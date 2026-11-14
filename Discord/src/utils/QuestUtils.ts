import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { QuestProgress } from "../../../Lib/src/types/QuestProgress";
import {
	QUEST_IDS, QuestConstants, QuestId
} from "../../../Lib/src/constants/QuestConstants";
import {
	PlantConstants, PlantId
} from "../../../Lib/src/constants/PlantConstants";
import { ExpeditionConstants } from "../../../Lib/src/constants/ExpeditionConstants";
import { MissionUtils } from "./MissionUtils";
import { StringUtils } from "./StringUtils";

type QuestStepTranslation = {
	label: string;
	hint: string;
};

type QuestIconAndName = {
	icon: string;
	name: string;
};

/**
 * Values interpolated in the hint of a step, read from the constants the game itself checks so the hint never drifts from the rule
 */
type QuestStepHintParams = Partial<Record<"level" | "price" | "nightStart" | "nightEnd" | "innNightHours" | "rarity", number>>;

/**
 * Requirements of the gardener before handing over the seed of a plant
 */
function getSeedStepHintParams(plantId: PlantId): QuestStepHintParams {
	return {
		level: PlantConstants.SEED_LEVEL_REQUIREMENTS[plantId],
		price: PlantConstants.SEED_COSTS[plantId],
		nightStart: PlantConstants.NIGHT_THRESHOLDS.EVENING,
		nightEnd: PlantConstants.NIGHT_THRESHOLDS.MORNING,
		innNightHours: PlantConstants.INN_NIGHT_FAVOR_HOURS,
		rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY
	};
}

const QUEST_STEP_HINT_PARAMS: Record<QuestId, (stepIndex: number) => QuestStepHintParams> = {
	[QUEST_IDS.EXPEDITION_TALISMANS]: () => ({ level: ExpeditionConstants.TALISMAN_EVENT.TALISMAN_MIN_LEVEL }),
	[QUEST_IDS.SEEDS]: stepIndex => getSeedStepHintParams(QuestConstants.SEEDS_STEP_PLANTS[QuestConstants.STEPS[QUEST_IDS.SEEDS][stepIndex]])
};

export abstract class QuestUtils {
	static getStepCount(quest: QuestProgress): number {
		return QuestConstants.STEPS[quest.questId].length;
	}

	static isCompleted(quest: QuestProgress): boolean {
		return quest.stepsDone >= QuestUtils.getStepCount(quest);
	}

	/**
	 * Icon and name of the quest
	 */
	static formatHeader(quest: QuestProgress, lng: Language): string {
		return i18n.t("commands:missions.quests.questHeader", {
			lng,
			...QuestUtils.getIconAndName(quest, lng)
		});
	}

	static getDescription(quest: QuestProgress, lng: Language): string {
		return i18n.t(`commands:missions.quests.list.${quest.questId}.description`, { lng });
	}

	/**
	 * Progression bar of the quest followed by its completed steps count
	 */
	static formatProgression(quest: QuestProgress, lng: Language): string {
		const stepCount = QuestUtils.getStepCount(quest);
		return i18n.t("commands:missions.quests.progression", {
			lng,
			progressionBar: MissionUtils.generateDisplayProgression(quest.stepsDone, stepCount),
			current: quest.stepsDone,
			max: stepCount
		});
	}

	/**
	 * Label and hint of a step of the quest, given by its index
	 */
	static getStep(quest: QuestProgress, stepIndex: number, lng: Language): QuestStepTranslation {
		const stepKey = `commands:missions.quests.list.${quest.questId}.steps.${QuestConstants.STEPS[quest.questId][stepIndex]}`;
		return {
			label: i18n.t(`${stepKey}.label`, { lng }),
			hint: i18n.t(`${stepKey}.hint`, {
				lng,
				...QUEST_STEP_HINT_PARAMS[quest.questId](stepIndex)
			})
		};
	}

	/**
	 * Display of an ongoing quest in the quests page: its name, its progression and the step to complete next with its hint
	 */
	static formatOngoingQuest(quest: QuestProgress, lng: Language): string {
		return StringUtils.joinLines([
			QuestUtils.formatHeader(quest, lng),
			QuestUtils.formatProgression(quest, lng),
			i18n.t("commands:missions.quests.currentStep", {
				lng,
				...QuestUtils.getStep(quest, quest.stepsDone, lng)
			})
		]);
	}

	/**
	 * Line of a completed quest in the completed quests page
	 */
	static formatCompletedQuest(quest: QuestProgress, lng: Language): string {
		return i18n.t("commands:missions.quests.completedQuest", {
			lng,
			...QuestUtils.getIconAndName(quest, lng),
			max: QuestUtils.getStepCount(quest)
		});
	}

	private static getIconAndName(quest: QuestProgress, lng: Language): QuestIconAndName {
		return {
			icon: i18n.t(`commands:missions.quests.list.${quest.questId}.icon`, { lng }),
			name: i18n.t(`commands:missions.quests.list.${quest.questId}.name`, { lng })
		};
	}
}
