import {fightStore} from "@/src/store/FightStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FightIntroductionRes, FightLogRes, FightEndRes, FightRewardRes, FightStatusRes, FightErrorRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightIntroduction, FightEnd, FightStatus, FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {useFightPlayback} from "@/src/store/useFightPlayback";
import {FIGHT_SPEEDS} from "@/src/display/FightMotion";

const INTRO: FightIntroduction = {fightId: "duel", initiator: {isSelf: true}, opponent: {isSelf: false, name: "Adversaire"}, initiatorActions: [["rest", 0]], opponentActions: [["simpleAttack", 2]]};
const END: FightEnd = {winner: {isSelf: true, finalEnergy: 123, maxEnergy: 300}, loser: {isSelf: false, finalEnergy: 0, maxEnergy: 200}, draw: false, turns: 4, maxTurns: 30};

function status(power: number): FightStatus {
	const stats = {power, maxEnergy: 300, attack: 10, defense: 10, speed: 10, breath: 5, maxBreath: 10, breathRegen: 2};
	return {fightId: "duel", numberOfTurn: 1, maxNumberOfTurn: 30, activeFighter: {isSelf: true, stats}, defendingFighter: {isSelf: false, stats}};
}

describe("fight session", () => {
	beforeEach(() => fightStore.reset());
	afterEach(() => jest.useRealTimers());
	it("keeps the result readable and does not advance while the journal is open", async () => {
		jest.useFakeTimers();
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: status(300)});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "simpleAttack", stateAfter: status(240)}});
		const fight = fightStore.getSnapshot();
		const {result, rerender} = await renderHook((paused: boolean) => useFightPlayback(fight, {speed: FIGHT_SPEEDS.NORMAL, paused}), {initialProps: false});
		await act(() => result.current.impact());
		expect(result.current.status?.activeFighter.stats.power).toBe(240);
		await act(() => result.current.finishMotion());
		await act(() => jest.advanceTimersByTime(1000));
		expect(result.current.record?.entry.fightActionId).toBe("simpleAttack");
		await rerender(true);
		await act(() => jest.advanceTimersByTime(10_000));
		expect(result.current.record).toBeDefined();
		await rerender(false);
		await act(() => jest.advanceTimersByTime(6500));
		expect(result.current.record).toBeUndefined();
		expect(result.current.logs).toHaveLength(1);
	});
	it("reads the outcome while the animation plays instead of waiting for it to end", async () => {
		jest.useFakeTimers();
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: status(300)});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "simpleAttack", stateAfter: status(240)}});
		const fight = fightStore.getSnapshot();
		const {result} = await renderHook(() => useFightPlayback(fight, {speed: FIGHT_SPEEDS.NORMAL, paused: false}));
		await act(() => jest.advanceTimersByTime(6500));
		expect(result.current.record?.entry.fightActionId).toBe("simpleAttack");
		await act(() => result.current.finishMotion());
		expect(result.current.record).toBeUndefined();
	});
	it("plays the opening pet action received before mounting and does not replay it after reopening", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: status(300)});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "stealWeapon", status: "normal"}});
		const {result, unmount} = await renderHook(useFightPlayback, {initialProps: fightStore.getSnapshot()});
		expect(result.current.record?.entry.fightActionId).toBe("stealWeapon");
		const sequence = result.current.record!.sequence;
		await act(() => result.current.complete());
		expect(fightStore.getSnapshot().playedSequence).toBe(sequence);
		await unmount();
		const reopened = await renderHook(useFightPlayback, {initialProps: fightStore.getSnapshot()});
		expect(reopened.result.current.record).toBeUndefined();
		expect(reopened.result.current.logs).toHaveLength(1);
	});
	it("keeps events received while minimized in the journal without replaying them on return", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		fightStore.minimize();
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: false}, fightActionId: "simpleAttack"}});
		fightStore.show();
		const {result} = await renderHook(useFightPlayback, {initialProps: fightStore.getSnapshot()});
		expect(result.current.record).toBeUndefined();
		expect(result.current.logs).toHaveLength(1);
	});
	it("plays a burst of actions in order before showing the next authoritative energy", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: status(300)});
		const {result, rerender} = await renderHook(useFightPlayback, {initialProps: fightStore.getSnapshot()});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "simpleAttack"}});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: false}, fightActionId: "poisoned", status: "active"}});
		registry.dispatch(FightStatusRes.wireName, {status: status(180)});
		await rerender(fightStore.getSnapshot());
		expect(result.current.status?.activeFighter.stats.power).toBe(300);
		expect(result.current.record?.entry.fightActionId).toBe("simpleAttack");
		await act(() => result.current.complete());
		expect(result.current.record?.entry.fightActionId).toBe("poisoned");
		await act(() => result.current.impact());
		expect(result.current.status?.activeFighter.stats.power).toBe(180);
		await act(() => result.current.complete());
		await waitFor(() => expect(result.current.status?.activeFighter.stats.power).toBe(180));
		expect(result.current.record).toBeUndefined();
	});
	it("applies each action's own energy at its impact even if a later turn has already arrived", async () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: status(300)});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "simpleAttack", stateAfter: status(240)}});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: false}, fightActionId: "poisoned", status: "active", stateAfter: status(180)}});
		registry.dispatch(FightStatusRes.wireName, {status: {...status(200), numberOfTurn: 2}});
		const {result} = await renderHook(useFightPlayback, {initialProps: fightStore.getSnapshot()});
		expect(result.current.status?.activeFighter.stats.power).toBe(300);
		await act(() => result.current.impact());
		expect(result.current.status?.activeFighter.stats.power).toBe(240);
		await act(() => result.current.complete());
		expect(result.current.status?.activeFighter.stats.power).toBe(240);
		await act(() => result.current.impact());
		expect(result.current.status?.activeFighter.stats.power).toBe(180);
		await act(() => result.current.complete());
		expect(result.current.status?.activeFighter.stats.power).toBe(200);
	});
	it("ignores packets belonging to another fight", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: {...status(1), fightId: "other"}});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "other", fighter: {isSelf: false}, fightActionId: "heavyAttack"}});
		expect(fightStore.getSnapshot()).toMatchObject({status: null, logs: []});
	});
	it("says nothing when the player declines the duel but still reports real failures", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightErrorRes.wireName, {error: FIGHT_ERRORS.REFUSED});
		expect(fightStore.getSnapshot()).toMatchObject({error: null, visible: false});
		registry.dispatch(FightErrorRes.wireName, {error: FIGHT_ERRORS.NO_OPPONENT});
		expect(fightStore.getSnapshot()).toMatchObject({error: FIGHT_ERRORS.NO_OPPONENT, visible: false});
	});
	it("opens the battle screen only for a fight that was actually interrupted", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightErrorRes.wireName, {error: FIGHT_ERRORS.ENERGY});
		expect(fightStore.getSnapshot()).toMatchObject({error: FIGHT_ERRORS.ENERGY, visible: false});
		registry.dispatch(FightErrorRes.wireName, {error: FIGHT_ERRORS.BUGGED});
		expect(fightStore.getSnapshot()).toMatchObject({error: FIGHT_ERRORS.BUGGED, visible: true});
	});
	it("preserves its journal when a resumed introduction arrives for the same duel", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "duel", fighter: {isSelf: true}, fightActionId: "rest"}});
		fightStore.minimize();
		expect(fightStore.getSnapshot().visible).toBe(false);
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		expect(fightStore.getSnapshot().logs).toHaveLength(1);
		expect(fightStore.getSnapshot().visible).toBe(true);
	});
	it("keeps the final energy and exact rewards until acknowledgement", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightEndRes.wireName, {result: END});
		registry.dispatch(FightRewardRes.wireName, {reward: {points: 31, money: 71}});
		expect(fightStore.getSnapshot().result).toEqual(END);
		expect(fightStore.getSnapshot().reward).toMatchObject({points: 31, money: 71});
		fightStore.reset();
		expect(fightStore.getSnapshot()).toMatchObject({introduction: null, result: null, reward: null, logs: []});
	});
});
