import {FromServerPacket} from "../FromServerPacket";

/** The player confirmed buying an alteration cure. */
export class ReportBuyHealAcceptedRes extends FromServerPacket {
	healPrice!: number;

	isArrived!: boolean;
}

/** The player declined buying an alteration cure. */
export class ReportBuyHealRefusedRes extends FromServerPacket {}

/** The cure request arrived after the alteration had already ended. */
export class ReportBuyHealNoAlterationRes extends FromServerPacket {}

/** Occupied can only be removed with tokens, never with money. */
export class ReportBuyHealCannotHealOccupiedRes extends FromServerPacket {}
