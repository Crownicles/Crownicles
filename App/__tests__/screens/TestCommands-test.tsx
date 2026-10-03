import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {TestCommandRes, TestListRes} from "ws-packets/src/fromServer/test/TestRes";
import {TestCommandReq} from "ws-packets/src/fromClient/TestReq";
import TestCommands from "@/app/(protected)/settings/test-commands";
import {testCommandSuggestions} from "@/src/store/useTestCommands";
import {GameClient} from "@/src/networking/GameClient";

const mockSendPacket = jest.fn();
const mockPushed = new Map<string, (packet: unknown) => void>();
jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({back: jest.fn()})}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({
	sendPacket: mockSendPacket,
	registerPushedPacketHandler: (name: string, callback: (packet: unknown) => void): () => void => {
		mockPushed.set(name, callback);
		return (): void => {
			mockPushed.delete(name);
		};
	}
})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const COMMANDS = [
	{name: "level", aliases: ["lvl"], format: "<niveau>"},
	{name: "money", description: "Donne de l'argent"},
	{name: "lovepet", aliases: ["petlove"]}
];

async function renderConsole(testMode: boolean): Promise<void> {
	jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: Object.assign(new TestListRes(), {testMode, commands: COMMANDS})});
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
	await render(<QueryClientProvider client={client}><TestCommands /></QueryClientProvider>);
}

describe("test commands console", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPushed.clear();
	});

	it("suggests commands by name or alias until arguments are typed", () => {
		expect(testCommandSuggestions(COMMANDS, "l").map(command => command.name)).toEqual(["level", "lovepet"]);
		expect(testCommandSuggestions(COMMANDS, "PET").map(command => command.name)).toEqual(["lovepet"]);
		expect(testCommandSuggestions(COMMANDS, "level ")).toEqual([]);
		expect(testCommandSuggestions(COMMANDS, "")).toEqual([]);
	});

	it("says the server does not run test commands instead of offering them", async () => {
		await renderConsole(false);
		await waitFor(() => expect(screen.getByText("app:settings.testCommands.disabled")).toBeTruthy());
		expect(screen.queryByText("app:settings.testCommands.run")).toBeNull();
	});

	it("sends the typed command and lists every result the server prints", async () => {
		await renderConsole(true);
		await waitFor(() => expect(screen.getByLabelText("app:settings.testCommands.command")).toBeTruthy());
		await fireEvent.changeText(screen.getByLabelText("app:settings.testCommands.command"), "lv");
		await fireEvent.press(screen.getByText("level"));
		await fireEvent.changeText(screen.getByLabelText("app:settings.testCommands.command"), "level 50 && money 10 ");
		await fireEvent.press(screen.getByText("app:settings.testCommands.run"));
		expect(mockSendPacket.mock.calls[0][0]).toBeInstanceOf(TestCommandReq);
		expect(mockSendPacket.mock.calls[0][0]).toMatchObject({command: "level 50 && money 10"});
		await act(() => {
			mockPushed.get(TestCommandRes.wireName)?.({commandName: "level", result: "Niveau 50", isError: false});
			mockPushed.get(TestCommandRes.wireName)?.({commandName: "money", result: "Argument invalide", isError: true});
		});
		expect(screen.getByText("Niveau 50")).toBeTruthy();
		expect(screen.getByText("Argument invalide")).toBeTruthy();
	});
});
