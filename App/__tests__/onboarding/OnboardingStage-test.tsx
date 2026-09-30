import {act, render, screen} from "@testing-library/react-native";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {ONBOARDING_MISSION_IDS, ONBOARDING_TRIAL_IDS} from "ws-packets/src/objects/Onboarding";
import {contestLength, contestOf, ContestView} from "@/src/onboarding/Contest";
import {forkDue, StopArrivedToast} from "@/src/onboarding/OnboardingStage";
import {OnboardingMoments} from "@/src/onboarding/OnboardingStore";

jest.mock("expo-router", () => ({
	useRouter: (): {navigate: jest.Mock} => ({navigate: jest.fn()}),
	usePathname: (): string => "/profile"
}));
jest.mock("@/src/components/Missions", () => ({}));
jest.mock("@/src/components/UnlockCelebration", () => ({CelebrationModal: (): null => null}));
jest.mock("@/src/notifications/ReportNotifications", () => ({}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));

const MINUTE = 60_000;

function missionsAt(missionId: string, campaignProgression: number): Pick<MissionsRes, "campaignProgression" | "missions"> {
	return {
		campaignProgression,
		missions: [{missionId, missionType: MISSION_TYPES.CAMPAIGN, missionVariant: 0, missionObjective: 1, numberDone: 0}]
	} as unknown as MissionsRes;
}

function contestView(missionId: string, campaignProgression: number): ContestView {
	return contestOf(missionsAt(missionId, campaignProgression));
}

function travel(tripMinutes: number, nextStopTime = Date.now() + 10 * MINUTE): ReportTravelSummaryRes {
	const startTime = Date.now();
	return {
		startMap: {id: 1, type: "castleThrone"},
		endMap: {id: 2, type: "city"},
		startTime,
		arriveTime: startTime + tripMinutes * MINUTE,
		nextStopTime,
		isOnBoat: false,
		points: {show: false, cumulated: 0}
	} as ReportTravelSummaryRes;
}

function view(summary: ReportTravelSummaryRes, reportReady: boolean): ReportViewRes {
	return Object.assign(new ReportViewRes(), {travel: summary, reportReady});
}

function moments(seen: boolean): OnboardingMoments {
	return {ready: true, seen: (): boolean => seen, mark: jest.fn()};
}

const ROAD_START = 4;

describe("royal contest", () => {
	it("names the trial and mission the player is on", () => {
		expect(contestView(ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM, ROAD_START)).toEqual({running: true, trialId: ONBOARDING_TRIAL_IDS.ROAD, missionId: ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM});
	});

	it("is over once its last mission is done, and for a completed campaign", () => {
		expect(contestView(ONBOARDING_MISSION_IDS.CHOOSE_CLASS, contestLength()).running).toBe(true);
		expect(contestView("travelHours", contestLength() + 1)).toEqual({running: false, trialId: null, missionId: null});
		expect(contestView(ONBOARDING_MISSION_IDS.CHOOSE_CLASS, 0).running).toBe(false);
	});
});

describe("departure fork", () => {
	const road = contestView(ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM, ROAD_START);

	it("offers the reminder once the long road of the second trial begins", () => {
		const summary = travel(120);
		expect(forkDue({view: view(summary, false), contest: road, moments: moments(false)})).toBe(summary);
	});

	it("stays away from short hops, the other trials, and a player who already chose", () => {
		expect(forkDue({view: view(travel(5), false), contest: road, moments: moments(false)})).toBeNull();
		expect(forkDue({view: view(travel(120), false), contest: contestView(ONBOARDING_MISSION_IDS.EARN_MONEY, 3), moments: moments(false)})).toBeNull();
		expect(forkDue({view: view(travel(120), false), contest: road, moments: moments(true)})).toBeNull();
	});
});

describe("stop arrived toast", () => {
	it("says a stop came by itself while the player was elsewhere", async () => {
		const summary = travel(120, Date.now() - 1_000);
		const toast = await render(<StopArrivedToast view={view(summary, false)} contestRunning />);
		expect(screen.queryByText("app:contest.stopArrived.title")).toBeNull();

		await act(async () => toast.rerender(<StopArrivedToast view={view(summary, true)} contestRunning />));

		expect(screen.getByText("app:contest.stopArrived.title")).toBeTruthy();
	});

	it("keeps quiet about a stop reached with tokens", async () => {
		const summary = travel(120);
		const toast = await render(<StopArrivedToast view={view(summary, false)} contestRunning />);

		await act(async () => toast.rerender(<StopArrivedToast view={view(summary, true)} contestRunning />));

		expect(screen.queryByText("app:contest.stopArrived.title")).toBeNull();
	});
});
