import {formatDurationMinutes} from "@/src/display/ItemEffects";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}`}}));

describe("durations", () => {
	it("says whole hours without a trailing zero minute", () => {
		expect(formatDurationMinutes(60)).toBe("app:adventure.duration.hours {\"count\":1}");
		expect(formatDurationMinutes(120)).toBe("app:adventure.duration.hours {\"count\":2}");
	});

	it("keeps the minutes when there are some", () => {
		expect(formatDurationMinutes(90)).toBe("app:adventure.duration.hoursMinutes {\"hours\":1,\"minutes\":30}");
		expect(formatDurationMinutes(45)).toBe("app:adventure.duration.minutes {\"count\":45}");
	});
});
