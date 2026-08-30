import { FromServerPacket } from "../FromServerPacket";

/**
 * The city collector expires into the same state as an explicit "stay" choice. This pushed
 * packet lets mobile clients refresh their report without presenting a Discord-only button.
 */
export class ReportStayInCity extends FromServerPacket {}
