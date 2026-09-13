import {act, renderHook} from "@testing-library/react-native";
import {Animated} from "react-native";
import {FightLogRecord} from "@/src/store/FightStore";
import {useFightAnimation} from "@/src/store/useFightAnimation";
import {FIGHT_SPEEDS, FightSpeed} from "@/src/display/FightMotion";

jest.mock("@react-native-async-storage/async-storage", () => ({getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined)}));
const RECORD: FightLogRecord = {sequence: 1, entry: {fightId: "animation", fighter: {isSelf: true}, fightActionId: "simpleAttack", status: "normal"}};

describe("combat animation timing", () => {
	beforeEach(() => {
		jest.spyOn(Animated, "timing").mockReturnValue({start: jest.fn(), stop: jest.fn(), reset: jest.fn()});
	});
	afterEach(() => jest.restoreAllMocks());
	it.each([["simpleAttack", 1560, 780], ["heavyAttack", 1840, 920]])("doubles %s by default and preserves its old speed in fast mode", async (actionId, normal, fast) => {
		const record = {...RECORD, entry: {...RECORD.entry, fightActionId: actionId}};
		const callbacks = {onImpact: jest.fn(), onComplete: jest.fn()};
		const {rerender} = await renderHook((speed: FightSpeed) => useFightAnimation(record, callbacks, false, speed), {initialProps: FIGHT_SPEEDS.NORMAL as FightSpeed});
		expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({duration: normal}));
		await rerender(FIGHT_SPEEDS.FAST);
		expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({duration: fast}));
	});
	it("accelerates the remaining motion without repeating an impact", async () => {
		const callbacks = {onImpact: jest.fn(), onComplete: jest.fn()};
		const {result, rerender} = await renderHook((speed: FightSpeed) => useFightAnimation(RECORD, callbacks, false, speed), {initialProps: FIGHT_SPEEDS.NORMAL as FightSpeed});
		await act(() => result.current.progress.setValue(0.6));
		expect(callbacks.onImpact).toHaveBeenCalledTimes(1);
		await rerender(FIGHT_SPEEDS.FAST);
		expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({duration: 312}));
		await act(() => result.current.progress.setValue(0.9));
		expect(callbacks.onImpact).toHaveBeenCalledTimes(1);
	});
	it("keeps reduced motion short regardless of the speed setting", async () => {
		await renderHook(() => useFightAnimation(RECORD, {onImpact: jest.fn(), onComplete: jest.fn()}, true));
		expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({duration: 120}));
	});
});