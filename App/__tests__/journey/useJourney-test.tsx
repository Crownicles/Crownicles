import {renderHook} from "@testing-library/react-native";
import {COMMAND_REJECTIONS} from "ws-packets/src/objects/CommandRejection";
import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {useJourney} from "@/src/journey/useJourney";
import {useMissions} from "@/src/components/Missions";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {fakeAppState} from "@/src/testing/fakeAppState";

const mockResetQueries = jest.fn(() => Promise.resolve());

jest.mock("@tanstack/react-query", () => ({useQueryClient: (): object => ({resetQueries: mockResetQueries})}));
jest.mock("@/src/store/AppState", () => require("@/src/testing/fakeAppState").fakeAppState.hooks);
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/components/Missions", () => ({useMissions: jest.fn()}));
jest.mock("expo-secure-store", () => ({getItem: (): null => null, setItem: jest.fn()}));

const NOT_STARTED = {status: "failed", rejection: {type: COMMAND_REJECTIONS.EFFECT, currentEffectId: PLAYER_EFFECTS.NOT_STARTED, remainingTime: 0}} as const;

describe("journey of a character who just set off", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		fakeAppState.reset();
		jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {level: 1} as ProfileRes});
	});

	it("keeps the profile closed while the missions still hold the refusal from before the departure", async () => {
		jest.mocked(useMissions).mockReturnValue(NOT_STARTED as never);

		const {result} = await renderHook(() => useJourney());

		expect(result.current.progress).toBeNull();
		expect(result.current.tabs).not.toContain("profile");
		expect(mockResetQueries).toHaveBeenCalledTimes(1);
	});

	it("opens the profile only once the first item is found", async () => {
		jest.mocked(useMissions).mockReturnValue({status: "ready", data: {campaignProgression: 4} as MissionsRes});
		const {result, rerender} = await renderHook(() => useJourney());
		expect(result.current.tabs).toEqual(["index"]);

		jest.mocked(useMissions).mockReturnValue({status: "ready", data: {campaignProgression: 5} as MissionsRes});
		await rerender({});
		expect(result.current.tabs).toEqual(["index", "profile"]);
	});
});
