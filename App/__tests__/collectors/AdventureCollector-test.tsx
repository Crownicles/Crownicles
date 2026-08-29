import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {AdventureCollector, BigEventOutcome} from "@/src/collectors/AdventureCollector";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIconOrNull: (): null => null
	}
}));

jest.mock("@/src/collectors/CollectorLabels", () => ({
	collectorDescription: (): string => "small-event-description",
	collectorTitle: (): string => "small-event-title",
	isChoosable: (): boolean => true,
	reactionLabel: (): string => "small-event-choice"
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

function smallEvent(): ReactionCollectorCreation {
	return {
		id: "small-event",
		endTime: Date.now() + 60_000,
		data: {
			type: SMALL_EVENT_DATA_KINDS.ALTAR,
			data: {poolAmount: 10, poolThreshold: 100}
		},
		reactions: [{
			type: SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			data: {amount: 5}
		}]
	};
}

function bigEventOutcome(): ReportBigEventResultRes {
	return {
		eventId: 19,
		possibilityId: "cook",
		outcomeId: "success",
		score: 15,
		experience: 10,
		effect: {name: "slowed", time: 15 * 60_000},
		health: -3,
		money: 20,
		energy: -2,
		gems: 1,
		tokens: 0,
		oneshot: false
	};
}

describe("AdventureCollector", () => {
	it("uses the Adventure tab composition for a mini-event and submits its indexed choice", async () => {
		const onChoose = jest.fn();
		await render(<AdventureCollector collector={smallEvent()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.smallEvent.eyebrow")).toBeTruthy();
		expect(screen.getByText("small-event-title")).toBeTruthy();
		expect(screen.getByText("small-event-description")).toBeTruthy();
		await fireEvent.press(screen.getByText("small-event-choice"));

		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("shows a big-event outcome before the player continues", async () => {
		const onContinue = jest.fn();
		await render(<BigEventOutcome outcome={bigEventOutcome()} onContinue={onContinue} />);

		expect(screen.getByText("events:19.possibilities.cook.outcomes.success")).toBeTruthy();
		expect(screen.getByText("app:adventure.event.fields.money")).toBeTruthy();
		expect(screen.getByText("+20")).toBeTruthy();
		expect(screen.getByText("app:adventure.event.fields.timeLost")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.event.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
