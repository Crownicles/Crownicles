import {render, screen} from "@testing-library/react-native";
import {FightGauge} from "@/src/components/FightGauge";
import {reloadI18n} from "@/src/translations/i18nLoader";
import french from "../../../Lang/fr/app.json";
import {Animated} from "react-native";

describe("fight gauge number formatting", () => {
	beforeAll(async () => {
		await reloadI18n(new Map([["Lang/fr/app.json", JSON.stringify(french)]]));
	});
	it("formats four-digit and larger energy values only once", async () => {
		await render(<FightGauge label="Energy" value={12345} max={67890} color="#3F9A5C" reducedMotion />);
		expect(screen.getByText("12\u202f345 / 67\u202f890")).toBeTruthy();
		expect(screen.queryByText(/NaN/)).toBeNull();
	});
	it("keeps zero energy and its real maximum", async () => {
		await render(<FightGauge label="Energy" value={0} max={1250} color="#3F9A5C" reducedMotion />);
		expect(screen.getByText("0 / 1\u202f250")).toBeTruthy();
	});
	it("changes the main fill immediately even while the loss trail has not animated", async () => {
		const timing = jest.spyOn(Animated, "timing").mockReturnValue({start: jest.fn(), stop: jest.fn(), reset: jest.fn()});
		try {
			const view = await render(<FightGauge label="Energy" value={100} max={100} color="#3F9A5C" />);
			await view.rerender(<FightGauge label="Energy" value={63} max={100} color="#3F9A5C" />);
			expect(screen.getByTestId("fight-gauge-fill")).toHaveStyle({width: "63%"});
			expect(screen.getByText("63 / 100")).toBeTruthy();
		}
		finally {timing.mockRestore();}
	});
});