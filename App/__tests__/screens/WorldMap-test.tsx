import "react-native-gesture-handler/jestSetup";
import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {Image, StyleSheet} from "react-native";
import {State} from "react-native-gesture-handler";
import {fireGestureHandler, getByGestureTestId} from "react-native-gesture-handler/jest-utils";
import * as Reanimated from "react-native-reanimated";
import {MapViewer} from "@/src/components/MapViewer";
import {WorldMapContent} from "@/src/components/WorldMap";
import {MapRes} from "ws-packets/src/fromServer/report/MapRes";

Object.assign(Reanimated, {useEvent: jest.fn()});
jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const MAP = Object.assign(new MapRes(), {mapId: 10, mapType: "ci", hasArrived: false, imageUrl: "https://crownicles.com/map-fr.jpg", fallbackImageUrl: "https://crownicles.com/map-en.jpg", cities: [{id: "city", mapLocationId: 10, services: ["blacksmith"], shops: ["generalShop"]}]});

async function openMapViewer(): Promise<void> {
	await render(<MapViewer uri={MAP.imageUrl} ratio={1} onClose={jest.fn()} onError={jest.fn()} />);
	await fireEvent(screen.getByTestId("map-stage"), "layout", {nativeEvent: {layout: {width: 400, height: 400}}});
}

describe("world map", () => {
	beforeEach(() => {
		jest.spyOn(Image, "getSize").mockImplementation((_uri, success) => {
			success(4096, 2744);
			return Promise.resolve({width: 4096, height: 2744});
		});
	});
	afterEach(() => jest.restoreAllMocks());
	it("keeps the map in place when one finger leaves a pinch", async () => {
		const spring = jest.spyOn(Reanimated, "withSpring");
		await openMapViewer();
		await act(() => fireGestureHandler(getByGestureTestId("map-pinch"), [
			{state: State.BEGAN, numberOfPointers: 2, scale: 1, focalX: 200, focalY: 200},
			{state: State.ACTIVE, numberOfPointers: 2, scale: 1, focalX: 200, focalY: 200},
			{state: State.ACTIVE, numberOfPointers: 2, scale: 3, focalX: 200, focalY: 200},
			{state: State.ACTIVE, numberOfPointers: 1, scale: 3, focalX: 280, focalY: 200},
			{state: State.END, numberOfPointers: 1, scale: 3, focalX: 280, focalY: 200}
		]));
		expect(spring.mock.calls.map(([target]) => target)).toEqual([3, 0, 0]);
	});
	it("keeps the same map point under a moving pinch", async () => {
		const spring = jest.spyOn(Reanimated, "withSpring");
		await openMapViewer();
		await act(() => fireGestureHandler(getByGestureTestId("map-pinch"), [
			{state: State.BEGAN, numberOfPointers: 2, scale: 1, focalX: 200, focalY: 200},
			{state: State.ACTIVE, numberOfPointers: 2, scale: 1, focalX: 200, focalY: 200},
			{state: State.ACTIVE, numberOfPointers: 2, scale: 2, focalX: 240, focalY: 220},
			{state: State.ACTIVE, numberOfPointers: 2, scale: 3, focalX: 260, focalY: 230},
			{state: State.END, numberOfPointers: 1, scale: 3, focalX: 260, focalY: 230}
		]));
		expect(spring.mock.calls.map(([target]) => target)).toEqual([3, 60, 30]);
	});
	it.each([
		{name: "finished", state: State.END, decays: 2},
		{name: "cancelled", state: State.CANCELLED, decays: 0},
		{name: "failed", state: State.FAILED, decays: 0}
	])("only flings a successful pan ($name)", async ({state, decays}) => {
		const decay = jest.spyOn(Reanimated, "withDecay");
		await openMapViewer();
		await act(() => fireGestureHandler(getByGestureTestId("map-pan"), [
			{state: State.BEGAN, numberOfPointers: 1, translationX: 0, translationY: 0},
			{state: State.ACTIVE, numberOfPointers: 1, translationX: 0, translationY: 0},
			{state: State.ACTIVE, numberOfPointers: 1, translationX: 40, translationY: 20},
			{state, numberOfPointers: state === State.END ? 0 : 2, translationX: 40, translationY: 20, velocityX: 900, velocityY: 300}
		]));
		expect(decay).toHaveBeenCalledTimes(decays);
	});
	it("measures the image without relying on a native-only load event", async () => {
		await render(<WorldMapContent packet={MAP} />);
		expect(Image.getSize).toHaveBeenCalledWith(MAP.imageUrl, expect.any(Function), expect.any(Function));
		expect(StyleSheet.flatten(screen.getByLabelText("app:map.image").props.style).aspectRatio).toBe(4096 / 2744);
	});
	it("renders the server map and names the place, without listing cities", async () => {
		await render(<WorldMapContent packet={MAP} />);
		expect(screen.getByLabelText("app:map.image").props.source).toEqual({uri: MAP.imageUrl});
		expect(screen.getByText("models:map_locations.10.name")).toBeTruthy();
		expect(screen.getByText("app:map.destination")).toBeTruthy();
		expect(screen.queryByText(/commands:report.city/)).toBeNull();
	});
	it("tries the server fallback then offers retry when both images fail", async () => {
		await render(<WorldMapContent packet={MAP} />);
		await fireEvent(screen.getByLabelText("app:map.image"), "error");
		expect(screen.getByLabelText("app:map.image").props.source).toEqual({uri: MAP.fallbackImageUrl});
		await fireEvent(screen.getByLabelText("app:map.image"), "error");
		expect(screen.getByText("app:map.imageError")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:common.retry"));
		expect(screen.getByLabelText("app:map.image").props.source).toEqual({uri: MAP.imageUrl});
	});
});
