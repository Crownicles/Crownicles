import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import i18n from "../../src/translations/i18n";
import { formatBlockedReasons } from "../../src/utils/BlockingReasonUtils";

vi.mock("../../src/translations/i18n", () => ({
	default: {
		t: vi.fn((key: string) => key.replace("error:blockedContext.", ""))
	}
}));

describe("formatBlockedReasons", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deduplicates reasons while preserving their display order", () => {
		const reasons = formatBlockedReasons(["reportCommand", "reportCommand", "gardenCommand"], "fr");

		expect(reasons).toBe("reportCommand, gardenCommand");
		expect(i18n.t).toHaveBeenCalledTimes(2);
		expect(i18n.t).toHaveBeenNthCalledWith(1, "error:blockedContext.reportCommand", { lng: "fr" });
		expect(i18n.t).toHaveBeenNthCalledWith(2, "error:blockedContext.gardenCommand", { lng: "fr" });
	});
});