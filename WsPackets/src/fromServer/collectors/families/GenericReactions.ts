import { ReactionCollectorReactionKind } from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorReactionPayloads {
		accept: Record<string, never>;
		refuse: Record<string, never>;
	}
}

/**
 * Yes/no reactions, shared by every collector that asks for a confirmation.
 * `satisfies` fails the build if a constant drifts from a declared kind.
 */
export const GENERIC_REACTION_KINDS = {
	ACCEPT: "accept",
	REFUSE: "refuse"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
