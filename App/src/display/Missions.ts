import {Mission, MissionTravel, MISSION_VARIANTS} from "ws-packets/src/objects/Mission";
import {i18n} from "@/src/translations/i18n";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {AppIcons} from "@/src/AppIcons";

const MILLISECONDS_PER_HOUR = 3_600_000;
const MINUTES_PER_HOUR = 60;

export function missionDate(timestamp: number): string {
	return new Intl.DateTimeFormat(i18n.language, {dateStyle: "short", timeStyle: "short"}).format(timestamp);
}

function travelVariant(travel: MissionTravel, now: number): string {
	const deadline = travel.progress ? travel.progress.startTimestamp + travel.time * MILLISECONDS_PER_HOUR : 0;
	if (travel.progress && deadline > now) {
		return i18n.t("models:missionVariants.fromPlaceToPlace_secondPart", {
			place: i18n.t(`models:map_locations.${travel.progress.startMap === travel.fromMap ? travel.toMap : travel.fromMap}.name`),
			time: missionDate(deadline)
		});
	}
	return i18n.t("models:missionVariants.fromPlaceToPlace", {
		place1: i18n.t(`models:map_locations.${travel.fromMap}.name`),
		place2: i18n.t(`models:map_locations.${travel.toMap}.name`),
		time: travel.time,
		context: travel.orderMatter ? "order" : "noOrder"
	});
}

function missionVariant(mission: Mission, now: number): string {
	if (mission.travel) return travelVariant(mission.travel, now);
	switch (mission.missionId) {
		case MISSION_VARIANTS.CLASS_TIER: return String(mission.missionVariant + 1);
		case MISSION_VARIANTS.EXPEDITION_DURATION: return formatDurationMinutes(mission.missionVariant);
		case MISSION_VARIANTS.TRAVEL_DURATION: return formatDurationMinutes(mission.missionVariant * MINUTES_PER_HOUR);
		case MISSION_VARIANTS.EXPEDITION_RISK: return i18n.t("app:missions.risk", {icon: AppIcons.getIcon(`expedition.risk.${mission.riskCategory}`), risk: i18n.t(`commands:petExpedition.riskCategories.${mission.riskCategory}`)});
		case MISSION_VARIANTS.FIGHT_ATTACKS:
		case MISSION_VARIANTS.FINISH_WITH_ATTACK:
			return i18n.t(`models:missionVariants.${mission.missionId}`, {variant: mission.fightAction, count: mission.missionObjective});
		default: return i18n.t([`models:missionVariants.${mission.missionId}`, "models:missionVariants.default"], {variant: mission.missionVariant, mapType: mission.mapType});
	}
}

export function missionDescription(mission: Mission, now: number): string {
	return i18n.t(`models:missions.${mission.missionId}`, {count: mission.missionObjective, variantText: missionVariant(mission, now), context: "app"});
}