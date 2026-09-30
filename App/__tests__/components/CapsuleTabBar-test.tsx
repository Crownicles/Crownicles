import {Animated} from "react-native";
import {fireEvent, render, screen} from "@testing-library/react-native";
import {CapsuleTab, CapsuleTabBar} from "@/src/components/CapsuleTabBar";
import {Compass, PawPrint, UserRound} from "@/src/design/FightIcons";

const TABS: CapsuleTab[] = [
	{name: "index", title: "Aventure", Icon: Compass, isNew: false, progress: 0.4},
	{name: "profile", title: "Profil", Icon: UserRound, isNew: false},
	{name: "pet", title: "Familier", Icon: PawPrint, isNew: true}
];

const BAR_WIDTH = 360;

function bar(focused: string, onSelect: (name: string) => void = jest.fn()): React.JSX.Element {
	const index = TABS.findIndex(tab => tab.name === focused);
	return <CapsuleTabBar tabs={TABS} focused={focused} position={new Animated.Value(index)} onSelect={onSelect} />;
}

/** The icons are placed once the capsule knows its width. */
async function laidOut(): Promise<void> {
	await fireEvent(screen.getByTestId("capsule-track"), "layout", {nativeEvent: {layout: {width: BAR_WIDTH, height: 48}}});
}

describe("CapsuleTabBar", () => {
	it("marks the focused tab as selected and names every tab to assistive technologies", async () => {
		await render(bar("profile"));

		expect(screen.getByRole("tab", {name: "Profil"})).toBeSelected();
		expect(screen.getByRole("tab", {name: "Aventure"})).not.toBeSelected();
		expect(screen.getByRole("tab", {name: "Familier"})).not.toBeSelected();
	});

	it("opens another tab when pressed, but does nothing on the tab already open", async () => {
		const onSelect = jest.fn();
		await render(bar("profile", onSelect));

		await fireEvent.press(screen.getByRole("tab", {name: "Profil"}));
		expect(onSelect).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("tab", {name: "Familier"}));
		expect(onSelect).toHaveBeenCalledWith("pet");
	});

	it("dots a newly opened tab until it is the one shown", async () => {
		const {rerender} = await render(bar("index"));
		await laidOut();
		expect(screen.getByTestId("tab-new-mark", {includeHiddenElements: true})).toBeTruthy();

		await rerender(bar("pet"));
		expect(screen.queryByTestId("tab-new-mark", {includeHiddenElements: true})).toBeNull();
	});

	it("rings only the tab that follows a progress, in both of its shades", async () => {
		await render(bar("profile"));
		await laidOut();

		expect(screen.getAllByTestId("progress-ring", {includeHiddenElements: true})).toHaveLength(2);
	});
});
