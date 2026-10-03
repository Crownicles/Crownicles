import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {PlayerLevelUpRes} from "ws-packets/src/fromServer/character/PlayerLevelUpRes";
import {LevelUpToast} from "@/src/components/LevelUpToast";
import {levelUpStore} from "@/src/store/LevelUpStore";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));
jest.mock("@/src/components/UnlockCelebration", () => ({useAdventureBusy: jest.fn(() => false)}));
jest.mock("@/src/journey/useJourney", () => ({useJourney: (): object => ({unannounced: null})}));
jest.mock("@/src/store/MissionRewardsStore", () => ({useMissionRewards: jest.fn(() => ({unannounced: 0}))}));

const mockedMissionRewards = jest.mocked(useMissionRewards);

async function levelUpFromCore(values: Partial<PlayerLevelUpRes>): Promise<void> {
	const packet: PlayerLevelUpRes = {self: true, level: 5, healthRestored: true, statsIncreased: true, missionSlotUnlocked: false, ...values};
	await act(async () => {
		Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(PlayerLevelUpRes.wireName, packet);
	});
}

describe("LevelUpToast", () => {
	afterEach(async () => {
		await act(async () => levelUpStore.announced());
		mockedMissionRewards.mockReturnValue({unannounced: 0} as ReturnType<typeof useMissionRewards>);
	});

	it("tells the player their character levelled up, and what it brings", async () => {
		await render(<LevelUpToast />);
		await levelUpFromCore({});

		expect(screen.getByText("app:levelUp.title")).toBeTruthy();
		expect(screen.getByText("app:levelUp.healthRestored · app:levelUp.statsIncreased")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:levelUp.title"));
		expect(screen.queryByText("app:levelUp.title")).toBeNull();
	});

	it("says nothing when another guild member levels up", async () => {
		await render(<LevelUpToast />);
		await levelUpFromCore({self: false});
		expect(screen.queryByText("app:levelUp.title")).toBeNull();
	});

	it("waits for the mission toast to have its turn", async () => {
		mockedMissionRewards.mockReturnValue({unannounced: 1} as ReturnType<typeof useMissionRewards>);
		const view = await render(<LevelUpToast />);
		await levelUpFromCore({});
		expect(screen.queryByText("app:levelUp.title")).toBeNull();

		mockedMissionRewards.mockReturnValue({unannounced: 0} as ReturnType<typeof useMissionRewards>);
		await view.rerender(<LevelUpToast />);
		expect(screen.getByText("app:levelUp.title")).toBeTruthy();
	});
});
