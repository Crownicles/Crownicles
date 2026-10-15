import { FromServerPacket } from "../FromServerPacket";

export const HOME_BED_OUTCOMES = {
	RESTED: "rested",
	ALREADY_FULL: "alreadyFull"
} as const;

export type HomeBedOutcome =
	| {
		type: typeof HOME_BED_OUTCOMES.RESTED; health: number;
	}
	| { type: typeof HOME_BED_OUTCOMES.ALREADY_FULL };

/** A rest in the player's own bed, or why it was not needed; the shared bed cooldown answers as an inn result. */
export class HomeBedRes extends FromServerPacket {
	public static readonly wireName = "HomeBedRes";

	outcome!: HomeBedOutcome;
}
