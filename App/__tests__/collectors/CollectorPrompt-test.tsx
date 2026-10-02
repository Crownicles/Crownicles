import {ReactElement} from "react";
import {fireEvent, render, screen} from "@testing-library/react-native";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

jest.mock("@/src/collectors/CollectorLabels", () => ({
	collectorDescription: (): undefined => undefined,
	collectorTitle: (): string => "collector title",
	isChoosable: (reaction: {type: string}): boolean => reaction.type !== "unknown",
	reactionLabel: (reaction: {type: string}): string => reaction.type === "unknown" ? "unknown choice" : "valid choice"
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));
jest.mock("@/src/display/Clock", () => ({clockTime: (): string => "12:30"}));

function collector(): ReactionCollectorCreation {
	return {
		id: "collector-1",
		endTime: Date.now() + 60_000,
		data: {
			type: "unknown",
			data: {serverType: "test"}
		},
		reactions: [
			{type: "accept", data: {}},
			{type: "unknown", data: {serverType: "future"}}
		]
	};
}

describe("CollectorPrompt", () => {
	it("presents choices as explicit actions with the deadline after them instead of a countdown target", async () => {
		await render(<CollectorPrompt collector={collector()} onChoose={jest.fn()} />);
		expect(screen.getByText("app:collector.yourAction")).toBeTruthy();
		expect(screen.getByRole("button", {name: "valid choice"})).toBeTruthy();
		expect(screen.getByText("app:collector.replyBefore")).toBeTruthy();
		expect(screen.queryByText("app:collector.timeLeft")).toBeNull();
	});

	it("sends one index and locks every choice after the first press", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={collector()} onChoose={onChoose} />);

		await fireEvent.press(screen.getByText("valid choice"));
		await fireEvent.press(screen.getByText("valid choice"));

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(0);
		expect(screen.getByText("app:collector.answering")).toBeTruthy();
		expect(screen.queryByText("app:collector.replyBefore")).toBeNull();
	});

	it("does not offer an unknown reaction as an enabled choice", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={collector()} onChoose={onChoose} />);

		const unknownChoice = screen.getByText("unknown choice");
		await fireEvent.press(unknownChoice);

		expect(onChoose).not.toHaveBeenCalled();
	});

	it("unlocks choices when the next collector replaces an answered one", async () => {
		const onChoose = jest.fn();
		const firstCollector = collector();
		const view = await render(<CollectorPrompt collector={firstCollector} onChoose={onChoose} />);

		await fireEvent.press(screen.getByText("valid choice"));
		await view.rerender(<CollectorPrompt collector={{...firstCollector, id: "collector-2"}} onChoose={onChoose} />);
		await fireEvent.press(screen.getByText("valid choice"));

		expect(onChoose).toHaveBeenCalledTimes(2);
	});

	it("shows an expired reply deadline and does not submit any choice", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={{...collector(), endTime: Date.now() - 1000}} onChoose={onChoose} />);
		expect(screen.getByText("app:collector.expired")).toBeTruthy();
		await fireEvent.press(screen.getByText("valid choice"));
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("keeps the server index when an unavailable reaction precedes the selectable action", async () => {
		const onChoose = jest.fn();
		const incoming = collector();
		await render(<CollectorPrompt collector={{...incoming, reactions: [...incoming.reactions].reverse()}} onChoose={onChoose} />);
		await fireEvent.press(screen.getByRole("button", {name: "valid choice"}));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("does not submit an action while a reply is already being sent", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={collector()} onChoose={onChoose} submitting />);
		expect(screen.getByText("app:collector.answering")).toBeTruthy();
		await fireEvent.press(screen.getByText("valid choice"));
		expect(onChoose).not.toHaveBeenCalled();
	});
});
