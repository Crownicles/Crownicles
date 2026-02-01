import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorCart } from "../../../../Lib/src/packets/interaction/ReactionCollectorCart";
import Player from "../database/game/models/Player";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventCartPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { crowniclesInstance } from "../../index";

type CartResult = {
	destination: MapLink;
	scamDestination?: MapLink;
	isScam: boolean;
	isDisplayed: boolean;
	price: number;
};

function getEndCallback(player: Player, destination: CartResult): EndCallback {
	return async (collector, response) => {
		const reaction = collector.getFirstReaction();
		const packet: SmallEventCartPacket = {
			isScam: destination.isScam,
			isDisplayed: destination.isDisplayed,
			travelDone: {
				isAccepted: true,
				hasEnoughMoney: player.money >= destination.price
			}
		};

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			if (packet.travelDone.hasEnoughMoney) {
				const newMapLinkId = destination.isScam ? destination.scamDestination!.id : destination.destination.id;
				crowniclesInstance?.logsDatabase.logTeleportation(player.keycloakId, player.mapLinkId, newMapLinkId).then();
				player.mapLinkId = newMapLinkId;
				await player.spendMoney({
					amount: destination.price, response, reason: NumberChangeReason.SMALL_EVENT
				});
			}
			response.push(makePacket(SmallEventCartPacket, packet));
		}
		else {
			packet.travelDone.isAccepted = false;
			response.push(makePacket(SmallEventCartPacket, packet));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CART_SMALL_EVENT);
		await player.save();
	};
}

function generateRandomDestination(player: Player): CartResult {
	const chance = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
	const destination = MapLinkDataController.instance.generateRandomMapLinkDifferentOfCurrent(player.mapLinkId);
	const result: CartResult = {
		destination,
		isScam: false,
		isDisplayed: true,
		price: 0
	};

	if (chance <= SmallEventConstants.CART.TRANSPARENT_TP_THRESHOLD) {
		// The player knows where they will be teleported
		result.price = SmallEventConstants.CART.TRANSPARENT_TP_PRICE;
	}
	else if (chance <= SmallEventConstants.CART.HIDDEN_TP_THRESHOLD) {
		// The player doesn't know where they will be teleported
		result.isDisplayed = false;
		result.price = SmallEventConstants.CART.HIDDEN_TP_PRICE;
	}
	else if (chance <= SmallEventConstants.CART.SCAM_THRESHOLD) {
		// The NPC lied about the destination but offers the trip for cheap
		result.isScam = true;
		result.scamDestination = MapLinkDataController.instance.generateRandomMapLinkDifferentOfCurrent(player.mapLinkId);
		result.price = SmallEventConstants.CART.SCAM_TP_PRICE;
	}
	else {
		// The trip is just cheap
		result.price = SmallEventConstants.CART.SCAM_TP_PRICE;
	}

	result.price = Math.round(result.price * (1 + RandomUtils.crowniclesRandom.realZeroToOneInclusive() * SmallEventConstants.CART.RANDOM_PRICE_BONUS));

	return result;
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: (response, player, context): void => {
		const randomDestination = generateRandomDestination(player);

		const collector = new ReactionCollectorCart(
			{
				isDisplayed: randomDestination.isDisplayed,
				id: randomDestination.destination.endMap,
				type: MapLocationDataController.instance.getById(randomDestination.destination.endMap)!.type
			},
			randomDestination.price
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player, randomDestination)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.CART_SMALL_EVENT)
			.build();

		response.push(packet);
	}
};
