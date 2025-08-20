import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventSpaceInitialPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventSpaceResultPacket extends SmallEventPacket {
	chosenEvent!: "neoWS" | "moonPhase" | "nextFullMoon" | "nextPartialLunarEclipse" | "nextTotalLunarEclipse";

	values!: SpaceFunctionResult;
}

export type SpaceFunctionResult = {
	mainValue: number;
	randomObjectName?: string;
	randomObjectDistance?: number;
	randomObjectDiameter?: number;
};
