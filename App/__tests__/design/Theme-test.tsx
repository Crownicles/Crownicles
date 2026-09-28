import React from "react";
import {Appearance, Text, useColorScheme} from "react-native";
import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {getItem, setItem} from "expo-secure-store";
import {PALETTES} from "@/src/design/Theme";
import {createStyles, resolveScheme, ThemeRoot, useTheme} from "@/src/design/ThemeContext";
import {storedThemePreference, THEME_PREFERENCES} from "@/src/design/ThemePreference";

jest.mock("expo-secure-store", () => ({getItem: jest.fn(() => null), setItem: jest.fn()}));
jest.mock("expo-system-ui", () => ({setBackgroundColorAsync: jest.fn(() => Promise.resolve())}));
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({__esModule: true, default: jest.fn(() => "light")}));

const mockedGetItem = jest.mocked(getItem);
const useSampleStyles = createStyles(colors => ({label: {color: colors.ink}}));

/** A mounted screen: its state must survive a change of theme, which a reload would wipe. */
function Sample(): React.ReactNode {
	const styles = useSampleStyles();
	const theme = useTheme();
	const [presses, setPresses] = React.useState(0);
	return <>
		<Text testID="label" style={styles.label} onPress={(): void => setPresses(count => count + 1)}>{`presses ${presses}`}</Text>
		<Text onPress={(): void => theme.setPreference(THEME_PREFERENCES.DARK)}>dark</Text>
	</>;
}

describe("theme", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => undefined);
	});

	it("follows the system unless the player chose a palette", () => {
		expect(resolveScheme(THEME_PREFERENCES.SYSTEM, "dark")).toBe(THEME_PREFERENCES.DARK);
		expect(resolveScheme(THEME_PREFERENCES.SYSTEM, null)).toBe(THEME_PREFERENCES.LIGHT);
		expect(resolveScheme(THEME_PREFERENCES.LIGHT, "dark")).toBe(THEME_PREFERENCES.LIGHT);
		expect(resolveScheme(THEME_PREFERENCES.DARK, "light")).toBe(THEME_PREFERENCES.DARK);
	});

	it("falls back to the system when nothing valid was stored", () => {
		mockedGetItem.mockReturnValueOnce("sepia");
		expect(storedThemePreference()).toBe(THEME_PREFERENCES.SYSTEM);
		mockedGetItem.mockImplementationOnce(() => {
			throw new Error("keychain locked");
		});
		expect(storedThemePreference()).toBe(THEME_PREFERENCES.SYSTEM);
	});

	it("repaints the mounted screen in place when the player picks another palette, and keeps the choice", async () => {
		await render(<ThemeRoot><Sample /></ThemeRoot>);
		expect(screen.getByTestId("label")).toHaveStyle({color: PALETTES.light.ink});
		await fireEvent.press(screen.getByTestId("label"));

		await fireEvent.press(screen.getByText("dark"));

		expect(screen.getByTestId("label")).toHaveStyle({color: PALETTES.dark.ink});
		expect(screen.getByText("presses 1")).toBeTruthy();
		expect(setItem).toHaveBeenCalledWith("themePreference", THEME_PREFERENCES.DARK);
		expect(Appearance.setColorScheme).toHaveBeenLastCalledWith(THEME_PREFERENCES.DARK);
	});

	it("follows a change of the device scheme without remounting when left to the system", async () => {
		const view = await render(<ThemeRoot><Sample /></ThemeRoot>);
		await fireEvent.press(screen.getByTestId("label"));
		jest.mocked(useColorScheme).mockReturnValue("dark");

		await act(async () => view.rerender(<ThemeRoot><Sample /></ThemeRoot>));

		expect(screen.getByTestId("label")).toHaveStyle({color: PALETTES.dark.ink});
		expect(screen.getByText("presses 1")).toBeTruthy();
	});
});
