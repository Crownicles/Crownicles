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

// ===== Imports =====

import { ChestFeatureHandler } from "../../src/commands/player/report/home/features/ChestFeatureHandler";
import { HomeMenuIds } from "../../src/commands/player/report/home/HomeMenuConstants";
import {
	createHandlerContext,
	createHomeData,
	createMockComponentInteraction,
	createMockNestedMenus
} from "./homeTestUtils";
import { DiscordMQTT } from "../../src/bot/DiscordMQTT";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import {
	ActionRowBuilder, ContainerBuilder
} from "discord.js";

/**
 * Create home data with chest configuration.
 * chestSlots sets both features.chestSlots (for availability) and chest.slotsPerCategory
 */
function createChestHomeData(options?: {
	chestSlots?: { weapon: number; armor: number; object: number; potion: number };
	chestItems?: { slot: number; category: ItemCategory; details: any }[];
	depositableItems?: { slot: number; category: ItemCategory; details: any }[];
	plantStorage?: { plantId: number; quantity: number; maxCapacity: number }[];
	playerPlantSlots?: { slot: number; plantId: number }[];
	plantMaxCapacity?: number;
}): ReturnType<typeof createHomeData> {
	const slots = options?.chestSlots ?? {
		weapon: 1, armor: 1, object: 1, potion: 1
	};
	const homeData = createHomeData({
		garden: undefined,
		chest: {
			chestItems: options?.chestItems ?? [],
			depositableItems: options?.depositableItems ?? [],
			slotsPerCategory: slots,
			inventoryCapacity: {
				weapon: 5, armor: 5, object: 5, potion: 5
			},
			plantStorage: options?.plantStorage,
			playerPlantSlots: options?.playerPlantSlots,
			plantMaxCapacity: options?.plantMaxCapacity
		} as any
	});
	// Override features.chestSlots to match chest.slotsPerCategory
	homeData.features.chestSlots = slots;
	return homeData;
}

