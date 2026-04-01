import {
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest";

// ===== Module mocks =====

vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		isInitialized: vi.fn(() => true)
	}
}));

vi.mock("../../../Discord/src/translations/i18n", () => {
	const mockI18n = {
		t: vi.fn((key: string, opts?: Record<string, unknown>) => {
			if (opts) {
				const {
					lng, ...rest
				} = opts;
				const paramsStr = Object.keys(rest).length > 0 ? `|${JSON.stringify(rest)}` : "";
				return `${key}${paramsStr}`;
			}
			return key;
		}),
		formatDuration: vi.fn((_minutes: number) => "5 minutes")
	};
	return { default: mockI18n };
});

vi.mock("../../../Discord/src/bot/DiscordMQTT", () => ({
	DiscordMQTT: {
		asyncPacketSender: {
			sendPacketAndHandleResponse: vi.fn()
		}
	}
}));

vi.mock("../../../Discord/src/utils/ErrorUtils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../src/utils/ErrorUtils")>();
	return {
		...actual,
		sendInteractionNotForYou: vi.fn(),
		sendErrorMessage: vi.fn(),
		replyEphemeralErrorMessage: vi.fn(),
		handleClassicError: vi.fn()
	};
});

vi.mock("../../../Discord/src/utils/DiscordCollectorUtils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../src/utils/DiscordCollectorUtils")>();
	return {
		...actual,
		DiscordCollectorUtils: {
			...actual.DiscordCollectorUtils,
			sendReaction: vi.fn()
		}
	};
});

// ===== Imports =====

import { homeFeatureRegistry } from "../../src/commands/player/report/home/HomeFeatureRegistry";
import { HomeMenuIds } from "../../src/commands/player/report/home/HomeMenuConstants";
import { getHomeMenu, getHomeSubMenus } from "../../src/commands/player/report/home/HomeMenu";
import { HomeMenuParams } from "../../src/commands/player/report/home/HomeMenuTypes";
import { LANGUAGE } from "../../../Lib/src/Language";
import {
	createGardenData,
	createHomeData,
	createMockContext,
	createMockPacket,
	createMockUser
} from "./homeTestUtils";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { STAY_IN_CITY_ID } from "../../src/commands/player/report/ReportCityMenu";

/**
 * Create mock HomeMenuParams for testing
 */
function createMockHomeMenuParams(overrides?: Partial<{
	homeData: ReturnType<typeof createHomeData>;
}>): HomeMenuParams {
	const homeData = overrides?.homeData ?? createHomeData();
	const user = createMockUser();

	return {
		context: createMockContext(),
		interaction: {
			user,
			userLanguage: LANGUAGE.FRENCH
		} as unknown as HomeMenuParams["interaction"],
		packet: {
			reactions: [],
			data: {
				data: {
					home: {
						owned: homeData
					}
				} as unknown as ReactionCollectorCityData
			}
		} as unknown as HomeMenuParams["packet"],
		collectorTime: 60000,
		pseudo: "TestPlayer"
	};
}

describe("HomeFeatureRegistry", () => {
	it("should have all 5 handlers registered", () => {
		const handlers = homeFeatureRegistry.getHandlers();
		expect(handlers).toHaveLength(5);
	});

	it("should contain upgrade station, bed, chest, garden, cooking handlers", () => {
		const featureIds = homeFeatureRegistry.getHandlers().map(h => h.featureId);
		expect(featureIds).toContain("upgradeStation");
		expect(featureIds).toContain("bed");
		expect(featureIds).toContain(HomeMenuIds.FEATURE_CHEST);
		expect(featureIds).toContain(HomeMenuIds.FEATURE_GARDEN);
		expect(featureIds).toContain(HomeMenuIds.FEATURE_COOKING);
	});

	it("should find handler by feature ID", () => {
		const gardenHandler = homeFeatureRegistry.getHandler(HomeMenuIds.FEATURE_GARDEN);
		expect(gardenHandler).toBeDefined();
		expect(gardenHandler!.featureId).toBe(HomeMenuIds.FEATURE_GARDEN);
	});

	it("should return undefined for unknown feature ID", () => {
		const handler = homeFeatureRegistry.getHandler("nonexistent");
		expect(handler).toBeUndefined();
	});
});

