import {fireEvent, screen, waitFor} from "@testing-library/react-native";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {AdventureWelcome} from "@/src/components/AdventureWelcome";
import {GameClient} from "@/src/networking/GameClient";
import {clearTestQueryClients, renderWithGameQuery} from "@/src/testing/testUtils";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: (): object => ({registerPushedPacketHandler: (): (() => void) => () => undefined})}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/store/useReducedMotion", () => ({useReducedMotion: (): boolean => true}));

describe("adventure welcome", () => {
	beforeEach(() => jest.clearAllMocks());
	afterEach(clearTestQueryClients);

	it("tells only what matters now, before asking anything of the server", async () => {
		await renderWithGameQuery(<AdventureWelcome />);
		expect(screen.getByText("app:welcome.title")).toBeTruthy();
		expect(screen.getByText("app:welcome.rhythm")).toBeTruthy();
		expect(screen.queryByText(/pillars|opensAtLevel/)).toBeNull();
		expect(GameClient.request).not.toHaveBeenCalled();
	});

	it("sends the first report when the player sets off", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "alternative", packetName: "SmallEventResultRes"});
		await renderWithGameQuery(<AdventureWelcome />);
		await fireEvent.press(screen.getByText("app:welcome.depart"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(1));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(ReportReq);
	});

	it("lets the player set off again when the first report is refused", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await renderWithGameQuery(<AdventureWelcome />);
		await fireEvent.press(screen.getByText("app:welcome.depart"));
		expect(await screen.findByText("app:common.connectionError")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:welcome.depart"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
	});
});
