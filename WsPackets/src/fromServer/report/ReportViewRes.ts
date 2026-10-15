import { FromServerPacket } from "../FromServerPacket";
import { ReportTravelSummaryRes } from "./ReportTravelSummaryRes";
import {
	ReportCityActionResult, ReportCityView
} from "../../objects/ReportView";

export class ReportViewRes extends FromServerPacket {
	public static readonly wireName = "ReportViewRes";

	travel?: ReportTravelSummaryRes;

	reportReady!: boolean;

	city?: ReportCityView;
}

export class ReportCityActionRes extends FromServerPacket {
	public static readonly wireName = "ReportCityActionRes";

	result!: ReportCityActionResult;
}
