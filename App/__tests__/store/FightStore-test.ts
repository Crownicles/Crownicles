import {fightStore} from "@/src/store/FightStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FightIntroductionRes, FightLogRes, FightEndRes, FightRewardRes} from "ws-packets/src/fromServer/fight/FightRes";
import {FightIntroduction, FightEnd} from "ws-packets/src/objects/Fight";

const INTRO: FightIntroduction = {fightId: "duel", initiator: {isSelf: true}, opponent: {isSelf: false, name: "Adversaire"}, initiatorActions: [["rest", 0]], opponentActions: [["simpleAttack", 2]]};
const END: FightEnd = {winner: {isSelf: true, finalEnergy: 123, maxEnergy: 300}, loser: {isSelf: false, finalEnergy: 0, maxEnergy: 200}, draw: false, turns: 4, maxTurns: 30};

describe("fight session", () => {
	beforeEach(() => fightStore.reset());
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
