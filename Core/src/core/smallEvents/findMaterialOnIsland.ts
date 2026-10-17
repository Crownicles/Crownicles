import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { smallEventFuncs as findMaterialSmallEventFuncs } from "./findMaterial";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnPveIsland,
	executeSmallEvent: findMaterialSmallEventFuncs.executeSmallEvent
};
