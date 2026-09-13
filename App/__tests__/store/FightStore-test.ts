import {fightStore} from "@/src/store/FightStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FightIntroductionRes, FightLogRes, FightEndRes, FightRewardRes, FightStatusRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightIntroduction, FightEnd, FightStatus} from "ws-packets/src/objects/Fight";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {useFightPlayback} from "@/src/store/useFightPlayback";

const INTRO: FightIntroduction = {fightId: "duel", initiator: {isSelf: true}, opponent: {isSelf: false, name: "Adversaire"}, initiatorActions: [["rest", 0]], opponentActions: [["simpleAttack", 2]]};
const END: FightEnd = {winner: {isSelf: true, finalEnergy: 123, maxEnergy: 300}, loser: {isSelf: false, finalEnergy: 0, maxEnergy: 200}, draw: false, turns: 4, maxTurns: 30};

function status(power: number): FightStatus {
	const stats = {power, maxEnergy: 300, attack: 10, defense: 10, speed: 10, breath: 5, maxBreath: 10, breathRegen: 2};
	return {fightId: "duel", numberOfTurn: 1, maxNumberOfTurn: 30, activeFighter: {isSelf: true, stats}, defendingFighter: {isSelf: false, stats}};
}

describe("fight session", () => {
	beforeEach(() => fightStore.reset());
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
	it("ignores packets belonging to another fight", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: INTRO});
		registry.dispatch(FightStatusRes.wireName, {status: {...status(1), fightId: "other"}});
		registry.dispatch(FightLogRes.wireName, {entry: {fightId: "other", fighter: {isSelf: false}, fightActionId: "heavyAttack"}});
		expect(fightStore.getSnapshot()).toMatchObject({status: null, logs: []});
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
