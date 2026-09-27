import {AppStateRes, PendingReveal} from "ws-packets/src/fromServer/appState/AppStateRes";
import {CompletedMission} from "ws-packets/src/objects/Mission";
import {withChange} from "@/src/store/AppState";
import {rewardsOf} from "@/src/store/MissionRewardsStore";
import {firstUnreadLetter} from "@/src/store/RoyalLetterStore";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

function completed(missionId: string): CompletedMission {
	return {mission: {missionId, missionType: 0, missionVariant: 0, missionObjective: 1, numberDone: 1}, reward: {gems: 0, xp: 10, money: 0, points: 0}} as unknown as CompletedMission;
}

function missionsReveal(id: number, missionIds: string[]): PendingReveal {
	return {id, missions: {missions: missionIds.map(completed)}} as unknown as PendingReveal;
}

function letterReveal(id: number, trial: number): PendingReveal {
	return {id, letter: {trial}} as unknown as PendingReveal;
}

function state(reveals: PendingReveal[]): AppStateRes {
	return Object.assign(new AppStateRes(), {seen: ["fork"], reveals});
}

describe("state the app keeps on Core", () => {
	it("draws a change before Core answers: flags set once, seen reveals gone", () => {
		const next = withChange(state([missionsReveal(1, ["a"]), letterReveal(2, 1)]), {seen: ["fork", "royalSeal"], acknowledged: [1]});
		expect(next.seen).toEqual(["fork", "royalSeal"]);
		expect(next.reveals.map(reveal => reveal.id)).toEqual([2]);
	});

	it("gathers every mission Core still holds for the player, and where they come from", () => {
		const rewards = rewardsOf([missionsReveal(3, ["a", "b"]), letterReveal(4, 1), missionsReveal(5, ["c"])]);
		expect(rewards.missions.map(completedMission => completedMission.mission.missionId)).toEqual(["a", "b", "c"]);
		expect(rewards.revealIds).toEqual([3, 5]);
	});

	it("keeps a mission completed while the previous receipt was open", () => {
		const opened = rewardsOf([missionsReveal(1, ["a"])]);
		const after = withChange(state([missionsReveal(1, ["a"]), missionsReveal(2, ["b"])]), {acknowledged: opened.revealIds});
		expect(rewardsOf(after.reveals).missions.map(completedMission => completedMission.mission.missionId)).toEqual(["b"]);
	});

	it("hands out the oldest unread letter first", () => {
		expect(firstUnreadLetter([missionsReveal(1, ["a"]), letterReveal(2, 1), letterReveal(3, 2)])?.id).toBe(2);
		expect(firstUnreadLetter([missionsReveal(1, ["a"])])).toBeNull();
	});
});
