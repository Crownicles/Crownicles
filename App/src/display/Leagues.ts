import { COMMAND_REJECTIONS } from "ws-packets/src/objects/CommandRejection";
import { LeagueRewardAvailability } from "ws-packets/src/objects/Rankings";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { ReportTravelSummaryRes } from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import { AppIcons } from "@/src/AppIcons";
import { Lock } from "@/src/design/Sections";
import { Clock3 } from "@/src/design/FightIcons";
import {
	activeEffect, effectLock, rejectionLock
} from "@/src/display/CommandRejection";
import { missionDate } from "@/src/display/Missions";
import { gameRules } from "@/src/rules/GameRules";
import { i18n } from "@/src/translations/i18n";

/** What the app knows of the player Core checks the reward command against; a `null` profile is not known yet, and Core decides. */
export type LeagueClaimant = {
	profile: ProfileRes | null;
	travel?: ReportTravelSummaryRes;
};

export function leagueName(leagueId: number): string {
	return i18n.t("app:arena.leagues.name", {
		icon: AppIcons.getIcon(`leagues.${leagueId}`), name: i18n.t(`models:leagues.${leagueId}`)
	});
}

/** Core holds the reward back for the season itself first: it would not open with the player free either. */
function availabilityLock(availability: LeagueRewardAvailability): Lock | undefined {
	if (!availability) {
		return undefined;
	}
	return {
		reason: availability.type === "notSunday"
			? i18n.t("app:arena.leagues.nextClaim", { date: missionDate(availability.nextSunday) })
			: i18n.t(`app:arena.leagues.${availability.type}`),
		icon: Clock3
	};
}

/** Core refuses the reward below the fight level, under an alteration and away from the continent, which the boat is not part of. */
function claimantLock({
	profile, travel
}: LeagueClaimant): Lock | undefined {
	const requiredLevel = gameRules().journeyLevels.fights;
	if (profile && profile.level < requiredLevel) {
		return rejectionLock({
			type: COMMAND_REJECTIONS.LEVEL, requiredLevel
		});
	}
	const effect = profile ? activeEffect(profile) : null;
	if (effect) {
		return effectLock(effect);
	}
	return travel?.isOnBoat ? rejectionLock({ type: COMMAND_REJECTIONS.LOCATION }) : undefined;
}

/** Why the season reward cannot be claimed right now, or `undefined` when it can: the button and every badge read the same answer. */
export function leagueRewardLock(availability: LeagueRewardAvailability, claimant: LeagueClaimant): Lock | undefined {
	return availabilityLock(availability) ?? claimantLock(claimant);
}
