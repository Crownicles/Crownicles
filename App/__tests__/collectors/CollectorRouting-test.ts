import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ITEM_DATA_KINDS, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {isAdventureCollector, isAdventureScreenCollector, isFoundItemCollector} from "@/src/collectors/CollectorRouting";

function collectorOf(type: string): ReactionCollectorCreation {
	return {id: type, endTime: Date.now() + 60_000, data: {type, data: {}}, reactions: []} as ReactionCollectorCreation;
}

describe("CollectorRouting", () => {
	it.each(Object.values(SMALL_EVENT_DATA_KINDS))("routes %s inside the Adventure tab", type => {
		expect(isAdventureCollector(collectorOf(type))).toBe(true);
	});

	it.each([ITEM_DATA_KINDS.CHOICE, ITEM_DATA_KINDS.ACCEPT])("keeps a found item (%s) out of any tab, to be answered in full screen", type => {
		const collector = collectorOf(type);
		expect(isFoundItemCollector(collector)).toBe(true);
		expect(isAdventureScreenCollector(collector)).toBe(false);
	});
});