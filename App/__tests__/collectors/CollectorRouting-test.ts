import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {isAdventureCollector} from "@/src/collectors/CollectorRouting";

describe("CollectorRouting", () => {
	it.each(Object.values(SMALL_EVENT_DATA_KINDS))("routes %s inside the Adventure tab", type => {
		const collector = {
			id: type,
			endTime: Date.now() + 60_000,
			data: {type, data: {}},
			reactions: []
		} as ReactionCollectorCreation;

		expect(isAdventureCollector(collector)).toBe(true);
	});
});