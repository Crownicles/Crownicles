import {expeditionProgress} from "@/src/display/PetExpedition";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const HOUR = 3_600_000;
const EXPEDITION = {startTime: 10 * HOUR, endTime: 14 * HOUR};

describe("expeditionProgress", () => {
	it("measures the time the pet has been away against the whole expedition", () => {
		expect(expeditionProgress(EXPEDITION, 11 * HOUR)).toBe(0.25);
	});

	it("stays full once the pet is back, and empty before it leaves", () => {
		expect(expeditionProgress(EXPEDITION, 20 * HOUR)).toBe(1);
		expect(expeditionProgress(EXPEDITION, 9 * HOUR)).toBe(0);
	});
});
