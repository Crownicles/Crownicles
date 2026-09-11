export const COMMAND_REJECTIONS = {
	LEVEL: "level",
	EFFECT: "effect",
	ORACLE: "oracle",
	LOCATION: "location"
} as const;

export type CommandRejection =
	| {
		type: typeof COMMAND_REJECTIONS.LEVEL; requiredLevel: number;
	}
	| {
		type: typeof COMMAND_REJECTIONS.EFFECT; currentEffectId: string; remainingTime: number;
	}
	| { type: typeof COMMAND_REJECTIONS.ORACLE }
	| { type: typeof COMMAND_REJECTIONS.LOCATION };
