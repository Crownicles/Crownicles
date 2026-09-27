import type {Href} from "expo-router";

/** The search parameter through which another screen asks the adventure to open one of its tools. */
export const ADVENTURE_TOOL_PARAM = "tool";

export const ADVENTURE_TOOL_NAMES = {MAP: "map", MISSIONS: "missions"} as const;
export type AdventureToolName = typeof ADVENTURE_TOOL_NAMES[keyof typeof ADVENTURE_TOOL_NAMES];

/** The missions live on the adventure: every screen reaches them there. */
export const ADVENTURE_MISSIONS: Href = {pathname: "/", params: {[ADVENTURE_TOOL_PARAM]: ADVENTURE_TOOL_NAMES.MISSIONS}};
