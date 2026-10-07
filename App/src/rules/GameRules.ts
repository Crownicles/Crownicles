import type {GameRules} from "ws-packets/src/objects/GameRules";

let current: GameRules | null = null;

/** Every section the app reads: a bundle cached before a section was added must be fetched again, not trusted. */
const GAME_RULES_SECTIONS: Record<keyof GameRules, true> = {
	textRules: true,
	guild: true,
	journeyLevels: true,
	fight: true,
	pet: true,
	cooldownHours: true,
	apartment: true,
	onboardingTrials: true
};

export function hasEveryGameRule(rules: Record<string, unknown>): boolean {
	return Object.keys(GAME_RULES_SECTIONS).every(section => rules[section] !== undefined);
}

export function loadGameRules(rules: GameRules): void {
	current = rules;
}

/** Core's values, as the last assets bundle brought them; the boot gate holds every screen until then. */
export function gameRules(): GameRules {
	if (!current) throw new Error("Game rules read before the assets bundle was applied.");
	return current;
}
