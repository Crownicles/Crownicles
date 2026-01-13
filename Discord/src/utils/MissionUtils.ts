import {
	BaseMission, CompletedMission
} from "../../../Lib/src/types/CompletedMission";
import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import { MissionUtils as MissionUtilsLib } from "../../../Lib/src/utils/MissionUtils";
import {
	dateDisplay, hoursToMilliseconds
} from "../../../Lib/src/utils/TimeUtils";
import { getTranslatedRiskCategoryNameWithEmoji } from "../commands/pet/expedition/ExpeditionDisplayUtils";

export class MissionUtils {
	/**
	 * Get the displayable version of a mission (only the plain objective)
	 * @param mission
	 * @param lng
	 */
	static formatBaseMission(mission: BaseMission, lng: Language): string {
		return i18n.t(`models:missions.${mission.missionId}`, {
			lng,
			count: mission.missionObjective,
			variantText: this.getVariantText(mission, lng)
		});
	}

	/**
	 * Get the displayable version of a completed mission
	 * @param mission
	 * @param lng
	 */
	static formatCompletedMission(mission: CompletedMission, lng: Language): string {
		const rewards = [
			{
				value: mission.pointsToWin, key: "pointsDisplay"
			},
			{
				value: mission.gemsToWin, key: "gemsDisplay"
			},
			{
				value: mission.moneyToWin, key: "moneyDisplay"
			},
			{
				value: mission.xpToWin, key: "xpDisplay"
			}
		];

		const rewardDisplays = rewards
			.filter(reward => reward.value > 0)
			.map(reward => i18n.t(`notifications:missions.completed.${reward.key}`, {
				count: reward.value,
				lng
			}));

		return i18n.t("notifications:missions.completed.missionDisplay", {
			lng,
			missionDescription: this.formatBaseMission(mission, lng),
			missionsReward: rewardDisplays.length === 0 ? "" : ` (${rewardDisplays.join(", ")})`
		});
	}

	/**
	 * Get the progression bar corresponding to the progression of the mission
	 * @param current
	 * @param objective
	 */
	static generateDisplayProgression(current: number, objective: number): string {
		let progression = current / objective;
		if (progression < 0) {
			return "ERROR:PROGRESS_BAR_NEGATIVE";
		}
		if (progression > 1) {
			progression = 1;
		}
		const squareToDisplay = Math.floor(progression * 10);
		return `[${"■".repeat(squareToDisplay)}${"□".repeat(10 - squareToDisplay)}]`;
	}

	/**
	 * Handlers for specific mission variant text generation
	 */
	private static readonly variantTextHandlers: Record<string, (mission: BaseMission, lng: Language) => string> = {
		fromPlaceToPlace: (mission, lng) => MissionUtils.manageFromPlaceToPlaceVariant(mission, lng),
		chooseClassTier: mission => String(mission.missionVariant + 1),
		dangerousExpedition: (mission, lng) => getTranslatedRiskCategoryNameWithEmoji(mission.missionVariant, lng),
		longExpedition: (mission, lng) => i18n.formatDuration(mission.missionVariant, lng)
	};

	/**
	 * Get the text version of a mission variant
	 * @param mission
	 * @param lng
	 */
	private static getVariantText(mission: BaseMission, lng: Language): string {
		const handler = this.variantTextHandlers[mission.missionId];
		if (handler) {
			return handler(mission, lng);
		}
		if (!MissionUtilsLib.isRequiredFightActionId(mission)) {
			return i18n.t([`models:missionVariants.${mission.missionId}`, "models:missionVariants.default"], {
				lng,
				variant: mission.missionVariant,
				mapType: mission.mapType
			});
		}
		if (!mission.fightAction) {
			throw new Error("fightAction is not set for a fight mission");
		}
		if (mission.missionId === "fightAttacks") {
			return i18n.t("models:missionVariants.fightAttacks", {
				lng,
				count: mission.missionObjective,
				variant: mission.fightAction
			});
		}
		return i18n.t("models:missionVariants.finishWithAttack", {
			lng,
			variant: mission.fightAction
		}).toLowerCase();
	}

	/**
	 * Get the displayable version of a fromPlaceToPlace mission variant (which is the whole text)
	 * @param mission
	 * @param lng
	 */
	private static manageFromPlaceToPlaceVariant(mission: BaseMission, lng: Language): string {
		const params = MissionUtilsLib.fromPlaceToPlaceParamsFromVariant(mission.missionVariant);
		const saveData = mission.saveBlob ? MissionUtilsLib.fromPlaceToPlaceDataFromSaveBlob(Buffer.from(mission.saveBlob, "binary")) : null;
		if (!saveData || saveData.startTimestamp + hoursToMilliseconds(params.time) < Date.now()) {
			return i18n.t("models:missionVariants.fromPlaceToPlace", {
				lng,
				place1: i18n.t(`models:map_locations.${params.fromMap}.name`, { lng }),
				place2: i18n.t(`models:map_locations.${params.toMap}.name`, { lng }),
				time: params.time,
				context: params.orderMatter ? "order" : "noOrder"
			});
		}
		return i18n.t("models:missionVariants.fromPlaceToPlace_secondPart", {
			lng,
			place: i18n.t(`models:map_locations.${saveData.startMap === params.fromMap ? params.toMap : params.fromMap}.name`, { lng }),
			time: dateDisplay(new Date(saveData.startTimestamp + hoursToMilliseconds(params.time)))
		});
	}
}
