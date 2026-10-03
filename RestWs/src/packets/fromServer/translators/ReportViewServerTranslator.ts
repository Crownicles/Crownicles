import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCityActionRes, CommandReportViewRes
} from "../../../../../Lib/src/packets/commands/CommandReportViewPacket";
import { ReactionCollectorCityData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReportCityView as CoreCityView } from "../../../../../Lib/src/types/ReportView";
import { ReportCityView } from "../../../../../WsPackets/src/objects/ReportView";
import {
	ReportCityActionRes, ReportViewRes
} from "../../../../../WsPackets/src/fromServer/report/ReportViewRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { mapCollectorContent } from "../collectors/ReactionCollectorMapper";
import ReportCommandServerTranslator from "./ReportCommandServerTranslator";

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
}
