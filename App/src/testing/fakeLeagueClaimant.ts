import type { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import type { ReportTravelSummaryRes } from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import { PLAYER_EFFECTS } from "ws-packets/src/objects/PlayerUtility";
import type { LeagueClaimant } from "@/src/display/Leagues";

const NO_EFFECT: ProfileRes["effect"] = {
	effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0
};

/** An alteration still running, which Core answers the league reward command with. */
export const OCCUPIED: ProfileRes["effect"] = {
	effect: PLAYER_EFFECTS.OCCUPIED, hasTimeDisplay: true, healed: false, timeLeft: 8_400_000
};

/** A player of level 30 free of any alteration, unless the test says otherwise. */
export function profileOf(profile: Partial<ProfileRes> = {}): ProfileRes {
	return {
		level: 30, effect: NO_EFFECT, ...profile
	} as ProfileRes;
}

/** A player of level 30 free of any alteration and walking on the continent, unless the test says otherwise. */
export function claimantOf(profile: Partial<ProfileRes> = {}, travel?: Partial<ReportTravelSummaryRes>): LeagueClaimant {
	return {
		profile: profileOf(profile), ...travel ? { travel: travel as ReportTravelSummaryRes } : {}
	};
}
