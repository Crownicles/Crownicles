import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ClassesCollector} from "@/src/collectors/ClassesCollector";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: Record<string, unknown>): string => key === "app:classes.name" ? String(options?.name) : key}}));

function collector(): ReactionCollectorCreation {
	return Object.assign(new ReactionCollectorCreation(), {
		id: "classes", endTime: Date.now() + 60_000,
		data: {type: "classes", data: {cooldownSeconds: 604800, classesDetails: [{id: 7, energy: 333, attack: 50, defense: 30, speed: 20, health: 99, initialBreath: 5, maxBreath: 12, breathRegen: 3}]}},
		reactions: [{type: "unknown", data: {serverType: "futureChoice"}}, {type: "chooseClass", data: {classId: 7}}, {type: "refuse", data: {}}]
	});
}

describe("class selection", () => {
	it("waits for confirmation and sends the original reaction index once", async () => {
		const onChoose = jest.fn();
		await render(<ClassesCollector collector={collector()} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:classes.7"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("333")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("refuses using the server index without choosing a class", async () => {
		const onChoose = jest.fn();
		await render(<ClassesCollector collector={collector()} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it("does not accept a class after expiry", async () => {
		const expired = collector();
		expired.endTime = Date.now() - 1;
		const onChoose = jest.fn();
		await render(<ClassesCollector collector={expired} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:classes.7"));
		expect(screen.queryByText("app:collector.accept")).toBeNull();
		expect(onChoose).not.toHaveBeenCalled();
	});
});