import { ReactionCollectorDataKind } from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		unlockPlayer: {
			price: number; playerName?: string;
		};
		joinBoat: {
			price: number;
			energy: {
				current: number; max: number;
			};
		};
	}
}
export const PLAYER_UTILITY_DATA_KINDS = {
	UNLOCK: "unlockPlayer", BOAT: "joinBoat"
} as const satisfies Record<string, ReactionCollectorDataKind>;
