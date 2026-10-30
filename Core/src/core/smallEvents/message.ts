/* @lockInherited — body runs under loadAndExecuteSmallEvents withLockedPlayerAndMissions callback. */
import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventMessagePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventMessagePacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { PlayerMessageDeliveries } from "../database/game/models/PlayerMessageDelivery";
import { MapLocationDataController } from "../../data/MapLocation";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => Maps.isOnContinent(player),
	executeSmallEvent: async (response, player): Promise<void> => {
		const existingDelivery = await PlayerMessageDeliveries.getOfPlayer(player.id);
		if (existingDelivery) {
			response.push(makePacket(SmallEventMessagePacket, {
				interactionName: SmallEventConstants.MESSAGE.INTERACTIONS.ALREADY_ACTIVE,
				destinationLocationId: existingDelivery.destinationLocationId
			}));
			return;
		}

		const currentDest = player.getDestinationId();
		const currentOrigin = player.getPreviousMapId();
		const availableLocations = MapLocationDataController.instance
			.getAll()
			.filter(m => m.canBeGoToPlaceMissionDestination && m.id !== currentDest && m.id !== currentOrigin);

		const destinationLocation = availableLocations.length > 0
			? RandomUtils.crowniclesRandom.pick(availableLocations)
			: MapLocationDataController.instance.getRandomGotoableMap();

		const secretEmoji = RandomUtils.crowniclesRandom.pick(
			SmallEventConstants.MESSAGE.SECRET_EMOJIS as unknown as string[]
		);

		await PlayerMessageDeliveries.createDelivery(
			player.id,
			destinationLocation.id,
			secretEmoji
		);

		response.push(makePacket(SmallEventMessagePacket, {
			interactionName: SmallEventConstants.MESSAGE.INTERACTIONS.INTRO,
			destinationLocationId: destinationLocation.id,
			secretEmoji,
			vanishAfterMs: SmallEventConstants.MESSAGE.VANISH_TIME_MS
		}));
	}
};
