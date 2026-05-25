import {
	beforeEach, describe, expect, it, vi
} from "vitest";

/*
 * `withLockedEntitiesSafe` is a thin wrapper around
 * `withLockedEntities` that downgrades `LockedRowNotFoundError` to a
 * warn-and-return-false. Because we only want to verify the
 * decision logic (which class of error is swallowed vs rethrown vs
 * what return value is produced), we mock the underlying
 * `withLockedEntities` primitive instead of spinning up a real DB.
 * The end-to-end DB behaviour is already exercised by the
 * integration tests under `__tests__-integration/locks/` and
 * `handlers/with-locked-player-safe.race.integration.test.ts`.
 */

vi.mock("../../../../Lib/src/locks/withLockedEntities", async () => {
	const actual = await vi.importActual<typeof import("../../../../Lib/src/locks/withLockedEntities")>(
		"../../../../Lib/src/locks/withLockedEntities"
	);
	return {
		...actual,
		withLockedEntities: vi.fn()
	};
});

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { withLockedEntitiesSafe } from "../../../src/core/utils/withLockedEntitiesSafe";

const mockedWithLockedEntities = withLockedEntities as unknown as ReturnType<typeof vi.fn>;
const mockedLogger = CrowniclesLogger as unknown as { warn: ReturnType<typeof vi.fn> };

describe("withLockedEntitiesSafe", () => {
	beforeEach(() => {
		mockedWithLockedEntities.mockReset();
		mockedLogger.warn.mockReset();
	});

	it("returns true and runs the body when the primitive resolves", async () => {
		const body = vi.fn().mockResolvedValue(undefined);
		mockedWithLockedEntities.mockImplementationOnce(async (_keys, fn) => {
			await fn([]);
		});

		const result = await withLockedEntitiesSafe([], "unit-test-success", body);

		expect(result).toBe(true);
		expect(body).toHaveBeenCalledOnce();
		expect(mockedLogger.warn).not.toHaveBeenCalled();
	});

	it("returns false and warns when the primitive throws LockedRowNotFoundError", async () => {
		const body = vi.fn();
		mockedWithLockedEntities.mockRejectedValueOnce(
			new LockedRowNotFoundError("players", 42)
		);

		const result = await withLockedEntitiesSafe([], "unit-test-vanished", body);

		expect(result).toBe(false);
		expect(body).not.toHaveBeenCalled();
		expect(mockedLogger.warn).toHaveBeenCalledOnce();
		expect(mockedLogger.warn.mock.calls[0][0]).toContain("unit-test-vanished");
		expect(mockedLogger.warn.mock.calls[0][0]).toContain("players#42");
	});

	it("rethrows any other error untouched", async () => {
		const body = vi.fn();
		const boom = new Error("boom");
		mockedWithLockedEntities.mockRejectedValueOnce(boom);

		await expect(withLockedEntitiesSafe([], "unit-test-rethrow", body)).rejects.toBe(boom);
		expect(body).not.toHaveBeenCalled();
		expect(mockedLogger.warn).not.toHaveBeenCalled();
	});
});
