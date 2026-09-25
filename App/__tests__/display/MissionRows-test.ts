import {CompletedMission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {missionRows} from "@/src/display/Missions";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

function completed(missionId: string): CompletedMission {
	return {
		mission: {missionId, missionType: MISSION_TYPES.DAILY, missionVariant: 0, missionObjective: 5, numberDone: 5},
		reward: {points: 0, experience: 0, gems: 0, money: 0}
	};
}

describe("unclaimed mission rows", () => {
	it("tells apart the same mission completed twice before being claimed", () => {
		const keys = missionRows([completed("fight"), completed("fight"), completed("drink")]).map(row => row.key);

		expect(new Set(keys).size).toBe(3);
	});

	it("keeps a row's key when an earlier different mission is claimed", () => {
		const before = missionRows([completed("drink"), completed("fight")]);
		const after = missionRows([completed("fight")]);

		expect(after[0].key).toBe(before[1].key);
	});
});
