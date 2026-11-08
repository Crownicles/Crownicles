import {
	CrowniclesPacket, makePacket, PacketLike
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCreationPacket, ReactionCollectorData
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorRecipeShopSmallEventData, RecipeShopSource
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import { SmallEventFarmerPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import { LibClassRef } from "./CollectorMapping";

/** A packet as Core publishes it for a WebSocket front. */
export type CorePacket = {
	name: string;
	packet: CrowniclesPacket;
};

/** The outcome a collector class may carry, given back as the small-event packet it stands for, or null when it carries none. */
type FoldedOutcome = {
	serverType: string;
	unfold: (data: ReactionCollectorData) => CorePacket | null;
};

function smallEventPacket<Packet extends CrowniclesPacket>(packetClass: PacketLike<Packet>, fields: Packet): CorePacket {
	return {
		name: packetClass.name,
		packet: makePacket(packetClass, fields)
	};
}

/**
 * Declares which small-event outcome a collector class carries. Like the collector mappings, it is
 * declared against the Lib class, so a rename breaks the compilation instead of the story.
 * @param libClass Back-end collector data class
 * @param unfold Gives the outcome back as the small-event packet it stands for
 */
function defineFoldedOutcome<Instance extends ReactionCollectorData>(
	libClass: LibClassRef<Instance>,
	unfold: (data: Instance) => CorePacket | null
): FoldedOutcome {
	return {
		serverType: libClass.name,
		unfold: (data: ReactionCollectorData): CorePacket | null => unfold(data as Instance)
	};
}

/** Gaspard-Jo and the farmer give their reward first, then offer a recipe: Discord tells both in the offer. */
function recipeShopOutcome(data: ReactionCollectorRecipeShopSmallEventData): CorePacket | null {
	if (data.source === RecipeShopSource.FARMER && data.farmer) {
		return smallEventPacket(SmallEventFarmerPacket, data.farmer);
	}
	if (data.source === RecipeShopSource.GASPARD_JO && data.ultimateFoodMerchant) {
		return smallEventPacket(SmallEventUltimateFoodMerchantPacket, data.ultimateFoodMerchant);
	}
	return null;
}

const FOLDED_OUTCOMES = new Map([defineFoldedOutcome(ReactionCollectorRecipeShopSmallEventData, recipeShopOutcome)]
	.map(folded => [folded.serverType, folded.unfold]));

/**
 * A small event may fold the outcome it just applied into the question it chains, because Discord
 * shows both in one message. The app tells an outcome before asking anything: the folded outcome is
 * sent first, as the small-event packet it stands for, and the question follows, untouched.
 * @param corePacket A packet as Core published it
 */
export function unfoldSmallEventOutcome(corePacket: CorePacket): CorePacket[] {
	if (corePacket.name !== ReactionCollectorCreationPacket.name) {
		return [corePacket];
	}
	const { data } = corePacket.packet as ReactionCollectorCreationPacket;
	const outcome = FOLDED_OUTCOMES.get(data.type)?.(data.data) ?? null;
	return outcome ? [outcome, corePacket] : [corePacket];
}
