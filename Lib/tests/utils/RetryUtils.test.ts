import {
	describe, expect, it, vi
} from "vitest";
import { retryWithBackoff } from "../../src/utils/RetryUtils";
import { Millisecond } from "../../src/types/TimeTypes";

vi.mock("../../src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn()
	}
}));

const baseOptions = {
	maxAttempts: 3,
	baseDelay: 1 as Millisecond,
	maxDelay: 4 as Millisecond,
	operationName: "test operation"
};

describe("retryWithBackoff", () => {
	it("should return the result without retrying when the operation succeeds", async () => {
		const operation = vi.fn().mockResolvedValue("ok");

		await expect(retryWithBackoff(operation, baseOptions)).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("should retry and eventually succeed on a transient failure", async () => {
		const operation = vi.fn()
			.mockRejectedValueOnce(new Error("transient"))
			.mockResolvedValueOnce("recovered");

		await expect(retryWithBackoff(operation, baseOptions)).resolves.toBe("recovered");
		expect(operation).toHaveBeenCalledTimes(2);
	});

	it("should rethrow the last error after exhausting all attempts", async () => {
		const operation = vi.fn().mockRejectedValue(new Error("persistent"));

		await expect(retryWithBackoff(operation, baseOptions)).rejects.toThrow("persistent");
		expect(operation).toHaveBeenCalledTimes(baseOptions.maxAttempts);
	});
});
