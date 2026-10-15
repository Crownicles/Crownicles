import { FightPlayerStats } from "../../../objects/Fight";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		fightConfirm: { playerStats: FightPlayerStats };
		fightAction: { fightId: string };
	}
	interface ReactionCollectorReactionPayloads {
		fightAction: { id: string };
	}
}
export const FIGHT_DATA_KINDS = {
	CONFIRM: "fightConfirm", ACTION: "fightAction"
} as const satisfies Record<string, ReactionCollectorDataKind>;
export const FIGHT_REACTION_KINDS = { ACTION: "fightAction" } as const satisfies Record<string, ReactionCollectorReactionKind>;
