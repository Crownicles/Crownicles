import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import { Effect } from "../../../../Lib/src/types/Effect";
import { RespawnConstants } from "../../../../Lib/src/constants/RespawnConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Maps } from "../../core/maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { TravelTime } from "../../core/maps/TravelTime";
import { PlayerSmallEvents } from "../../core/database/game/models/PlayerSmallEvent";
import {
	CommandRespawnErrorAlreadyAlive,
	CommandRespawnPacketReq,
	CommandRespawnPacketRes
} from "../../../../Lib/src/packets/commands/CommandRespawnPacket";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class RespawnCommand {
	/**
	 * Respawn the player
	 * @param response
	 * @param player
	 */
	@commandRequires(CommandRespawnPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		if (player.effectId !== Effect.DEAD.id) {
			response.push(makePacket(CommandRespawnErrorAlreadyAlive, {}));
			return;
		}
		const lostScore = Math.round(player.score * RespawnConstants.SCORE_REMOVAL_MULTIPLIER);
		await player.addHealth({
			amount: player.getMaxHealthBase() - player.getHealthValue(),
			response,
			reason: NumberChangeReason.RESPAWN,
			missionHealthParameter: {
				shouldPokeMission: false,
				overHealCountsForMission: false
			}
		});
		await player.addScore({
			amount: -lostScore,
			response,
			reason: NumberChangeReason.RESPAWN
		});
		await player.setRage(0, NumberChangeReason.RESPAWN); // Remove rage in case the player died while in the pve island

		await player.save();

		await Maps.stopTravel(player);
		const newlink = MapLinkDataController.instance.getLinkByLocations(
			player.getPreviousMapId()!,
			player.getDestinationId()!
		);
		if (!newlink) {
			throw new Error("Failed to find map link for respawn");
		}

		await TravelTime.removeEffect(player, NumberChangeReason.RESPAWN);
		await Maps.startTravel(player, newlink, Date.now());

		await PlayerSmallEvents.removeSmallEventsOfPlayer(player.id);
		response.push(makePacket(CommandRespawnPacketRes, { lostScore }));
	}
}

