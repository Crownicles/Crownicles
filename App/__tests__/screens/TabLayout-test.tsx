import type { ReactNode } from "react";
import {
	act, render, screen
} from "@testing-library/react-native";
import TabLayout from "@/app/(protected)/(tabs)/_layout";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { ReportBigEventResultRes } from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import { SmallEventResultRes } from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import { PLAYER_EFFECTS } from "ws-packets/src/objects/PlayerUtility";
import { reportEventStore } from "@/src/collectors/ReportEventStore";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import { fakeAppState } from "@/src/testing/fakeAppState";

/** The effect of a character who is fine. */
const NO_EFFECT = "none";

/** Delivers a packet exactly as Core pushes it through the socket. */
function pushFromCore(wireName: string, packet: object): void {
	Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(wireName, packet);
}

jest.mock("expo-router", () => ({
	...jest.requireActual("expo-router"),
	useRouter: (): object => ({
		push: jest.fn(), navigate: jest.fn()
	})
}));

// The tabs themselves are covered by their own screens: here they only stand for "the adventure is still on screen".
jest.mock("expo-router/js-top-tabs", () => {
	const { Text } = jest.requireActual("react-native");
	return {
		TopTabs: Object.assign((): ReactNode => <Text>tabs</Text>, {
			Protected: (): null => null, Screen: (): null => null
		})
	};
});

jest.mock("@/src/components/DeathScreen", () => {
	const { Text } = jest.requireActual("react-native");
	return { DeathScreen: (): ReactNode => <Text>death</Text> };
});

jest.mock("@/src/store/usePlayerProfile", () => ({ usePlayerProfile: jest.fn() }));

jest.mock("@/src/collectors/CollectorsContext", () => ({
	useCollectors: (): object => ({
		open: [], track: jest.fn(), react: jest.fn(), isAnswerPending: (): boolean => false, answerWithoutShowing: jest.fn()
	})
}));

jest.mock("@/src/journey/useJourney", () => ({
	useJourney: (): object => ({
		progress: null, tabs: ["adventure"], nextStep: null, unannounced: null, isNew: (): boolean => false, announce: jest.fn(), visit: jest.fn()
	})
}));

jest.mock("@/src/store/AppState", () => require("@/src/testing/fakeAppState").fakeAppState.hooks);
jest.mock("@/src/store/useReportActions", () => ({ useReportView: (): object => ({ status: "loading" }) }));
jest.mock("@/src/onboarding/Contest", () => ({ useContest: (): null => null }));
jest.mock("@/src/store/RoyalLetterStore", () => ({ useRoyalLetter: (): null => null }));
jest.mock("@/src/notifications/useNotifications", () => ({ useNotificationNavigation: (): void => undefined }));
jest.mock("@/src/notifications/PushRegistration", () => ({ usePushRegistration: (): void => undefined }));
jest.mock("@/src/notifications/ReportNotifications", () => ({ allowPermissionPrompt: (): void => undefined }));
jest.mock("@/src/components/AppNotificationToast", () => ({
	AppNotificationToast: (): null => null, useAppNotificationRefresh: (): void => undefined
}));
jest.mock("@/src/components/MissionRewards", () => ({ MissionCompletedToast: (): null => null }));
jest.mock("@/src/components/BlessingActivatedToast", () => ({ BlessingActivatedToast: (): null => null }));
jest.mock("@/src/components/LevelUpToast", () => ({ LevelUpToast: (): null => null }));
jest.mock("@/src/components/CityStayScoreToast", () => ({ CityStayScoreToast: (): null => null }));
jest.mock("@/src/components/KingChallengeToast", () => ({ KingChallengeToast: (): null => null }));
jest.mock("@/src/components/MemorableMoment", () => ({ MemorableMomentOverlay: (): null => null }));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: (): null => null
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key,
		tArray: (key: string): string[] => [key]
	}
}));

const mockedUsePlayerProfile = jest.mocked(usePlayerProfile);

function profileWithEffect(effect: string): void {
	mockedUsePlayerProfile.mockReturnValue({
		status: "ready",
		data: {
			pseudo: "Aster",
			level: 12,
			classId: 1,
			effect: {
				healed: effect === NO_EFFECT, timeLeft: 0, effect, hasTimeDisplay: false
			}
		} as ProfileRes
	});
}

const DEADLY_BIG_EVENT: ReportBigEventResultRes = {
	eventId: 25, possibilityId: "fight", outcomeId: "1", score: 0, experience: 0, health: -100, money: 0, energy: 0, gems: 0, tokens: 0, oneshot: false
};

const DEADLY_SMALL_EVENT: SmallEventResultRes = {
	eventName: "SmallEventSmallBadPacket",
	data: {
		issue: "healthLost", amount: 20
	}
};

describe("death of the character", () => {
	beforeEach(() => {
		fakeAppState.reset();
		reportEventStore.reset();
	});

	it.each([
		[
			"a big event",
			ReportBigEventResultRes.wireName,
			DEADLY_BIG_EVENT,
			reportEventStore.clear
		],
		[
			"a small event",
			SmallEventResultRes.wireName,
			DEADLY_SMALL_EVENT,
			reportEventStore.clearAutomatic
		]
	])("tells the outcome of %s that killed the character before the death", async (_event, wireName, outcome, continueAfterOutcome) => {
		profileWithEffect(NO_EFFECT);
		await render(<TabLayout />);

		// Core sends the outcome, then the profile refreshed once the event is over says the character died.
		await act(async () => pushFromCore(wireName, outcome));
		profileWithEffect(PLAYER_EFFECTS.DEAD);
		await screen.rerender(<TabLayout />);

		expect(screen.getByText("tabs")).toBeTruthy();
		expect(screen.queryByText("death")).toBeNull();

		// What the continue button under the outcome does.
		await act(async () => continueAfterOutcome());

		expect(screen.getByText("death")).toBeTruthy();
		expect(screen.queryByText("tabs")).toBeNull();
	});

	it("opens on the death when no event is being told", async () => {
		profileWithEffect(PLAYER_EFFECTS.DEAD);

		await render(<TabLayout />);

		expect(screen.getByText("death")).toBeTruthy();
	});
});