describe("ChestFeatureHandler", () => {
	let handler: ChestFeatureHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new ChestFeatureHandler();
	});

	describe("featureId", () => {
		it("should be 'chest'", () => {
			expect(handler.featureId).toBe(HomeMenuIds.FEATURE_CHEST);
		});
	});

	describe("isAvailable", () => {
		it("should return true when chest slots exist", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData()
			});
			expect(handler.isAvailable(ctx)).toBe(true);
		});

		it("should return false when no chest slots exist", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: {
						weapon: 0, armor: 0, object: 0, potion: 0
					}
				})
			});
			expect(handler.isAvailable(ctx)).toBe(false);
		});
	});

	describe("getMenuOption", () => {
		it("should return menu option when chest is available", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData()
			});
			const option = handler.getMenuOption(ctx);

			expect(option).not.toBeNull();
			expect(option!.value).toBe(HomeMenuIds.CHEST_MENU);
		});

		it("should show filled/total slot count", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestItems: [
						{
							slot: 0,
							category: ItemCategory.WEAPON,
							details: {
								itemId: 1, attack: 10, defense: 0, speed: 0, level: 1
							}
						}
					],
					chestSlots: {
						weapon: 2, armor: 1, object: 1, potion: 1
					}
				})
			});
			const option = handler.getMenuOption(ctx);
			expect(option).not.toBeNull();
			expect(option!.description).toContain('"filled":1');
			expect(option!.description).toContain('"total":5');
		});

		it("should return null when no chest slots", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: {
						weapon: 0, armor: 0, object: 0, potion: 0
					}
				})
			});
			const option = handler.getMenuOption(ctx);
			expect(option).toBeNull();
		});
	});

	describe("getDescriptionLines", () => {
		it("should return description when available", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData()
			});
			const lines = handler.getDescriptionLines(ctx);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain("commands:report.city.homes.chest.available");
		});

		it("should return empty array when not available", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: {
						weapon: 0, armor: 0, object: 0, potion: 0
					}
				})
			});
			const lines = handler.getDescriptionLines(ctx);
			expect(lines).toHaveLength(0);
		});
	});

	describe("handleFeatureSelection", () => {
		it("should defer update and navigate to chest menu", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData()
			});
			const interaction = createMockComponentInteraction();
			const menus = createMockNestedMenus();

			await handler.handleFeatureSelection(ctx, interaction as never, menus as never);

			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.CHEST_MENU);
		});
	});

	describe("handleSubMenuSelection - navigation", () => {
		it("should handle BACK_TO_HOME", async () => {
			const ctx = createHandlerContext({ homeData: createChestHomeData() });
			const interaction = createMockComponentInteraction(HomeMenuIds.BACK_TO_HOME);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.BACK_TO_HOME, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.HOME_MENU);
		});

		it("should handle CHEST_BACK_TO_CATEGORIES", async () => {
			const ctx = createHandlerContext({ homeData: createChestHomeData() });
			const interaction = createMockComponentInteraction(HomeMenuIds.CHEST_BACK_TO_CATEGORIES);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.CHEST_BACK_TO_CATEGORIES, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.CHEST_MENU);
		});

		it("should handle BACK_TO_DETAIL_PREFIX", async () => {
			const ctx = createHandlerContext({ homeData: createChestHomeData() });
			const value = `${HomeMenuIds.CHEST_BACK_TO_DETAIL_PREFIX}2`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(menus.changeMenu).toHaveBeenCalledWith(`${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}2`);
		});

		it("should handle CHEST_PLANT_TAB navigation", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					plantStorage: [{ plantId: 1, quantity: 2, maxCapacity: 10 }],
					playerPlantSlots: [{ slot: 0, plantId: 3 }],
					plantMaxCapacity: 10
				})
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.CHEST_PLANT_TAB);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.CHEST_PLANT_TAB, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.registerMenu).toHaveBeenCalled();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.CHEST_PLANT_TAB);
		});

		it("should handle plant pagination", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					plantStorage: [{ plantId: 1, quantity: 2, maxCapacity: 10 }],
					playerPlantSlots: [],
					plantMaxCapacity: 10
				})
			});
			const value = `${HomeMenuIds.CHEST_PLANT_PAGE_PREFIX}2`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(menus.registerMenu).toHaveBeenCalled();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.CHEST_PLANT_TAB);
		});

		it("should return false for unknown values", async () => {
			const ctx = createHandlerContext({ homeData: createChestHomeData() });
			const interaction = createMockComponentInteraction("UNKNOWN");
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, "UNKNOWN", interaction as never, menus as never
			);

			expect(handled).toBe(false);
		});
	});

	describe("handleSubMenuSelection - category detail", () => {
		it("should handle CHEST_CATEGORY_PREFIX to show category detail", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestItems: [
						{
							slot: 0,
							category: ItemCategory.WEAPON,
							details: {
								itemId: 1, attack: 10, defense: 0, speed: 0, level: 1
							}
						}
					],
					depositableItems: [
						{
							slot: 0,
							category: ItemCategory.WEAPON,
							details: {
								itemId: 2, attack: 15, defense: 0, speed: 0, level: 1
							}
						}
					]
				})
			});
			const value = `${HomeMenuIds.CHEST_CATEGORY_PREFIX}${ItemCategory.WEAPON}`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.registerMenu).toHaveBeenCalled();
			// Should register a category detail menu
			const menuId = menus.registerMenu.mock.calls[0][0];
			expect(menuId).toContain(HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX);
		});
	});

	describe("handleSubMenuSelection - MQTT actions", () => {
		it("should send deposit MQTT packet", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: { weapon: 2, armor: 0, object: 0, potion: 0 },
					depositableItems: [{
						slot: 0,
						category: ItemCategory.WEAPON,
						details: {
							itemId: 1, attack: 10, defense: 0, speed: 0, level: 1
						}
					}]
				})
			});
			const value = `${HomeMenuIds.CHEST_DEPOSIT_PREFIX}${ItemCategory.WEAPON}_0`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockResolvedValue(undefined);

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(mockSendPacket).toHaveBeenCalledOnce();
		});

		it("should send withdraw MQTT packet", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: { weapon: 2, armor: 0, object: 0, potion: 0 },
					chestItems: [{
						slot: 0,
						category: ItemCategory.WEAPON,
						details: {
							itemId: 1, attack: 10, defense: 0, speed: 0, level: 1
						}
					}]
				})
			});
			const value = `${HomeMenuIds.CHEST_WITHDRAW_PREFIX}${ItemCategory.WEAPON}_0`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockResolvedValue(undefined);

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(mockSendPacket).toHaveBeenCalledOnce();
		});

		it("should send plant deposit MQTT packet", async () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					plantStorage: [{ plantId: 1, quantity: 2, maxCapacity: 10 }],
					playerPlantSlots: [{ slot: 0, plantId: 1 }],
					plantMaxCapacity: 10
				})
			});
			const value = `${HomeMenuIds.CHEST_PLANT_DEPOSIT_PREFIX}1_0`;
			const interaction = createMockComponentInteraction(value);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockResolvedValue(undefined);

			const handled = await handler.handleSubMenuSelection(
				ctx, value, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(mockSendPacket).toHaveBeenCalledOnce();
		});
	});

	describe("addSubMenuContainerContent", () => {
		function getButtonsFromContainer(container: ContainerBuilder): any[] {
			return container.components
				.filter((c): c is ActionRowBuilder<any> => c instanceof ActionRowBuilder)
				.flatMap(row => row.components);
		}

		it("should include category buttons for available categories", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					chestSlots: {
						weapon: 1, armor: 1, object: 0, potion: 0
					}
				})
			});
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			// Should have category buttons + back button
			expect(allButtons.length).toBeGreaterThanOrEqual(2);
		});

		it("should include back button", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData()
			});
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const backButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.BACK_TO_HOME
			);
			expect(backButton).toBeDefined();
		});

		it("should include plant tab button when plant storage exists", () => {
			const ctx = createHandlerContext({
				homeData: createChestHomeData({
					plantStorage: [{ plantId: 1, quantity: 3, maxCapacity: 10 }],
					plantMaxCapacity: 10
				})
			});
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const plantButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.CHEST_PLANT_TAB
			);
			expect(plantButton).toBeDefined();
		});
	});
});
