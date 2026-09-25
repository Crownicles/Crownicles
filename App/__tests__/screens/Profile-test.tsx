import {fireEvent, render} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import Profile from "@/app/(protected)/(tabs)/profile";
import {useGameQuery} from "@/src/store/useGameQuery";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useNavigation: (): {setOptions: jest.Mock} => ({setOptions: jest.fn()}),
	useRouter: (): {push: jest.Mock} => ({push: mockPush}),
	useFocusEffect: jest.fn()
}));

jest.mock("@/src/store/useGameQuery", () => ({
	useGameQuery: jest.fn()
}));

jest.mock("@/src/store/usePlayerProfile", () => ({
	usePlayerProfile: jest.fn()
}));

jest.mock("@/src/components/Inventory", () => ({
	Inventory: (): null => null
}));

jest.mock("@/src/components/Missions", () => ({Missions: (): null => null}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: (path: string): string => `icon:${path}`
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

const mockedUseGameQuery = jest.mocked(useGameQuery);
const mockedUsePlayerProfile = jest.mocked(usePlayerProfile);

function profile(): ProfileRes {
	return {
		pseudo: "Aventurier",
		classId: 1,
		level: 12,
		health: {value: 80, max: 100},
		experience: {value: 25, max: 100},
		money: 400,
		tokens: {value: 3, max: 10},
		missions: {gems: 8, campaignProgression: 50},
		rank: {unranked: false, rank: 2, numberOfPlayers: 10, score: 900},
		effect: {healed: true, timeLeft: 0, effect: "none", hasTimeDisplay: false},
		stats: {
			energy: {value: 10, max: 20},
			attack: 5,
			defense: 6,
			speed: 7,
			breath: {base: 2, max: 4, regen: 1}
		},
		badges: []
	} as ProfileRes;
}

describe("Profile screen", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		mockedUsePlayerProfile.mockReturnValue({status: "ready", data: profile()});
		mockedUseGameQuery.mockReturnValue({status: "ready", data: {foundPlayer: true} as never});
	});

	it("composes the profile from the shared design primitives", async () => {
		const view = await render(<Profile />);

		expect(view.getByText("app:profile.eyebrow")).toBeTruthy();
		expect(view.getByTestId("profile-standing")).toBeTruthy();
		expect(view.getByText("app:profile.titles.statistics")).toBeTruthy();
		expect(view.getByText("app:profile.titles.scoreAndRank")).toBeTruthy();
		expect(view.queryByText("app:profile.tooltips.money")).toBeNull();
	});

	it("keeps the fighting statistics folded until they are asked for", async () => {
		const view = await render(<Profile />);
		expect(view.queryByText("app:profile.fields.attack")).toBeNull();
		await fireEvent.press(view.getByText("app:profile.titles.statistics"));
		expect(view.getByText("app:profile.fields.attack")).toBeTruthy();
	});

	it("hands the sub-pages over to the navigation stack, so the back gesture works", async () => {
		const view = await render(<Profile />);
		await fireEvent.press(view.getByRole("button", {name: /app:profile.titles.inventory/}));
		expect(mockPush).toHaveBeenCalledWith("/profile/inventory");
		await fireEvent.press(view.getByRole("button", {name: /app:profile.titles.missions/}));
		expect(mockPush).toHaveBeenCalledWith("/profile/missions");
	});
});
