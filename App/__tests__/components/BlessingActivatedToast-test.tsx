import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {BlessingActivatedRes} from "ws-packets/src/fromServer/character/BlessingActivatedRes";
import {BlessingActivatedToast} from "@/src/components/BlessingActivatedToast";
import {blessingAnnouncementStore} from "@/src/store/BlessingAnnouncementStore";
import {useAdventureBusy} from "@/src/components/UnlockCelebration";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));
jest.mock("@/src/components/UnlockCelebration", () => ({useAdventureBusy: jest.fn(() => false)}));
jest.mock("@/src/journey/useJourney", () => ({useJourney: (): object => ({unannounced: null})}));
jest.mock("@/src/store/MissionRewardsStore", () => ({useMissionRewards: jest.fn(() => ({unannounced: 0}))}));

const mockedBusy = jest.mocked(useAdventureBusy);
const mockedMissionRewards = jest.mocked(useMissionRewards);

async function blessingFromCore(): Promise<void> {
	const packet: BlessingActivatedRes = {blessingType: 4, durationHours: 12};
	await act(async () => {
		Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(BlessingActivatedRes.wireName, packet);
	});
}

describe("BlessingActivatedToast", () => {
	afterEach(async () => {
		await act(async () => blessingAnnouncementStore.announced());
		mockedBusy.mockReturnValue(false);
		mockedMissionRewards.mockReturnValue({unannounced: 0} as ReturnType<typeof useMissionRewards>);
	});

	it("announces a blessing invoked while the player is in the app", async () => {
		await render(<BlessingActivatedToast />);
		expect(screen.queryByText("app:reference.blessing.activated")).toBeNull();

		await blessingFromCore();

		expect(screen.getByText("app:reference.blessing.activated")).toBeTruthy();
		expect(screen.getByText("bot:blessingEffects.4")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:reference.blessing.activated"));
		expect(screen.queryByText("app:reference.blessing.activated")).toBeNull();
	});

	it("waits for the adventure story and the mission toast before announcing it", async () => {
		mockedBusy.mockReturnValue(true);
		mockedMissionRewards.mockReturnValue({unannounced: 1} as ReturnType<typeof useMissionRewards>);
		const view = await render(<BlessingActivatedToast />);
		await blessingFromCore();
		expect(screen.queryByText("app:reference.blessing.activated")).toBeNull();

		mockedBusy.mockReturnValue(false);
		await view.rerender(<BlessingActivatedToast />);
		expect(screen.queryByText("app:reference.blessing.activated")).toBeNull();

		mockedMissionRewards.mockReturnValue({unannounced: 0} as ReturnType<typeof useMissionRewards>);
		await view.rerender(<BlessingActivatedToast />);
		expect(screen.getByText("app:reference.blessing.activated")).toBeTruthy();
	});
});
