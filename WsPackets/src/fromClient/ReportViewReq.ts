import { FromClientPacket } from "./FromClientPacket";

export class ReportViewReq extends FromClientPacket {
	public static readonly wireName = "ReportViewReq";
}

export class ReportCityActionReq extends FromClientPacket {
	public static readonly wireName = "ReportCityActionReq";

	mapLocationId!: number;

	actionId!: string;
}
