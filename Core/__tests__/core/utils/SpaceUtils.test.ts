import { EventEmitter } from "events";
import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("https", () => ({ get: vi.fn() }));

const { get } = await import("https");
const { SpaceUtils } = await import("../../../src/core/utils/SpaceUtils");

type FakeResponse = EventEmitter & {
	statusCode: number;
	resume: () => void;
};

type FakeRequest = EventEmitter & {
	setTimeout: (ms: number, callback: () => void) => void;
	destroy: (error?: Error) => void;
};

/*
 * The `https.get` overloads cannot be expressed as a single mockable signature,
 * hence the cast to the only shape SpaceUtils actually relies on.
 */
const httpsGet = get as unknown as ReturnType<typeof vi.fn<(url: string, callback: (res: FakeResponse) => void) => FakeRequest>>;

function buildFakeResponse(statusCode: number): FakeResponse {
	return Object.assign(new EventEmitter(), {
		statusCode,
		resume: (): void => {
			// Nothing to drain in a fake response
		}
	});
}

function mockNeoWsAnswer(statusCode: number): FakeResponse {
	const response = buildFakeResponse(statusCode);
	httpsGet.mockImplementation((_url, callback) => {
		callback(response);
		return Object.assign(new EventEmitter(), {
			setTimeout: (): void => {
				// The timeout is never triggered in these tests
			},
			destroy: (): void => {
				// Nothing to destroy in a fake request
			}
		});
	});
	return response;
}

describe("SpaceUtils.getNeoWSFeed", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects instead of hanging forever when the feed answers with an unparsable body", async () => {
		const response = mockNeoWsAnswer(200);

		const feed = SpaceUtils.getNeoWSFeed();
		response.emit("data", "<html>service unavailable</html>");
		response.emit("end");

		await expect(feed).rejects.toThrow();
	});

	it("rejects when the feed answers with an error status", async () => {
		mockNeoWsAnswer(503);

		await expect(SpaceUtils.getNeoWSFeed()).rejects.toThrow("HTTP status 503");
	});
});
