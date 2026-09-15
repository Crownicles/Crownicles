import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCityActionReq, CommandReportCityActionRes, CommandReportViewReq
} from "../../../../Lib/src/packets/commands/CommandReportViewPacket";
import { REPORT_CITY_ACTION_RESULTS } from "../../../../Lib/src/types/ReportView";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	buildCityView, buildReportView, getReportCity
} from "../../core/report/ReportViewService";
import {
	buildCitySnapshot, handleCityReaction
} from "./ReportCommand";

async function sendReportView(response: CrowniclesPacket[], player: Player): Promise<void> {
	const now = new Date();
	const view = await buildReportView(player, now);
	const city = getReportCity(player, now);
	if (city) {
		view.city = buildCityView(await buildCitySnapshot(player, city));
	}
	response.push(view);
}

async function executeCityAction(response: CrowniclesPacket[], player: Player, packet: CommandReportCityActionReq, context: PacketContext): Promise<void> {
	await player.reload();
	const city = getReportCity(player, new Date());
	if (!city || player.getDestinationId() !== packet.mapLocationId) {
		response.push(makePacket(CommandReportCityActionRes, { result: REPORT_CITY_ACTION_RESULTS.STALE }));
		return;
	}
	const view = buildCityView(await buildCitySnapshot(player, city));
	const action = view.actions.find(choice => choice.id === packet.actionId);
	if (!action) {
		response.push(makePacket(CommandReportCityActionRes, { result: REPORT_CITY_ACTION_RESULTS.STALE }));
		return;
	}
	await handleCityReaction(action.reaction.type, {
		context,
		player,
		city,
		response,
		forceSpecificEvent: 0,
		reactionData: action.reaction.data,
		collectorData: view.data,
		onReturnToCity: async closeResponse => {
			await player.reload();
			await sendReportView(closeResponse, player);
		}
	});
	response.push(makePacket(CommandReportCityActionRes, { result: REPORT_CITY_ACTION_RESULTS.EXECUTED }));
}

export default class ReportViewCommand {
	@commandRequires(CommandReportViewReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async view(response: CrowniclesPacket[], player: Player): Promise<void> {
		await sendReportView(response, player);
	}

	@commandRequires(CommandReportCityActionReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async cityAction(response: CrowniclesPacket[], player: Player, packet: CommandReportCityActionReq, context: PacketContext): Promise<void> {
		if (BlockingUtils.appendBlockedPacket(player.keycloakId, response)) {
			return;
		}
		BlockingUtils.blockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
		try {
			await executeCityAction(response, player, packet, context);
		}
		finally {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
		}
	}
}
