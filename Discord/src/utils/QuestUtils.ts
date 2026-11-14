import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { QuestProgress } from "../../../Lib/src/types/QuestProgress";
import { QuestConstants } from "../../../Lib/src/constants/QuestConstants";
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
			hint: i18n.t(`${stepKey}.hint`, { lng })
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
