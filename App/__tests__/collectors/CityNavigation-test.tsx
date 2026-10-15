import {
	act, renderHook
} from "@testing-library/react-native";
import {
	CityNavigationItem, useCityNavigation
} from "@/src/collectors/CityCollector";

jest.mock("expo-router", () => ({ useRouter: (): { push: jest.Mock } => ({ push: jest.fn() }) }));

function item(view: CityNavigationItem["view"]): CityNavigationItem {
	return {
		kind: "navigation", key: view, view, iconPath: "", title: view
	};
}

describe("city navigation", () => {
	it("goes back from a home room to the home, then to the city", async () => {
		const { result } = await renderHook(() => useCityNavigation());
		await act(() => result.current.navigate(item("home")));
		await act(() => result.current.navigate(item("homeUpgrade")));
		expect(result.current.submenu).toBe("homeUpgrade");
		await act(() => result.current.back());
		expect(result.current.submenu).toBe("home");
		await act(() => result.current.back());
		expect(result.current.submenu).toBeNull();
	});
});
