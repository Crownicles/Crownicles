import {render, screen} from "@testing-library/react-native";
import {FightGauge} from "@/src/components/FightGauge";
import {reloadI18n} from "@/src/translations/i18nLoader";
import french from "../../../Lang/fr/app.json";

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
});