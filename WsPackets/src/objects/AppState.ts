/**
 * What the app has already shown a character; Core keeps it so it resets with the character.
 * A RestWs test keeps this list equal to Lib's.
 */
export const APP_STATE_FLAGS = [
	"journeyRecorded",
	"announced.profile",
	"announced.classes",
	"announced.fights",
	"announced.guild",
	"announced.pet",
	"visited.profile",
	"visited.classes",
	"visited.fights",
	"visited.guild",
	"visited.pet",
	"tip.tokens",
	"tip.occupied",
	"tip.profile",
	"fork",
	"contestJoined",
	"royalSeal"
] as const;

export type AppStateFlag = typeof APP_STATE_FLAGS[number];

export function isAppStateFlag(value: unknown): value is AppStateFlag {
	return APP_STATE_FLAGS.some(flag => flag === value);
}
