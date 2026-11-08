import type { Href } from "expo-router";

/** The search parameter through which another screen asks the adventure to open one of its tools. */
export const ADVENTURE_TOOL_PARAM = "tool";

export const ADVENTURE_TOOL_NAMES = {
	MAP: "map", MISSIONS: "missions", JOURNAL: "journal"
} as const;
export type AdventureToolName = typeof ADVENTURE_TOOL_NAMES[keyof typeof ADVENTURE_TOOL_NAMES];

/** The missions live on the adventure: every screen reaches them there. */
export const ADVENTURE_MISSIONS: Href = {
	pathname: "/", params: { [ADVENTURE_TOOL_PARAM]: ADVENTURE_TOOL_NAMES.MISSIONS }
};

/** The search parameter through which another screen asks the missions to open on one of their views. */
export const MISSIONS_VIEW_PARAM = "missionsView";

export const MISSIONS_VIEWS = {
	MISSIONS: "missions", KING_CHALLENGE: "kingChallenge"
} as const;
export type MissionsView = typeof MISSIONS_VIEWS[keyof typeof MISSIONS_VIEWS];
