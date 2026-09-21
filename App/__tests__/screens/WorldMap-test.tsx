import {fireEvent, render, screen} from "@testing-library/react-native";
import {Image, StyleSheet} from "react-native";
import {WorldMapContent} from "@/src/components/WorldMap";
import {MapRes} from "ws-packets/src/fromServer/report/MapRes";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const MAP = Object.assign(new MapRes(), {mapId: 10, mapType: "ci", hasArrived: false, imageUrl: "https://crownicles.com/map-fr.jpg", fallbackImageUrl: "https://crownicles.com/map-en.jpg", cities: [{id: "city", mapLocationId: 10, services: ["blacksmith"], shops: ["generalShop"]}]});

describe("world map", () => {
	beforeEach(() => {
		jest.spyOn(Image, "getSize").mockImplementation((_uri, success) => {
			success(4096, 2744);
			return Promise.resolve({width: 4096, height: 2744});
		});
	});
	afterEach(() => jest.restoreAllMocks());
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
