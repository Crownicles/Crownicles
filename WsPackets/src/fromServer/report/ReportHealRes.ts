import { FromServerPacket } from "../FromServerPacket";

/** The player confirmed buying an alteration cure. */
export class ReportBuyHealAcceptedRes extends FromServerPacket {
	public static readonly wireName = "ReportBuyHealAcceptedRes";

	healPrice!: number;

	isArrived!: boolean;
}

/** The player declined buying an alteration cure. */
export class ReportBuyHealRefusedRes extends FromServerPacket {
	public static readonly wireName = "ReportBuyHealRefusedRes";
}

/** The cure request arrived after the alteration had already ended. */
export class ReportBuyHealNoAlterationRes extends FromServerPacket {
	public static readonly wireName = "ReportBuyHealNoAlterationRes";
}

/** Occupied can only be removed with tokens, never with money. */
export class ReportBuyHealCannotHealOccupiedRes extends FromServerPacket {
	public static readonly wireName = "ReportBuyHealCannotHealOccupiedRes";
}
