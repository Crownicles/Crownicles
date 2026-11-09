import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCityActionRes, CommandReportViewRes
} from "../../../../../Lib/src/packets/commands/CommandReportViewPacket";
import { ReactionCollectorCityData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReportCityView as CoreCityView } from "../../../../../Lib/src/types/ReportView";
import {
	REPORT_CITY_ACTION_RESULTS, ReportCityView
} from "../../../../../WsPackets/src/objects/ReportView";
import {
	ReportCityActionRes, ReportViewRes
} from "../../../../../WsPackets/src/fromServer/report/ReportViewRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { mapCollectorContent } from "../collectors/ReactionCollectorMapper";
import ReportCommandServerTranslator from "./ReportCommandServerTranslator";
import { CommandReportEquipmentChangedRes } from "../../../../../Lib/src/packets/commands/CommandReportPacket";

function mapCityView(view: CoreCityView): ReportCityView {
	const content = mapCollectorContent({
		data: {
			type: ReactionCollectorCityData.name, data: view.data
		},
		reactions: view.actions.map(action => action.reaction)
	});
	return {
		data: content.data,
		actions: view.actions.map((action, index) => ({
			id: action.id, reaction: content.reactions[index]
		}))
	};
}

export default class ReportViewServerTranslator {
	@fromServerTranslator(CommandReportViewRes, ReportViewRes)
	public static async view(context: PacketContext, packet: CommandReportViewRes): Promise<ReportViewRes> {
		return asyncMakeFromServerPacket(ReportViewRes, {
			...packet.travel ? { travel: await ReportCommandServerTranslator.translate(context, packet.travel) } : {},
			reportReady: packet.reportReady,
			...packet.city ? { city: mapCityView(packet.city) } : {}
		});
	}

	@fromServerTranslator(CommandReportCityActionRes, ReportCityActionRes)
	public static action(_context: PacketContext, packet: CommandReportCityActionRes): Promise<ReportCityActionRes> {
		return asyncMakeFromServerPacket(ReportCityActionRes, { result: packet.result });
	}

	/**
	 * The equipment the action targeted moved since the city was listed: nothing was spent and Core sends the refreshed city
	 * right after, which is what a stale action already tells the player. Arriving first, it answers the pending action.
	 */
	@fromServerTranslator(CommandReportEquipmentChangedRes, ReportCityActionRes)
	public static equipmentChanged(_context: PacketContext, _packet: CommandReportEquipmentChangedRes): Promise<ReportCityActionRes> {
		return asyncMakeFromServerPacket(ReportCityActionRes, { result: REPORT_CITY_ACTION_RESULTS.STALE });
	}
}
