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
	it("sends one index and locks every choice after the first press", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={collector()} onChoose={onChoose} />);

		await fireEvent.press(screen.getByText("valid choice"));
		await fireEvent.press(screen.getByText("valid choice"));

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("does not offer an unknown reaction as an enabled choice", async () => {
		const onChoose = jest.fn();
		await render(<CollectorPrompt collector={collector()} onChoose={onChoose} />);

		const unknownChoice = screen.getByText("unknown choice");
		await fireEvent.press(unknownChoice);

		expect(onChoose).not.toHaveBeenCalled();
	});
});
