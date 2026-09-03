import { ReactionCollectorCreation } from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	BIG_EVENT_DATA_KINDS, ITEM_DATA_KINDS, REPORT_COLLECTOR_DATA_KINDS,
	SMALL_EVENT_DATA_KINDS, CITY_DATA_KINDS, SHOP_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";

const ADVENTURE_COLLECTOR_TYPES = new Set<string>([
	BIG_EVENT_DATA_KINDS.COLLECTOR,
	CITY_DATA_KINDS.CITY,
	SHOP_DATA_KINDS.COLLECTOR,
	REPORT_COLLECTOR_DATA_KINDS.DESTINATION,
	REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS,
	REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL,
	REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT,
	ITEM_DATA_KINDS.CHOICE,
	ITEM_DATA_KINDS.ACCEPT,
	SMALL_EVENT_DATA_KINDS.ALTAR,
	SMALL_EVENT_DATA_KINDS.BAD_PET,
	SMALL_EVENT_DATA_KINDS.GARDENER,
	SMALL_EVENT_DATA_KINDS.GOBLETS_GAME,
	SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS,
	SMALL_EVENT_DATA_KINDS.LIMOGES,
	SMALL_EVENT_DATA_KINDS.LOTTERY,
	SMALL_EVENT_DATA_KINDS.PET_FOOD,
	SMALL_EVENT_DATA_KINDS.WITCH
]);

/**
 * Collectors which are part of the report journey belong in the Adventure tab rather than in the
 * application-wide fallback prompt. Keeping this decision on the wire kind prevents a screen from
 * guessing where a server initiated collector came from.
 */
export function isAdventureCollector(collector: ReactionCollectorCreation): boolean {
	return ADVENTURE_COLLECTOR_TYPES.has(collector.data.type);
}

export function isBigEventCollector(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === BIG_EVENT_DATA_KINDS.COLLECTOR;
}

export function isTokenUseCollector(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS;
}

export function isBuyHealCollector(collector: ReactionCollectorCreation): boolean {
	return collector.data.type === REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL;
}

export function isAdventureScreenCollector(collector: ReactionCollectorCreation): boolean {
	return isAdventureCollector(collector) && !isTokenUseCollector(collector) && !isBuyHealCollector(collector);
}