describe("BedFeatureHandler", () => {
	it("should always be available", () => {
		const bedHandler = homeFeatureRegistry.getHandler("bed")!;
		const homeData = createHomeData({ garden: undefined });
		const ctx = {
			context: createMockContext(),
			packet: createMockPacket(),
			homeData,
			lng: LANGUAGE.FRENCH,
			user: createMockUser(),
			pseudo: "TestPlayer",
			collectorTime: 60000
		};
		expect(bedHandler.isAvailable(ctx)).toBe(true);
	});

	it("should return a menu option", () => {
		const bedHandler = homeFeatureRegistry.getHandler("bed")!;
		const homeData = createHomeData({ garden: undefined });
		const ctx = {
			context: createMockContext(),
			packet: createMockPacket(),
			homeData,
			lng: LANGUAGE.FRENCH,
			user: createMockUser(),
			pseudo: "TestPlayer",
			collectorTime: 60000
		};
		const option = bedHandler.getMenuOption(ctx);
		expect(option).not.toBeNull();
		expect(option!.value).toBe("bed");
	});

	it("should have no sub-menu (handleSubMenuSelection returns false)", async () => {
		const bedHandler = homeFeatureRegistry.getHandler("bed")!;
		const homeData = createHomeData({ garden: undefined });
		const ctx = {
			context: createMockContext(),
			packet: createMockPacket(),
			homeData,
			lng: LANGUAGE.FRENCH,
			user: createMockUser(),
			pseudo: "TestPlayer",
			collectorTime: 60000
		};
		const result = await bedHandler.handleSubMenuSelection(
			ctx, "any", {} as never, {} as never
		);
		expect(result).toBe(false);
	});
});

describe("getHomeMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return a V2 container menu", () => {
		const params = createMockHomeMenuParams();
		const menu = getHomeMenu(params);

		// V2 menu should have containers, not embed
		expect(menu).toHaveProperty("containers");
		expect((menu as any).containers).toBeInstanceOf(Array);
		expect((menu as any).containers.length).toBeGreaterThan(0);
	});

	it("should have a createCollector function", () => {
		const params = createMockHomeMenuParams();
		const menu = getHomeMenu(params);

		expect(menu.createCollector).toBeInstanceOf(Function);
	});

	it("should include LEAVE_HOME button in the container", () => {
		const params = createMockHomeMenuParams();
		const menu = getHomeMenu(params);

		// Search for LEAVE_HOME in the container's action rows
		const containers = (menu as any).containers;
		const actionRows = containers.flatMap((c: any) => c.components ?? [])
			.filter((c: any) => c.data?.type === 1);

		const allButtons = actionRows.flatMap((row: any) =>
			(row.components ?? []).map((b: any) => b.data?.custom_id)
		);
		expect(allButtons).toContain(HomeMenuIds.LEAVE_HOME);
	});

	it("should include STAY_IN_CITY button in the container", () => {
		const params = createMockHomeMenuParams();
		const menu = getHomeMenu(params);

		const containers = (menu as any).containers;
		const actionRows = containers.flatMap((c: any) => c.components ?? [])
			.filter((c: any) => c.data?.type === 1);

		const allButtons = actionRows.flatMap((row: any) =>
			(row.components ?? []).map((b: any) => b.data?.custom_id)
		);
		expect(allButtons).toContain(STAY_IN_CITY_ID);
	});

	it("should include feature sections for available features", () => {
		const params = createMockHomeMenuParams();
		const menu = getHomeMenu(params);

		// V2 containers should have sections (type 9) for features
		const containers = (menu as any).containers;
		const sections = containers.flatMap((c: any) => c.components ?? [])
			.filter((c: any) => c.data?.type === 9);

		// At least one feature section should exist (bed is always available)
		expect(sections.length).toBeGreaterThanOrEqual(1);
	});
});

describe("getHomeSubMenus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return a map of sub-menus", () => {
		const params = createMockHomeMenuParams();
		const subMenus = getHomeSubMenus(params);

		expect(subMenus).toBeInstanceOf(Map);
		expect(subMenus.size).toBeGreaterThan(0);
	});

	it("should include garden sub-menu when garden data exists", () => {
		const params = createMockHomeMenuParams();
		const subMenus = getHomeSubMenus(params);

		expect(subMenus.has(HomeMenuIds.GARDEN_MENU)).toBe(true);
	});

	it("should not include garden sub-menu when garden is unavailable", () => {
		const params = createMockHomeMenuParams({
			homeData: createHomeData({ garden: undefined })
		});
		const subMenus = getHomeSubMenus(params);

		expect(subMenus.has(HomeMenuIds.GARDEN_MENU)).toBe(false);
	});

	it("should always include bed sub-menu", () => {
		const params = createMockHomeMenuParams();
		const subMenus = getHomeSubMenus(params);

		// Bed's featureId is "bed", and its menu value is also "bed"
		expect(subMenus.has("bed")).toBe(true);
	});

	it("each sub-menu should have a createCollector function", () => {
		const params = createMockHomeMenuParams();
		const subMenus = getHomeSubMenus(params);

		for (const [, subMenu] of subMenus) {
			expect(subMenu.createCollector).toBeInstanceOf(Function);
		}
	});

	it("legacy sub-menus should include stay-in-city button", () => {
		const params = createMockHomeMenuParams();
		const subMenus = getHomeSubMenus(params);

		for (const [, subMenu] of subMenus) {
			// Check legacy menus (have components property, not containers)
			if ("components" in subMenu && subMenu.components) {
				const allButtons = subMenu.components.flatMap(
					(row: any) => (row.components ?? []).map((b: any) => b.data?.custom_id)
				);
				expect(allButtons).toContain(STAY_IN_CITY_ID);
			}
		}
	});
});
