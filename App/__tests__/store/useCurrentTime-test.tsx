import {
	act, renderHook
} from "@testing-library/react-native";
import { useCurrentTime } from "@/src/store/useCurrentTime";

const START = Date.UTC(2026, 9, 15, 12);

describe("useCurrentTime", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: START });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("reads the time as soon as it is mounted, so a countdown never starts from zero", async () => {
		const { result } = await renderHook(() => useCurrentTime(1_000));

		expect(result.current).toBe(START);
	});

	it("stops reading the time while inactive, and catches up as soon as it is active again", async () => {
		const { result, rerender } = await renderHook(({ active }: { active: boolean }) => useCurrentTime(1_000, active), { initialProps: { active: true } });

		await rerender({ active: false });
		await act(async () => {
			jest.advanceTimersByTime(5_000);
		});
		expect(result.current).toBe(START);

		await rerender({ active: true });
		expect(result.current).toBe(START + 5_000);
	});
});
