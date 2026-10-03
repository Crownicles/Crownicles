import { MissionsCompletedPacket } from "../packets/events/MissionsCompletedPacket";
import { RoyalLetterPacket } from "../packets/events/RoyalLetterPacket";

/**
 * What the app has already shown a character: unlock announcements, tabs visited and the guide's
 * one-time explanations. Core keeps it on the character, so it resets with it.
 * Append only: the position of a flag is its bit in `player_missions_info.appSeen`, an
 * INT UNSIGNED that holds at most 32 flags.
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

/** Something Core credited and told the app, kept until the player has seen it there. */
export type PendingReveal = {
	id: number;
	missions?: MissionsCompletedPacket;
	letter?: RoyalLetterPacket;
};
