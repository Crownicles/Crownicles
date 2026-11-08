import { formatTimeLeft } from "@/src/display/KingChallenge";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}` } }));

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("time left before the king's challenge starts over", () => {
	it("counts several days in days and hours", () => {
		expect(formatTimeLeft(2 * DAY + 5 * HOUR + 10 * MINUTE)).toBe("app:adventure.duration.daysHours {\"days\":2,\"hours\":5}");
		expect(formatTimeLeft(3 * DAY)).toBe("app:adventure.duration.days {\"count\":3}");
	});

	it("counts the last day in hours and minutes", () => {
		expect(formatTimeLeft(5 * HOUR + 30 * MINUTE)).toBe("app:adventure.duration.hoursMinutes {\"hours\":5,\"minutes\":30}");
		expect(formatTimeLeft(DAY - MINUTE)).toBe("app:adventure.duration.hoursMinutes {\"hours\":23,\"minutes\":59}");
	});

	it("never counts below zero once the moment has passed", () => {
		expect(formatTimeLeft(-MINUTE)).toBe("app:adventure.duration.minutes {\"count\":0}");
	});
});
