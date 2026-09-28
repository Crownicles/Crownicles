import React from "react";
import {Text} from "react-native";
import {act, fireEvent, render, waitFor} from "@testing-library/react-native";
import {BootGate} from "@/src/translations/BootGate";
import {AssetsManager, CachedBundle} from "@/src/assets/AssetsManager";
import {applyServerBundle} from "@/src/translations/i18nLoader";
import {RestApi} from "@/src/networking/RestApi";

jest.mock("@/src/assets/AssetsManager", () => ({AssetsManager: {
	loadCachedBundle: jest.fn(),
	syncBundle: jest.fn()
}}));
jest.mock("@/src/translations/i18nLoader", () => ({applyServerBundle: jest.fn()}));
jest.mock("@/src/networking/RestApi", () => ({RestApi: {getCompatibility: jest.fn()}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/design/Primitives", () => {
	const react = jest.requireActual("react");
	const reactNative = jest.requireActual("react-native");
	return {Button: ({onPress, children}: {onPress: () => void; children: string}) => react.createElement(
		reactNative.Pressable,
		{onPress},
		react.createElement(reactNative.Text, null, children)
	)};
});

const bundle = {
	bundle: {language: "fr" as const, namespaces: {app: {boot: {updating: "Préparation"}}}, icons: {}},
	etag: '"bundle-hash"'
};
const mockedLoadCachedBundle = jest.mocked(AssetsManager.loadCachedBundle);
const mockedSyncBundle = jest.mocked(AssetsManager.syncBundle);
const mockedApplyServerBundle = jest.mocked(applyServerBundle);

async function renderGate(): Promise<Awaited<ReturnType<typeof render>>> {
	return await render(<BootGate><Text>route content</Text></BootGate>);
}

describe("BootGate", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedLoadCachedBundle.mockResolvedValue(null);
		mockedSyncBundle.mockResolvedValue(bundle);
		jest.mocked(RestApi.getCompatibility).mockResolvedValue("upToDate");
	});

	it("refuses to open the game to an app older than the server, with no way around it", async () => {
		mockedLoadCachedBundle.mockResolvedValue(bundle);
		jest.mocked(RestApi.getCompatibility).mockResolvedValue("appOutdated");
		const view = await renderGate();

		await waitFor(() => expect(view.getByText("app:boot.appOutdated")).toBeTruthy());
		expect(view.queryByText("route content")).toBeNull();
		expect(view.queryByText("app:boot.retry")).toBeNull();
	});

	it("waits for a server being updated and lets the player try again", async () => {
		jest.mocked(RestApi.getCompatibility).mockResolvedValueOnce("serverOutdated").mockResolvedValue("upToDate");
		const view = await renderGate();

		await waitFor(() => expect(view.getByText("app:boot.serverOutdated")).toBeTruthy());
		fireEvent.press(view.getByText("app:boot.retry"));
		await waitFor(() => expect(view.getByText("route content")).toBeTruthy());
	});

	it("still starts when the compatibility cannot be checked", async () => {
		jest.mocked(RestApi.getCompatibility).mockResolvedValue(null);
		const view = await renderGate();

		await waitFor(() => expect(view.getByText("route content")).toBeTruthy());
	});

	it("does not mount routes before a fresh bundle is loaded", async () => {
		let resolveSync: ((value: CachedBundle) => void) | undefined;
		mockedSyncBundle.mockReturnValue(new Promise(resolve => {
			resolveSync = resolve;
		}));
		const view = await renderGate();

		expect(view.getByText("app:boot.updating")).toBeTruthy();
		expect(view.queryByText("route content")).toBeNull();
		await act(async () => resolveSync?.(bundle));
		await waitFor(() => expect(view.getByText("route content")).toBeTruthy());
		expect(mockedApplyServerBundle).toHaveBeenCalledWith(bundle.bundle);
	});

	it("mounts routes from cache while revalidating in the background", async () => {
		mockedLoadCachedBundle.mockResolvedValue(bundle);
		mockedSyncBundle.mockReturnValue(new Promise(() => undefined));
		const view = await renderGate();

		await waitFor(() => expect(view.getByText("route content")).toBeTruthy());
		expect(mockedApplyServerBundle).toHaveBeenCalledWith(bundle.bundle);
		expect(mockedSyncBundle).toHaveBeenCalledWith("fr", bundle);
	});

	it("offers retry after a failed first download", async () => {
		const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
		mockedSyncBundle
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(bundle);
		const view = await renderGate();

		fireEvent.press(view.getByText("app:boot.retry"));
		await waitFor(() => expect(view.getByText("route content")).toBeTruthy());
		expect(mockedSyncBundle).toHaveBeenCalledTimes(2);
		consoleError.mockRestore();
	});
});
