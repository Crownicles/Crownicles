import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {
	collectorDescription, collectorTitle, reactionLabel
} from "@/src/collectors/CollectorLabels";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: (path: string): string | null => path === "events.19.butch"
			? "🦊"
			: path === "events.19.end.0" ? "🚶" : null
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

const eventData = {
	type: BIG_EVENT_DATA_KINDS.COLLECTOR,
	data: {eventId: 19}
};

describe("CollectorLabels", () => {
	it("uses the event asset and translation for the prompt description", () => {
		expect(collectorTitle(eventData)).toBe("app:collector.titles.bigEvent");
		expect(collectorDescription(eventData)).toBe("events:19.text");
	});

	it("uses the event-specific icon and possibility translation", () => {
		expect(reactionLabel({
			type: BIG_EVENT_REACTION_KINDS.POSSIBILITY,
			data: {name: "butch"}
		}, eventData)).toBe("🦊 events:19.possibilities.butch.text");
	});

	it("falls back to the end icon when the event asset stores outcomes under end", () => {
		expect(reactionLabel({
			type: BIG_EVENT_REACTION_KINDS.POSSIBILITY,
			data: {name: "end"}
		}, eventData)).toBe("🚶 events:19.possibilities.end.text");
	});
});