import { OnboardingTrial } from "./Onboarding";
import { JourneyLevels } from "./Journey";
import {
	TextRule, TextRuleId
} from "./TextRules";

/** Inclusive bounds of a number the player types. */
export type NumberRange = {
	min: number;
	max: number;
};

/**
 * The game values the app needs before asking anything, read from Core's constants and sent with
 * the assets bundle: a balance change reaches installed apps without a store release.
 */
export type GameRules = {
	textRules: Record<TextRuleId, TextRule>;
	guild: {
		creationPrice: number;
		maxMembers: number;

		/** The minimum scores a chief can pick from, in increasing order. */
		recruitmentMinScoreSteps: number[];
	};
	journeyLevels: JourneyLevels;
	fight: {

		/** The share of the maximum energy a fighter needs to start a fight. */
		minimalEnergyRatio: number;
	};
	pet: {
		sellPrice: NumberRange;
	};

	/** The royal contest trials, in campaign order. */
	onboardingTrials: OnboardingTrial[];
};
