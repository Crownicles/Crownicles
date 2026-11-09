import {
	formatDurationMinutes, formatLongDurationMinutes
} from "@/src/display/ItemEffects";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}` } }));

describe("durations", () => {
	it("says whole hours without a trailing zero minute", () => {
		expect(formatDurationMinutes(60)).toBe("app:adventure.duration.hours {\"count\":1}");
		expect(formatDurationMinutes(120)).toBe("app:adventure.duration.hours {\"count\":2}");
	});

	it("keeps the minutes when there are some", () => {
		expect(formatDurationMinutes(90)).toBe("app:adventure.duration.hoursMinutes {\"hours\":1,\"minutes\":30}");
		expect(formatDurationMinutes(45)).toBe("app:adventure.duration.minutes {\"count\":45}");
	});

	it("counts a wait longer than a day in days and hours", () => {
		expect(formatLongDurationMinutes(2 * 1_440 + 5 * 60 + 10)).toBe("app:adventure.duration.daysHours {\"days\":2,\"hours\":5}");
		expect(formatLongDurationMinutes(3 * 1_440)).toBe("app:adventure.duration.days {\"count\":3}");
	});

	it("keeps hours and minutes within the last day", () => {
		expect(formatLongDurationMinutes(1_439)).toBe("app:adventure.duration.hoursMinutes {\"hours\":23,\"minutes\":59}");
		expect(formatLongDurationMinutes(-5)).toBe("app:adventure.duration.minutes {\"count\":0}");
	});
});
