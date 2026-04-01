/**
 * Shared test utilities for home feature handler tests.
 * Provides mock factories for HomeFeatureHandlerContext, Discord interactions,
 * and CrowniclesNestedMenus.
 */
import { vi } from "vitest";
import { HomeFeatureHandlerContext } from "../../src/commands/player/report/home/HomeMenuTypes";
import { GardenEarthQuality } from "../../../Lib/src/types/GardenEarthQuality";
import { LANGUAGE } from "../../../Lib/src/Language";

/**
 * Create a mock Discord User object
 */
export function createMockUser(id = "test-user-123"): HomeFeatureHandlerContext["user"] {
	return {
		id,
		displayAvatarURL: vi.fn().mockReturnValue("https://cdn.discordapp.com/avatars/test.png")
	} as unknown as HomeFeatureHandlerContext["user"];
}

/**
 * Create a mock ComponentInteraction (button or select menu)
 */
export function createMockComponentInteraction(customId = "test", userId = "test-user-123"): {
	customId: string;
	user: { id: string };
	deferUpdate: ReturnType<typeof vi.fn>;
	deferReply: ReturnType<typeof vi.fn>;
	isButton: ReturnType<typeof vi.fn>;
	isStringSelectMenu: ReturnType<typeof vi.fn>;
	values: string[];
} {
	return {
		customId,
		user: { id: userId },
		deferUpdate: vi.fn().mockResolvedValue(undefined),
		deferReply: vi.fn().mockResolvedValue(undefined),
		isButton: vi.fn().mockReturnValue(true),
		isStringSelectMenu: vi.fn().mockReturnValue(false),
		values: []
	};
}

/**
 * Create a mock CrowniclesNestedMenus
 */
export function createMockNestedMenus(): {
	changeMenu: ReturnType<typeof vi.fn>;
	changeToMainMenu: ReturnType<typeof vi.fn>;
	registerMenu: ReturnType<typeof vi.fn>;
	stopCurrentCollector: ReturnType<typeof vi.fn>;
} {
	return {
		changeMenu: vi.fn().mockResolvedValue(undefined),
		changeToMainMenu: vi.fn().mockResolvedValue(undefined),
		registerMenu: vi.fn(),
		stopCurrentCollector: vi.fn().mockResolvedValue(undefined)
	};
}

/**
 * Create a mock ReactionCollectorCreationPacket
 */
export function createMockPacket(reactions: { type: string }[] = []): HomeFeatureHandlerContext["packet"] {
	return {
		reactions,
		data: {
			data: {}
		}
	} as unknown as HomeFeatureHandlerContext["packet"];
}

/**
 * Create a mock PacketContext
 */
export function createMockContext(): HomeFeatureHandlerContext["context"] {
	return {
		keycloakId: "test-keycloak-id"
	} as unknown as HomeFeatureHandlerContext["context"];
}

/**
 * Default garden data for tests
 */
export function createGardenData(overrides?: Partial<{
	plots: {
		slot: number;
		plantId: number;
		growthProgress: number;
		isReady: boolean;
		remainingSeconds: number;
	}[];
	plantStorage: { plantId: number; quantity: number; maxCapacity: number }[];
	hasSeed: boolean;
	seedPlantId: number;
	totalPlots: number;
}>): NonNullable<HomeFeatureHandlerContext["homeData"]["garden"]> {
	return {
		plots: overrides?.plots ?? [
			{
				slot: 0, plantId: 1, growthProgress: 1, isReady: true, remainingSeconds: 0
			},
			{
				slot: 1, plantId: 0, growthProgress: 0, isReady: false, remainingSeconds: 0
			}
		],
		plantStorage: overrides?.plantStorage ?? [
			{ plantId: 1, quantity: 3, maxCapacity: 10 }
		],
		hasSeed: overrides?.hasSeed ?? true,
		seedPlantId: overrides?.seedPlantId ?? 2,
		totalPlots: overrides?.totalPlots ?? 2
	};
}

/**
 * Default home data for tests
 */
export function createHomeData(options?: {
	garden?: ReturnType<typeof createGardenData> | undefined;
	chest?: HomeFeatureHandlerContext["homeData"]["chest"];
	upgradeStation?: HomeFeatureHandlerContext["homeData"]["upgradeStation"];
}): HomeFeatureHandlerContext["homeData"] {
	return {
		level: 3,
		features: {
			bedHealthRegeneration: 10,
			gardenEarthQuality: GardenEarthQuality.RICH,
			gardenPlots: 2,
			chestSlots: { weapon: 1, armor: 1, object: 1, potion: 1 },
			hasUpgradeStation: true,
			cookingSlots: 0
		},
		garden: options && "garden" in options ? options.garden : createGardenData(),
		chest: options?.chest,
		upgradeStation: options?.upgradeStation
	} as unknown as HomeFeatureHandlerContext["homeData"];
}

/**
 * Build a complete HomeFeatureHandlerContext for testing
 */
export function createHandlerContext(overrides?: Partial<{
	homeData: HomeFeatureHandlerContext["homeData"];
	lng: typeof LANGUAGE[keyof typeof LANGUAGE];
	collectorTime: number;
	user: HomeFeatureHandlerContext["user"];
	packet: HomeFeatureHandlerContext["packet"];
}>): HomeFeatureHandlerContext {
	const user = overrides?.user ?? createMockUser();
	return {
		context: createMockContext(),
		packet: overrides?.packet ?? createMockPacket(),
		homeData: overrides?.homeData ?? createHomeData(),
		lng: overrides?.lng ?? LANGUAGE.FRENCH,
		user,
		pseudo: "TestPlayer",
		collectorTime: overrides?.collectorTime ?? 60000
	};
}
