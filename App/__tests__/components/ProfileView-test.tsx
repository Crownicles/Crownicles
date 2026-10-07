import {fireEvent, render, screen} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ProfileView} from "@/src/components/ProfileView";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`, getIconOrNull: (path: string): string => `icon:${path}`}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const PROFILE = {
	pseudo: "Marin",
	classId: 1,
	level: 12,
	health: {value: 80, max: 100},
	experience: {value: 25, max: 100},
	money: 400,
	tokens: {value: 3, max: 10},
	missions: {gems: 8, campaignProgression: 50},
	rank: {unranked: false, rank: 2, numberOfPlayers: 10, score: 900},
	effect: {healed: true, timeLeft: 0, effect: "none", hasTimeDisplay: false},
	stats: {energy: {value: 10, max: 20}, attack: 5, defense: 6, speed: 7, breath: {base: 2, max: 4, regen: 1}},
	badges: [],
	guild: "Aurore"
} as ProfileRes;

describe("someone else's profile", () => {
	it("opens the guild they belong to", async () => {
		const onGuild = jest.fn();
		await render(<ProfileView profile={PROFILE} onGuild={onGuild} />);
		await fireEvent.press(screen.getByText("Aurore"));
		expect(onGuild).toHaveBeenCalledWith("Aurore");
	});

	it("only names the guild when there is nowhere to open it", async () => {
		await render(<ProfileView profile={PROFILE} />);
		expect(screen.getByText("Aurore")).toBeTruthy();
		expect(screen.queryByTestId("profile-guild")).toBeNull();
	});
});
