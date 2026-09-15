import { createHash } from "node:crypto";
import {
	City, CityDataController
} from "../../data/City";
import { Player } from "../database/game/models/Player";
import { Maps } from "../maps/Maps";
import { buildTravelSummary } from "./ReportTravelService";
import { CommandReportViewRes } from "../../../../Lib/src/packets/commands/CommandReportViewPacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCity, ReactionCollectorCityData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReportCityAction, ReportCityView
} from "../../../../Lib/src/types/ReportView";
import { Effect } from "../../../../Lib/src/types/Effect";

const CITY_ACTION_HASH = "sha256";

export function getReportCity(player: Player, now: Date): City | undefined {
	if (!player.insideCity || !player.currentEffectFinished(now)) {
		return undefined;
	}
	const destination = player.getDestinationId();
	return destination === null ? undefined : CityDataController.instance.getCityByMapId(destination);
}

export function buildCityView(data: ReactionCollectorCityData): ReportCityView {
	const offers = createHash(CITY_ACTION_HASH).update(JSON.stringify({
		homeManage: data.home.manage,
		homeLevel: data.home.owned?.level,
		upgradeStation: data.home.owned?.upgradeStation,
		enchanter: data.enchanter,
		blacksmith: data.blacksmith,
		scrapDealer: data.scrapDealer,
		royalBlacksmith: data.royalBlacksmith,
		guildDomainNotary: data.guildDomainNotary,
		apartmentNotary: data.apartmentNotary
	}))
		.digest("hex");
	return {
		data,
		actions: new ReactionCollectorCity(data).getReactions()
			.filter(reaction => reaction.type !== ReactionCollectorRefuseReaction.name)
			.map((reaction): ReportCityAction => ({
				id: createHash(CITY_ACTION_HASH).update(JSON.stringify([
					data.mapLocationId,
					offers,
					reaction
				]))
					.digest("hex"),
				reaction
			}))
	};
}

export async function buildReportView(player: Player, now: Date): Promise<CommandReportViewRes> {
	if (player.effectId === Effect.NOT_STARTED.id) {
		return makePacket(CommandReportViewRes, { reportReady: true });
	}
	const effect = player.currentEffectFinished(now) ? null : player.effectId;
	const travel = await buildTravelSummary(player, now, effect);
	const reportReady = !player.insideCity
		&& (Maps.isArrived(player, now) || travel.nextStopTime <= now.valueOf() || effect === null && !Maps.isTravelling(player));
	return makePacket(CommandReportViewRes, {
		travel, reportReady
	});
}
