import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import {
	Animated, StyleSheet, ViewStyle
} from "react-native";
import { RoadTrack } from "@/src/components/RoadTrack";

jest.mock("@/src/design/TwemojiIcon", () => ({ TwemojiIcon: (): null => null }));

const TRACK_WIDTH = 200;

function styleOf(testID: string): ViewStyle {
	return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe("RoadTrack", () => {
	it("slides the fill and the traveller to the progress once the road is measured", async () => {
		await render(<RoadTrack progress={new Animated.Value(0.25)} stride={new Animated.Value(0)} runner="x" fillColor="#000000" />);
		const track = screen.getByTestId("road-track");
		await fireEvent(track, "layout", { nativeEvent: { layout: {
			width: TRACK_WIDTH, height: 6, x: 0, y: 0
		} } });

		expect(styleOf("road-fill").transform).toEqual([{ translateX: -150 }]);
		expect(styleOf("road-runner").transform).toEqual([{ translateX: 50 }]);
	});

	it("hides the fill until the road is measured, so it never flashes full", async () => {
		await render(<RoadTrack progress={new Animated.Value(0)} stride={new Animated.Value(0)} runner="x" fillColor="#000000" />);

		expect(styleOf("road-fill").opacity).toBe(0);
	});
});
