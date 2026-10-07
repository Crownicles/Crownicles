import {fireEvent, render, screen} from "@testing-library/react-native";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {AutomaticSmallEventOutcome} from "@/src/collectors/AutomaticSmallEventOutcome";

jest.mock("@/src/translations/i18n", () => ({
	i18n: {t: (key: string): string => key, tArray: (): string[] => []}
}));

jest.mock("@/src/store/usePlayerProfile", () => ({
	usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})
}));

describe("AutomaticSmallEventOutcome", () => {
	it.each([
		[{eventName: "SmallEventWinHealthPacket", data: {amount: 12}}, "smallEvents:introsmallEvents:winHealth.stories", "app:adventure.event.fields.health"],
		[{eventName: "SmallEventAdvanceTimePacket", data: {amount: 15}}, "smallEvents:introsmallEvents:advanceTime.stories", "app:adventure.automaticResults.fields.timeGained"],
		[{eventName: "SmallEventBigBadPacket", data: {kind: "LIFE_LOSS", lifeLost: 5, moneyLost: 0, receivedStory: "x"}}, "smallEvents:introsmallEvents:bigBad.lifeLoss", "app:adventure.event.fields.health"]
	])("tells %s with the Discord story and its effect", async (packet, story, effect) => {
		const onContinue = jest.fn();
		await render(<AutomaticSmallEventOutcome outcome={packet as SmallEventResultRes} onContinue={onContinue} />);

		expect(screen.getByText(story)).toBeTruthy();
		expect(screen.getByText(effect)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("tells a quiet road with the Discord story alone", async () => {
		await render(<AutomaticSmallEventOutcome outcome={{eventName: "SmallEventDoNothingPacket", data: {}} as SmallEventResultRes} onContinue={jest.fn()} />);

		expect(screen.getByText("smallEvents:doNothing.stories")).toBeTruthy();
		expect(screen.queryByTestId("event-effect")).toBeNull();
	});

	it("shows the astronomer searching, then completes the same story once the sky answers", async () => {
		const onContinue = jest.fn();
		const searching = {eventName: "SmallEventSpaceInitialPacket", data: {}} as SmallEventResultRes;
		const found = {eventName: "SmallEventSpaceResultPacket", data: {chosenEvent: "neoWS", values: {mainValue: 3}}} as SmallEventResultRes;
		const view = await render(<AutomaticSmallEventOutcome outcome={searching} onContinue={onContinue} />);

		expect(screen.getByText("smallEvents:space.before_search_format")).toBeTruthy();
		expect(screen.getByRole("button", {disabled: true})).toBeTruthy();

		await view.rerender(<AutomaticSmallEventOutcome outcome={found} onContinue={onContinue} />);

		expect(screen.getByText("smallEvents:space.after_search_format")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
