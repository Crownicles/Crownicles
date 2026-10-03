import {ReactNode} from "react";
import {render, screen} from "@testing-library/react-native";
import {Text} from "react-native";
import {SwipeBack, SwipeBackBoundary, useSwipeBackOpen} from "@/src/design/SwipeBack";

const mockFocus = {value: true};
jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => (() => void) | undefined): void => {
		const focused = mockFocus.value;
		jest.requireActual<typeof import("react")>("react").useEffect(() => focused ? effect() : undefined, [effect, focused]);
	}
}));

function PagingState(): ReactNode {
	return <Text>{useSwipeBackOpen() ? "held" : "free"}</Text>;
}

function TabsWithSubPage(): ReactNode {
	return <SwipeBackBoundary>
		<PagingState />
		<SwipeBack onClose={jest.fn()}><Text>Sub-page</Text></SwipeBack>
	</SwipeBackBoundary>;
}

describe("tab paging under a sub-page", () => {
	afterEach(() => {
		mockFocus.value = true;
	});

	it.each([
		{label: "on screen", focused: true, paging: "held"},
		{label: "left open in another tab", focused: false, paging: "free"}
	])("is held only by a sub-page $label", async ({focused, paging}) => {
		mockFocus.value = focused;
		await render(<TabsWithSubPage />);
		expect(screen.getByText(paging)).toBeTruthy();
	});
});
