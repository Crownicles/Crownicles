import {missionRewardsStore} from "@/src/store/MissionRewardsStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {MissionsCompletedRes} from "ws-packets/src/fromServer/missions/MissionsCompletedRes";
import {CompletedMission} from "ws-packets/src/objects/Mission";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("mission reward receipt", () => {
	it("keeps a mission received while the previous receipt is open", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const first = {mission: {missionId: "first", missionType: "campaign"}, reward: {points: 1, experience: 2, gems: 3, money: 4}} as CompletedMission;
		const second = {mission: {missionId: "second", missionType: "campaign"}, reward: {points: 5, experience: 6, gems: 7, money: 8}} as CompletedMission;
		registry.dispatch(MissionsCompletedRes.wireName, {missions: [first]});
		const revealed = missionRewardsStore.getSnapshot().rewards;
		registry.dispatch(MissionsCompletedRes.wireName, {missions: [second]});
		missionRewardsStore.claim(revealed);
		expect(missionRewardsStore.getSnapshot().rewards.missions).toEqual([second]);
		expect(missionRewardsStore.getSnapshot().unannounced).toBe(1);
		missionRewardsStore.claim(missionRewardsStore.getSnapshot().rewards);
	});
});