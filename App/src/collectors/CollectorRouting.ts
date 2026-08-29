import { ReactionCollectorCreation } from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	BIG_EVENT_DATA_KINDS, ITEM_DATA_KINDS, REPORT_COLLECTOR_DATA_KINDS,
	SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";

/**
 * Collectors which are part of the report journey belong in the Adventure tab rather than in the
 * application-wide fallback prompt. Keeping this decision on the wire kind prevents a screen from
 * guessing where a server initiated collector came from.
 */
export function isAdventureCollector(collector: ReactionCollectorCreation): boolean {
	switch (collector.data.type) {
			case BIG_EVENT_DATA_KINDS.COLLECTOR:
			case REPORT_COLLECTOR_DATA_KINDS.DESTINATION:
			case REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS:
			case REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT:
		case ITEM_DATA_KINDS.CHOICE:
		case ITEM_DATA_KINDS.ACCEPT:
		case SMALL_EVENT_DATA_KINDS.ALTAR:
		case SMALL_EVENT_DATA_KINDS.BAD_PET:
		case SMALL_EVENT_DATA_KINDS.GARDENER:
		case SMALL_EVENT_DATA_KINDS.GOBLETS_GAME:
		case SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS:
		case SMALL_EVENT_DATA_KINDS.LIMOGES:
		case SMALL_EVENT_DATA_KINDS.LOTTERY:
		case SMALL_EVENT_DATA_KINDS.PET_FOOD:
		case SMALL_EVENT_DATA_KINDS.WITCH:
			return true;
		default:
			return false;
	}
}

export function isBigEventCollector(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === BIG_EVENT_DATA_KINDS.COLLECTOR;
}
