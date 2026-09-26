import {
	EncodingType,
	getInfoAsync,
	makeDirectoryAsync,
	readAsStringAsync,
	readDirectoryAsync,
	writeAsStringAsync
} from "expo-file-system/legacy";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {RestApi} from "@/src/networking/RestApi";
import {AppIcons} from "@/src/AppIcons";
import {reloadI18n} from "@/src/translations/i18nLoader";

jest.mock("expo-file-system/legacy", () => ({
	EncodingType: {UTF8: "utf8"},
	documentDirectory: "file:///documents/",
	getInfoAsync: jest.fn(),
	makeDirectoryAsync: jest.fn(),
	readAsStringAsync: jest.fn(),
	readDirectoryAsync: jest.fn(),
	writeAsStringAsync: jest.fn()
}));

jest.mock("@/src/networking/RestApi", () => ({
	RestApi: {
		getAssets: jest.fn(),
		downloadAsset: jest.fn()
	}
}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		reloadAppIcons: jest.fn()
	}
}));

jest.mock("@/src/translations/i18nLoader", () => ({
	reloadI18n: jest.fn()
}));

const mockedGetInfoAsync = getInfoAsync as jest.MockedFunction<typeof getInfoAsync>;
const mockedMakeDirectoryAsync = makeDirectoryAsync as jest.MockedFunction<typeof makeDirectoryAsync>;
const mockedReadAsStringAsync = readAsStringAsync as jest.MockedFunction<typeof readAsStringAsync>;
const mockedReadDirectoryAsync = readDirectoryAsync as jest.MockedFunction<typeof readDirectoryAsync>;
const mockedWriteAsStringAsync = writeAsStringAsync as jest.MockedFunction<typeof writeAsStringAsync>;
const mockedGetAssets = RestApi.getAssets as jest.MockedFunction<typeof RestApi.getAssets>;
const mockedDownloadAsset = RestApi.downloadAsset as jest.MockedFunction<typeof RestApi.downloadAsset>;
const mockedReloadI18n = reloadI18n as jest.MockedFunction<typeof reloadI18n>;
const mockedReloadAppIcons = AppIcons.reloadAppIcons as jest.MockedFunction<typeof AppIcons.reloadAppIcons>;

const assetFile = "Lang/fr/app.json";
const assetContent = "{\"common\":{\"loading\":\"Chargement\"}}";
const assetHash = "7c9c57a112f2441c1d0d5f2c9e2c8ec9";
const assetPath = `file:///documents/assets/${assetFile}`;

function infoFor(path: string, options?: {md5?: boolean}): Awaited<ReturnType<typeof getInfoAsync>> {
	if (options?.md5) {
		return {exists: true, uri: path, size: assetContent.length, isDirectory: false, modificationTime: Date.now(), md5: assetHash};
	}
	if (path === "file:///documents/" || path === "file:///documents/assets") {
		return {exists: true, uri: path, size: 0, isDirectory: true, modificationTime: Date.now()};
	}
	if (path === assetPath) {
		return {exists: true, uri: path, size: assetContent.length, isDirectory: false, modificationTime: Date.now()};
	}
	return {exists: false, uri: path, isDirectory: false};
}

describe("AssetsManager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedGetInfoAsync.mockImplementation(async (path, options) => infoFor(path, options));
		mockedReadDirectoryAsync.mockResolvedValue([]);
		mockedReadAsStringAsync.mockResolvedValue(assetContent);
		mockedGetAssets.mockResolvedValue([{file: assetFile, hash: assetHash}]);
		mockedDownloadAsset.mockResolvedValue(assetContent);
		mockedReloadI18n.mockResolvedValue();
	});

	it("downloads changed assets, verifies their hash, and reloads resources", async () => {
		await AssetsManager.updateAssets();

		expect(mockedDownloadAsset).toHaveBeenCalledWith(assetFile);
		expect(mockedMakeDirectoryAsync).toHaveBeenCalledWith("file:///documents/assets/Lang", {intermediates: true});
		expect(mockedMakeDirectoryAsync).toHaveBeenCalledWith("file:///documents/assets/Lang/fr", {intermediates: true});
		expect(mockedWriteAsStringAsync).toHaveBeenCalledWith(assetPath, assetContent, {encoding: EncodingType.UTF8});
		expect(mockedReloadI18n).toHaveBeenCalledWith(new Map([[assetFile, assetContent]]));
	expect(mockedReloadAppIcons).toHaveBeenCalledWith(new Map());
		expect(AssetsManager.getAssets()).toEqual(new Map([[assetFile, assetContent]]));
	});
});
