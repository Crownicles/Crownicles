import {AppStateFlag} from "ws-packets/src/objects/AppState";
import {useAppState, useAppStateChange} from "@/src/store/AppState";

/** The moments of the contest the guide stages once per character, then never again; Core keeps them. */
export const ONBOARDING_MOMENTS = {
	/** The guide has shown how a token buys time on the road. */
	TOKENS: "tip.tokens",

	/** The guide has explained why a mishap holds the traveller back. */
	OCCUPIED: "tip.occupied",

	/** The guide has explained what the character's profile holds. */
	PROFILE: "tip.profile",

	/** The player chose how to go on once the long road to the first city began. */
	FORK: "fork",

	/** The character was seen running the contest, so its end deserves the royal seal. */
	CONTEST_JOINED: "contestJoined",

	/** The royal seal closing the contest was shown. */
	ROYAL_SEAL: "royalSeal"
} as const satisfies Record<string, AppStateFlag>;
export type OnboardingMoment = typeof ONBOARDING_MOMENTS[keyof typeof ONBOARDING_MOMENTS];

export type OnboardingMoments = {
	/** Unknown until Core has told what was shown: nothing is staged before. */
	ready: boolean;
	seen: (moment: OnboardingMoment) => boolean;
	mark: (moment: OnboardingMoment) => void;
};

export function useOnboardingMoments(): OnboardingMoments {
	const state = useAppState();
	const change = useAppStateChange();
	const seen = state.status === "ready" ? state.data.seen : null;
	return {
		ready: seen !== null,
		seen: moment => seen?.includes(moment) ?? true,
		mark: moment => {
			if (seen && !seen.includes(moment)) change({seen: [moment]});
		}
	};
}
