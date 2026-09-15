import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { CommandReportTravelSummaryRes } from "./CommandReportPacket";
import {
	ReportCityActionResult, ReportCityView
} from "../../types/ReportView";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportViewReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportViewRes extends CrowniclesPacket {
	travel?: CommandReportTravelSummaryRes;

	reportReady!: boolean;

	city?: ReportCityView;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCityActionReq extends CrowniclesPacket {
	mapLocationId!: number;

	actionId!: string;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCityActionRes extends CrowniclesPacket {
	result!: ReportCityActionResult;
}
