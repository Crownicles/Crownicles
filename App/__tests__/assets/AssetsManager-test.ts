import {
	EncodingType,
	deleteAsync,
	documentDirectory,
	getInfoAsync,
	makeDirectoryAsync,
	moveAsync,
	readAsStringAsync,
	writeAsStringAsync
} from "expo-file-system/legacy";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {RestApi} from "@/src/networking/RestApi";
import {fakeGameRules} from "@/src/testing/fakeGameRules";

jest.mock("expo-file-system/legacy", () => ({
	EncodingType: {UTF8: "utf8"},
	deleteAsync: jest.fn(),
	documentDirectory: "file:///documents/",
	getInfoAsync: jest.fn(),
	makeDirectoryAsync: jest.fn(),
	moveAsync: jest.fn(),
	readAsStringAsync: jest.fn(),
	writeAsStringAsync: jest.fn()
}));

jest.mock("@/src/networking/RestApi", () => ({
	RestApi: {
		getAssetsBundle: jest.fn()
	}
}));

const mockedGetInfoAsync = getInfoAsync as jest.MockedFunction<typeof getInfoAsync>;
const mockedMakeDirectoryAsync = makeDirectoryAsync as jest.MockedFunction<typeof makeDirectoryAsync>;
const mockedMoveAsync = moveAsync as jest.MockedFunction<typeof moveAsync>;
const mockedReadAsStringAsync = readAsStringAsync as jest.MockedFunction<typeof readAsStringAsync>;
const mockedWriteAsStringAsync = writeAsStringAsync as jest.MockedFunction<typeof writeAsStringAsync>;
const mockedGetAssetsBundle = RestApi.getAssetsBundle as jest.MockedFunction<typeof RestApi.getAssetsBundle>;
const mockedDeleteAsync = deleteAsync as jest.MockedFunction<typeof deleteAsync>;

const bundle = {
	language: "fr" as const,
	namespaces: {app: {common: {loading: "Chargement"}}},
	icons: {clocks: ["clock"]},
	rules: fakeGameRules
};
const cached = {bundle, etag: '"bundle-hash"'};

describe("AssetsManager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedGetInfoAsync.mockResolvedValue({exists: false, uri: "file:///documents/i18n/bundle-fr.json", isDirectory: false});
		mockedMakeDirectoryAsync.mockResolvedValue(undefined);
		mockedMoveAsync.mockResolvedValue(undefined);
		mockedReadAsStringAsync.mockResolvedValue(JSON.stringify(cached));
		mockedWriteAsStringAsync.mockResolvedValue(undefined);
		mockedDeleteAsync.mockResolvedValue(undefined);
		mockedGetAssetsBundle.mockResolvedValue({status: "ok", ...cached});
	});

	it("writes a refreshed server bundle to a single cache file atomically", async () => {
		const result = await AssetsManager.syncBundle("fr", null);

		expect(result).toEqual(cached);
		expect(mockedGetAssetsBundle).toHaveBeenCalledWith("fr", undefined);
		expect(mockedMakeDirectoryAsync).toHaveBeenCalledWith(`${documentDirectory}i18n`, {intermediates: true});
		expect(mockedWriteAsStringAsync).toHaveBeenCalledWith(
			`${documentDirectory}i18n/bundle-fr.json.tmp`,
			expect.stringContaining("bundle-hash"),
			{encoding: EncodingType.UTF8}
		);
		expect(mockedMoveAsync).toHaveBeenCalledWith({
			from: `${documentDirectory}i18n/bundle-fr.json.tmp`,
			to: `${documentDirectory}i18n/bundle-fr.json`
		});
	});

	it("loads a valid cached bundle and removes the legacy asset directory", async () => {
		mockedGetInfoAsync.mockResolvedValue({exists: true, uri: `${documentDirectory}i18n/bundle-fr.json`, isDirectory: false, size: 1, modificationTime: 0});

		await expect(AssetsManager.loadCachedBundle("fr")).resolves.toEqual(cached);
		expect(mockedDeleteAsync).toHaveBeenCalledWith(`${documentDirectory}assets`, {idempotent: true});
	});

	it("deletes a corrupt cache file and treats it as a cache miss", async () => {
		mockedGetInfoAsync.mockResolvedValue({exists: true, uri: `${documentDirectory}i18n/bundle-fr.json`, isDirectory: false, size: 1, modificationTime: 0});
		mockedReadAsStringAsync.mockResolvedValue("not json");

		await expect(AssetsManager.loadCachedBundle("fr")).resolves.toBeNull();
		expect(mockedDeleteAsync).toHaveBeenCalledWith(`${documentDirectory}i18n/bundle-fr.json`, {idempotent: true});
	});

	it("drops a cache saved before the server sent game rules, so they get downloaded", async () => {
		mockedGetInfoAsync.mockResolvedValue({exists: true, uri: `${documentDirectory}i18n/bundle-fr.json`, isDirectory: false, size: 1, modificationTime: 0});
		const {rules: _rules, ...withoutRules} = bundle;
		mockedReadAsStringAsync.mockResolvedValue(JSON.stringify({...cached, bundle: withoutRules}));

		await expect(AssetsManager.loadCachedBundle("fr")).resolves.toBeNull();
		expect(mockedDeleteAsync).toHaveBeenCalledWith(`${documentDirectory}i18n/bundle-fr.json`, {idempotent: true});
	});

	it("drops a cache saved before a rule section was added, rather than letting a screen read it", async () => {
		mockedGetInfoAsync.mockResolvedValue({exists: true, uri: `${documentDirectory}i18n/bundle-fr.json`, isDirectory: false, size: 1, modificationTime: 0});
		const {apartment: _apartment, ...olderRules} = fakeGameRules;
		mockedReadAsStringAsync.mockResolvedValue(JSON.stringify({...cached, bundle: {...bundle, rules: olderRules}}));

		await expect(AssetsManager.loadCachedBundle("fr")).resolves.toBeNull();
	});

	it("revalidates cached bundles with their ETag without writing a new cache", async () => {
		mockedGetAssetsBundle.mockResolvedValue({status: "notModified"});

		await expect(AssetsManager.syncBundle("fr", cached)).resolves.toEqual(cached);
		expect(mockedGetAssetsBundle).toHaveBeenCalledWith("fr", cached.etag);
		expect(mockedWriteAsStringAsync).not.toHaveBeenCalled();
	});

	it("retries failed requests up to three times", async () => {
		jest.useFakeTimers();
		mockedGetAssetsBundle
			.mockRejectedValueOnce(new Error("first failure"))
			.mockRejectedValueOnce(new Error("second failure"))
			.mockResolvedValueOnce({status: "ok", ...cached});

		const sync = AssetsManager.syncBundle("fr", null);
		await jest.advanceTimersByTimeAsync(4_000);
		await expect(sync).resolves.toEqual(cached);
		expect(mockedGetAssetsBundle).toHaveBeenCalledTimes(3);
		jest.useRealTimers();
	});
});
