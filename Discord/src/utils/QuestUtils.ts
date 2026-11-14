import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { QuestProgress } from "../../../Lib/src/types/QuestProgress";
import { QuestConstants } from "../../../Lib/src/constants/QuestConstants";
import { MissionUtils } from "./MissionUtils";
import { StringUtils } from "./StringUtils";

export abstract class QuestUtils {
	static getStepCount(quest: QuestProgress): number {
		return QuestConstants.STEPS[quest.questId].length;
	}

	static isCompleted(quest: QuestProgress): boolean {
		return quest.stepsDone >= QuestUtils.getStepCount(quest);
	}

	static getName(quest: QuestProgress, lng: Language): string {
		return i18n.t(`commands:missions.quests.list.${quest.questId}.name`, { lng });
	}

	/**
	 * Name of the quest with its progression
	 */
	static formatHeader(quest: QuestProgress, lng: Language): string {
		const stepCount = QuestUtils.getStepCount(quest);
		return i18n.t("commands:missions.quests.header", {
			lng,
			name: QuestUtils.getName(quest, lng),
			current: quest.stepsDone,
			max: stepCount,
			progressionBar: MissionUtils.generateDisplayProgression(quest.stepsDone, stepCount)
		});
	}

	/**
	 * Line of a completed step, given by its index in the quest
	 */
	static formatDoneStep(quest: QuestProgress, stepIndex: number, lng: Language): string {
		return i18n.t("commands:missions.quests.stepDone", {
			lng,
			step: QuestUtils.getStepTranslation(quest, stepIndex, "label", lng)
		});
	}

	/**
	 * Lines of the step to complete next, with the hint to complete it, or nothing once the quest is completed
	 */
	static formatCurrentStep(quest: QuestProgress, lng: Language): string[] {
		if (QuestUtils.isCompleted(quest)) {
			return [];
		}
		return [
			i18n.t("commands:missions.quests.stepCurrent", {
				lng,
				step: QuestUtils.getStepTranslation(quest, quest.stepsDone, "label", lng),
				hint: QuestUtils.getStepTranslation(quest, quest.stepsDone, "hint", lng)
			})
		];
	}

	/**
	 * Display of an ongoing quest: its name, its progression, its completed steps and the step to complete next
	 */
	static formatOngoingQuest(quest: QuestProgress, lng: Language): string {
		return StringUtils.joinLines([
			QuestUtils.formatHeader(quest, lng),
			...Array.from({ length: quest.stepsDone }, (_, stepIndex) => QuestUtils.formatDoneStep(quest, stepIndex, lng)),
			...QuestUtils.formatCurrentStep(quest, lng)
		]);
	}

	private static getStepTranslation(quest: QuestProgress, stepIndex: number, field: "label" | "hint", lng: Language): string {
		const step = QuestConstants.STEPS[quest.questId][stepIndex];
		return i18n.t(`commands:missions.quests.list.${quest.questId}.steps.${step}.${field}`, { lng });
	}
}
