import {
	describe, expect, it
} from "vitest";
import { getErrorReason } from "../../src/utils/ErrorUtils";

describe("getErrorReason", () => {
	it("gives the message of an error and the text of any other thrown value", () => {
		expect(getErrorReason(new TypeError("broken"))).toBe("broken");
		expect(getErrorReason("plain text")).toBe("plain text");
		expect(getErrorReason(42)).toBe("42");
	});
});
