import {Appearance} from "react-native";
import {getItem, setItem} from "expo-secure-store";
import {reloadAppAsync} from "expo";
import {resolveColorScheme, storedThemePreference, THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {ACTIVE_COLOR_SCHEME} from "@/src/design/Theme";
import {applyThemePreference} from "@/src/design/useThemeFollower";

jest.mock("expo-secure-store", () => ({getItem: jest.fn(() => null), setItem: jest.fn()}));
jest.mock("expo", () => ({reloadAppAsync: jest.fn(() => Promise.resolve())}));
jest.mock("expo-system-ui", () => ({setBackgroundColorAsync: jest.fn(() => Promise.resolve())}));

const mockedGetItem = jest.mocked(getItem);

describe("theme preference", () => {
	beforeEach(() => jest.clearAllMocks());

	it("follows the system unless the player chose a palette", () => {
		jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");
		expect(resolveColorScheme(THEME_PREFERENCES.SYSTEM)).toBe(THEME_PREFERENCES.DARK);
		expect(resolveColorScheme(THEME_PREFERENCES.LIGHT)).toBe(THEME_PREFERENCES.LIGHT);
	});

	it("falls back to the system when nothing valid was stored", () => {
		mockedGetItem.mockReturnValueOnce("sepia");
		expect(storedThemePreference()).toBe(THEME_PREFERENCES.SYSTEM);
		mockedGetItem.mockImplementationOnce(() => {
			throw new Error("keychain locked");
		});
		expect(storedThemePreference()).toBe(THEME_PREFERENCES.SYSTEM);
	});

	it("reloads the app only when the chosen palette differs from the running one", () => {
		jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => undefined);
		const other = ACTIVE_COLOR_SCHEME === THEME_PREFERENCES.DARK ? THEME_PREFERENCES.LIGHT : THEME_PREFERENCES.DARK;

		applyThemePreference(ACTIVE_COLOR_SCHEME);
		expect(setItem).toHaveBeenCalledWith("themePreference", ACTIVE_COLOR_SCHEME);
		expect(reloadAppAsync).not.toHaveBeenCalled();

		applyThemePreference(other);
		expect(reloadAppAsync).toHaveBeenCalledTimes(1);
	});
});
