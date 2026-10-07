import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import DeleteAccount from "@/app/(protected)/settings/delete-account";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {ACCOUNT_DELETION_FAILURES, AccountDeletionRequestFailure, RestApi} from "@/src/networking/RestApi";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";

const mockAccessToken = jest.fn();
const mockDisconnect = jest.fn();
jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({back: jest.fn()})}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/notifications/PushRegistration", () => ({forgetPushDevice: jest.fn()}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({getCurrentAccessToken: mockAccessToken, disconnect: mockDisconnect, registerPushedPacketHandler: (): () => void => (): void => {}})}}));

const requestLabel = "app:settings.deleteAccount.ask";
const confirmLabel = "app:settings.deleteAccount.confirm";

async function renderDeletion(clearToken = jest.fn().mockResolvedValue(undefined)): Promise<{clearToken: jest.Mock; setState: jest.Mock; unmount: () => Promise<void>}> {
	const auth = {clearToken, setState: jest.fn(), state: AuthStateEnum.LOGGED_IN, saveToken: jest.fn()};
	const view = await render(<AuthContext.Provider value={auth}><DeleteAccount /></AuthContext.Provider>);
	return {...auth, unmount: view.unmount};
}

describe("account deletion screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockAccessToken.mockResolvedValue("active-session-token");
		jest.spyOn(RestApi, "requestAccountDeletion").mockResolvedValue(true);
		jest.spyOn(RestApi, "deleteAccount").mockResolvedValue(true);
	});

	afterEach(() => jest.restoreAllMocks());

	it("uses the current session and announces only a transmitted request", async () => {
		const auth = await renderDeletion();
		await fireEvent.press(screen.getByRole("button", {name: requestLabel}));
		await screen.findByText("app:settings.deleteAccount.requested");
		expect(RestApi.requestAccountDeletion).toHaveBeenCalledWith("active-session-token");
		expect(auth.clearToken).not.toHaveBeenCalled();
		expect(mockDisconnect).not.toHaveBeenCalled();
	});

	it("does not submit twice while the session token is being refreshed", async () => {
		let finish!: (token: string) => void;
		mockAccessToken.mockReturnValue(new Promise<string>(resolve => {finish = resolve;}));
		await renderDeletion();
		await fireEvent.press(screen.getByRole("button", {name: requestLabel}));
		await fireEvent.press(screen.getByRole("button", {name: requestLabel}));
		expect(mockAccessToken).toHaveBeenCalledTimes(1);
		expect(RestApi.requestAccountDeletion).not.toHaveBeenCalled();
		await act(async () => {finish("active-session-token");});
		await waitFor(() => expect(RestApi.requestAccountDeletion).toHaveBeenCalledTimes(1));
	});

	it("does not promise a code when the server cannot deliver the request", async () => {
		jest.mocked(RestApi.requestAccountDeletion).mockRejectedValue(new AccountDeletionRequestFailure(ACCOUNT_DELETION_FAILURES.UNAVAILABLE));
		await renderDeletion();
		await fireEvent.press(screen.getByRole("button", {name: requestLabel}));
		await screen.findByText("app:settings.deleteAccount.unavailable");
		expect(screen.queryByText("app:settings.deleteAccount.requested")).toBeNull();
		expect(screen.getByRole("button", {name: requestLabel})).toBeEnabled();
	});

	it.each([
		{reason: ACCOUNT_DELETION_FAILURES.INVALID_CODE, message: "app:settings.deleteAccount.codeError"},
		{reason: ACCOUNT_DELETION_FAILURES.UNAUTHORIZED, message: "app:settings.deleteAccount.sessionExpired"},
		{reason: ACCOUNT_DELETION_FAILURES.UNAVAILABLE, message: "app:settings.deleteAccount.unavailable"}
	])("shows the actual confirmation failure: $reason", async ({reason, message}) => {
		jest.mocked(RestApi.deleteAccount).mockRejectedValue(new AccountDeletionRequestFailure(reason));
		const auth = await renderDeletion();
		await fireEvent.changeText(screen.getByLabelText("app:settings.deleteAccount.codeLabel"), " CODE ");
		await fireEvent.press(screen.getByRole("button", {name: confirmLabel}));
		await screen.findByText(message);
		expect(auth.clearToken).not.toHaveBeenCalled();
	});

	it("disconnects and clears the session after confirmed deletion", async () => {
		const auth = await renderDeletion();
		await fireEvent.changeText(screen.getByLabelText("app:settings.deleteAccount.codeLabel"), " CODE ");
		await fireEvent.press(screen.getByRole("button", {name: confirmLabel}));
		await waitFor(() => expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN));
		expect(RestApi.deleteAccount).toHaveBeenCalledWith("active-session-token", "CODE");
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
		expect(forgetPushDevice).toHaveBeenCalled();
		expect(auth.clearToken).toHaveBeenCalledTimes(1);
	});

	it("retries only local cleanup after deletion succeeds but secure storage fails", async () => {
		const clearToken = jest.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(undefined);
		const auth = await renderDeletion(clearToken);
		await fireEvent.changeText(screen.getByLabelText("app:settings.deleteAccount.codeLabel"), "CODE");
		await fireEvent.press(screen.getByRole("button", {name: confirmLabel}));
		await screen.findByText("app:settings.deleteAccount.cleanupError");
		expect(screen.queryByRole("button", {name: confirmLabel})).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "app:settings.deleteAccount.finishLogout"}));
		await waitFor(() => expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN));
		expect(RestApi.deleteAccount).toHaveBeenCalledTimes(1);
		expect(clearToken).toHaveBeenCalledTimes(2);
	});

	it("does not send a deletion request after the screen leaves during token refresh", async () => {
		let finish!: (token: string) => void;
		mockAccessToken.mockReturnValue(new Promise<string>(resolve => {finish = resolve;}));
		const view = await renderDeletion();
		await fireEvent.press(screen.getByRole("button", {name: requestLabel}));
		await view.unmount();
		await act(async () => {finish("previous-account-token");});
		expect(RestApi.requestAccountDeletion).not.toHaveBeenCalled();
	});
});