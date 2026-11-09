import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetSellSuccessPacket, CommandPetSellCancelPacket, CommandPetSellNoOneAvailableErrorPacket,
	CommandPetSellInitiatorSituationChangedErrorPacket, CommandPetSellSameGuildError, CommandPetSellAlreadyHavePetError,
	CommandPetSellNotEnoughMoneyError, CommandPetSellOnlyOwnerCanCancelErrorPacket
} from "../../../../Lib/src/packets/commands/CommandPetSellPacket";
import { ReactionCollectorStopPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import {
	ReactionCollectorPetSell, ReactionCollectorPetSellData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetSell";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	CollectCallback, EndCallback, ReactionCollectorInstance
} from "./ReactionsCollector";
import { BlockingUtils } from "./BlockingUtils";
import { PacketUtils } from "./PacketUtils";

const SALE_RESULTS = [
	CommandPetSellSuccessPacket,
	CommandPetSellCancelPacket,
	CommandPetSellNoOneAvailableErrorPacket,
	CommandPetSellInitiatorSituationChangedErrorPacket,
	ReactionCollectorStopPacket,
	CommandPetSellSameGuildError,
	CommandPetSellAlreadyHavePetError,
	CommandPetSellNotEnoughMoneyError
];

function relaySaleResult(context: PacketContext, recipient: string | undefined, response: CrowniclesPacket[]): void {
	if (!context.webSocket || !recipient) {
		return;
	}
	PacketUtils.sendPackets(PacketUtils.webSocketContextForPlayer(context, recipient), response.filter(packet => SALE_RESULTS.some(Packet => packet instanceof Packet)));
}

function refuseSale(offer: ReactionCollectorPetSellData, keycloakId: string, response: CrowniclesPacket[], context: PacketContext): boolean {
	const invitedBuyer = context.webSocket ? offer.buyerKeycloakId : undefined;
	if (keycloakId !== offer.sellerKeycloakId && keycloakId !== invitedBuyer) {
		response.push(makePacket(CommandPetSellOnlyOwnerCanCancelErrorPacket, {}));
		return false;
	}
	response.push(makePacket(CommandPetSellCancelPacket, {}));
	return true;
}

export function createPetSaleCollector(offer: ReactionCollectorPetSellData, context: PacketContext, onAccept: CollectCallback): ReactionCollectorInstance {
	let collecting = false;
	const endCallback: EndCallback = (collector, response): void => {
		BlockingUtils.unblockPlayer(offer.sellerKeycloakId, BlockingConstants.REASONS.PET_SELL);
		if (!collector.hasEndedByTime) {
			return;
		}
		if (!collecting) {
			response.push(makePacket(CommandPetSellNoOneAvailableErrorPacket, {}));
		}
		relaySaleResult(context, offer.buyerKeycloakId, response);
	};
	const processReaction: CollectCallback = async (collector, reaction, keycloakId, response): Promise<void> => {
		if (reaction instanceof ReactionCollectorAcceptReaction) {
			await onAccept(collector, reaction, keycloakId, response);
			if (context.webSocket && !collector.hasEnded) {
				await collector.end(response);
			}
		}
		else if (refuseSale(offer, keycloakId, response, context)) {
			await collector.end(response);
		}
		if (collector.hasEnded) {
			relaySaleResult(context, keycloakId === offer.sellerKeycloakId ? offer.buyerKeycloakId : offer.sellerKeycloakId, response);
		}
	};
	const collectCallback: CollectCallback = async (collector, reaction, keycloakId, response): Promise<void> => {
		if (collecting) {
			return;
		}
		collecting = true;
		try {
			await processReaction(collector, reaction, keycloakId, response);
		}
		finally {
			collecting = false;
		}
	};
	return new ReactionCollectorInstance(new ReactionCollectorPetSell(offer.sellerKeycloakId, offer.price, offer.pet, offer.buyerKeycloakId), context, {
		...offer.buyerKeycloakId ? { allowedPlayerKeycloakIds: [offer.sellerKeycloakId, offer.buyerKeycloakId] } : {},
		...context.webSocket && offer.buyerKeycloakId ? { visiblePlayerKeycloakIds: [offer.sellerKeycloakId, offer.buyerKeycloakId] } : {},
		reactionLimit: -1
	}, endCallback, collectCallback).block(offer.sellerKeycloakId, BlockingConstants.REASONS.PET_SELL);
}
