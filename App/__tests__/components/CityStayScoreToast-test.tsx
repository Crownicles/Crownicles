import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import { ReportDestinationRes } from "ws-packets/src/fromServer/report/ReportDestinationRes";
import { CityStayScoreToast } from "@/src/components/CityStayScoreToast";
import { cityStayScoreStore } from "@/src/store/CityStayScoreStore";
import { WebSocketClient } from "@/src/networking/WebSocketClient";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key } }));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => `icon:${path}`, getIconOrNull: (): null => null
} }));
jest.mock("@/src/components/UnlockCelebration", () => ({ useAdventureBusy: jest.fn(() => false) }));
jest.mock("@/src/journey/useJourney", () => ({ useJourney: (): object => ({ unannounced: null }) }));
jest.mock("@/src/store/MissionRewardsStore", () => ({ useMissionRewards: jest.fn(() => ({ unannounced: 0 })) }));

async function leaveCity(packet: ReportDestinationRes): Promise<void> {
	await act(async () => {
		Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(ReportDestinationRes.wireName, packet);
	});
}

describe("CityStayScoreToast", () => {
	afterEach(async () => {
		await act(async () => cityStayScoreStore.announced());
	});

	it("tells the points the city stay earned when the player leaves, and goes away when tapped", async () => {
		await render(<CityStayScoreToast />);
		await leaveCity({ cityStayScore: 75 });

		expect(screen.getByText("app:city.stayScore.title")).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain {\"amount\":\"75\"}")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:city.stayScore.title"));
		expect(screen.queryByText("app:city.stayScore.title")).toBeNull();
	});

	it("says nothing about a trip that did not start from a city stay", async () => {
		await render(<CityStayScoreToast />);
		await leaveCity({});

		expect(screen.queryByText("app:city.stayScore.title")).toBeNull();
	});
});
