import type {GameRules} from "ws-packets/src/objects/GameRules";

let current: GameRules | null = null;

export function loadGameRules(rules: GameRules): void {
	current = rules;
}

/** Core's values, as the last assets bundle brought them; the boot gate holds every screen until then. */
export function gameRules(): GameRules {
	if (!current) throw new Error("Game rules read before the assets bundle was applied.");
	return current;
}
