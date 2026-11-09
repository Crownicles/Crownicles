import { FromServerPacket } from "../FromServerPacket";

export const INN_OUTCOMES = {
	MEAL: "meal",
	ROOM: "room",
	MEAL_COOLDOWN: "mealCooldown",
	BED_COOLDOWN: "bedCooldown"
} as const;

export type InnOutcome =
	| {
		type: typeof INN_OUTCOMES.MEAL; energy: number; moneySpent: number;
	}
	| {
		type: typeof INN_OUTCOMES.ROOM; roomId: string; health: number; moneySpent: number;
	}

	// The bed cooldown is shared by every bed, so the home bed answers with it too.
	| {
		type: typeof INN_OUTCOMES.MEAL_COOLDOWN | typeof INN_OUTCOMES.BED_COOLDOWN; nextAvailableAt: number;
	};

/** A meal eaten or a room slept in at an inn, or the time before it can be served again. */
export class InnRes extends FromServerPacket {
	public static readonly wireName = "InnRes";

	outcome!: InnOutcome;
}
