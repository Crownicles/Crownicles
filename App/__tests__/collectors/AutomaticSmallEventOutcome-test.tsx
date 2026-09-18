import {fireEvent, render, screen} from "@testing-library/react-native";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {AutomaticSmallEventOutcome} from "@/src/collectors/AutomaticSmallEventOutcome";

jest.mock("@/src/translations/i18n", () => ({
	i18n: {t: (key: string): string => key}
}));

describe("AutomaticSmallEventOutcome", () => {
	it.each([
		[{eventName: "SmallEventWinHealthPacket", data: {amount: 12}}, "app:adventure.event.fields.health"],
		[{eventName: "SmallEventAdvanceTimePacket", data: {amount: 15}}, "app:adventure.automaticResults.fields.timeGained"],
		[{eventName: "SmallEventFindMaterialPacket", data: {materialId: "wood", quantity: 3}}, "app:adventure.choiceResults.fields.material"],
		[{eventName: "SmallEventBigBadPacket", data: {lifeLost: 5, moneyLost: 20, effectId: "sick"}}, "app:adventure.event.fields.health"],
		[{eventName: "SmallEventDoNothingPacket", data: {}}, "app:adventure.automaticResults.descriptions.doNothing"]
	])("renders %s as a readable event", async (packet, expectedText) => {
		const onContinue = jest.fn();
		await render(<AutomaticSmallEventOutcome outcome={packet as SmallEventResultRes} onContinue={onContinue} />);

		expect(screen.getByText(expectedText)).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
