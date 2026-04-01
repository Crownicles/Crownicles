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

vi.mock("../../../Discord/src/utils/PacketUtils", () => ({
	PacketUtils: {
		sendPacketToBackend: vi.fn()
	}
}));

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

vi.mock("../../../Lib/src/utils/TimeUtils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../Lib/src/utils/TimeUtils")>();
	return {
		...actual,
		finishInTimeDisplay: vi.fn(() => "dans 5 minutes")
	};
});

// ===== Imports =====

import { CookingFeatureHandler } from "../../src/commands/player/report/home/features/CookingFeatureHandler";
import { HomeMenuIds } from "../../src/commands/player/report/home/HomeMenuConstants";
import {
	createHandlerContext,
	createHomeData,
	createMockComponentInteraction,
	createMockNestedMenus,
	createMockPacket
} from "./homeTestUtils";
import { ActionRowBuilder, ContainerBuilder } from "discord.js";
import { DiscordMQTT } from "../../src/bot/DiscordMQTT";
import { PacketUtils } from "../../src/utils/PacketUtils";
import {
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
	CommandReportCookingOverheatRes,
	CommandReportCookingWoodConfirmReq,
	CommandReportCookingReviveRes,
	CommandReportCookingCraftRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { CookingCraftErrors, CookingSlotData } from "../../../Lib/src/types/CookingTypes";
import { CookingOutputType, RecipeType } from "../../../Lib/src/constants/CookingConstants";
import { ReactionCollectorHomeMenuReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { HomeFeatureHandlerContext } from "../../src/commands/player/report/home/HomeMenuTypes";

/**
 * Create home data with cooking configuration.
 */
function createCookingHomeData(cookingSlots = 2): ReturnType<typeof createHomeData> {
	const homeData = createHomeData({ garden: undefined });
	homeData.features.cookingSlots = cookingSlots;
	return homeData;
}

/**
 * Create a sample cooking slot with a recipe
 */
function createSlotWithRecipe(overrides?: Partial<{
	slotIndex: number;
	canCraft: boolean;
	isSecret: boolean;
	recipeId: string;
	level: number;
}>): CookingSlotData {
	return {
		slotIndex: overrides?.slotIndex ?? 0,
		recipe: {
			id: overrides?.recipeId ?? "testRecipe",
			level: overrides?.level ?? 1,
			isSecret: overrides?.isSecret ?? false,
			outputDescription: "A tasty potion",
			outputType: CookingOutputType.POTION,
			recipeType: RecipeType.POTION_HEALTH,
			ingredients: {
				plants: [{ plantId: 1, quantity: 2, playerHas: 3 }],
				materials: [{ materialId: 10, quantity: 1, playerHas: 1 }]
			},
			canCraft: overrides?.canCraft ?? true
		}
	};
}

/**
 * Create an empty cooking slot (no recipe assigned)
 */
function createEmptySlot(slotIndex = 0): CookingSlotData {
	return {
		slotIndex,
		recipe: null
	};
}

/**
 * Helper to simulate sendPacketAndHandleResponse callback invocation
 */
async function simulateMqttResponse(
	packetName: string,
	responsePacket: unknown
): Promise<void> {
	const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;
	const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
	const callback = lastCall[2] as (ctx: unknown, name: string, packet: unknown) => Promise<void>;
	await callback({}, packetName, responsePacket);
}

describe("CookingFeatureHandler", () => {
	let handler: CookingFeatureHandler;

	function getButtonsFromContainer(container: ContainerBuilder): any[] {
		return container.components
			.filter((c): c is ActionRowBuilder<any> => c instanceof ActionRowBuilder)
			.flatMap(row => row.components);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new CookingFeatureHandler();
	});

	describe("featureId", () => {
		it("should be 'cooking'", () => {
			expect(handler.featureId).toBe(HomeMenuIds.FEATURE_COOKING);
		});
	});

	describe("isAvailable", () => {
		it("should return true when cookingSlots > 0", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			expect(handler.isAvailable(ctx)).toBe(true);
		});

		it("should return false when cookingSlots is 0", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(0)
			});
			expect(handler.isAvailable(ctx)).toBe(false);
		});
	});

	describe("getMenuOption", () => {
		it("should return menu option when cooking is available", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const option = handler.getMenuOption(ctx);

			expect(option).not.toBeNull();
			expect(option!.value).toBe(HomeMenuIds.COOKING_MENU);
			expect(option!.label).toContain("commands:report.city.homes.cooking.menuLabel");
		});

		it("should include level and grade in description", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const option = handler.getMenuOption(ctx);

			expect(option).not.toBeNull();
			expect(option!.description).toContain("commands:report.city.homes.cooking.menuDescription");
			expect(option!.description).toContain("level");
		});

		it("should return null when not available", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(0)
			});
			expect(handler.getMenuOption(ctx)).toBeNull();
		});
	});

	describe("getDescriptionLines", () => {
		it("should return description when available", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const lines = handler.getDescriptionLines(ctx);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain("commands:report.city.homes.cooking.available");
		});

		it("should return empty array when not available", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(0)
			});
			expect(handler.getDescriptionLines(ctx)).toEqual([]);
		});
	});

	describe("handleFeatureSelection", () => {
		it("should defer update and register cooking menu", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction();
			const nestedMenus = createMockNestedMenus();

			await handler.handleFeatureSelection(ctx, interaction as any, nestedMenus as any);

			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.COOKING_MENU,
				expect.objectContaining({
					containers: expect.any(Array),
					createCollector: expect.any(Function)
				})
			);
			expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
		});
	});

	describe("handleSubMenuSelection", () => {
		it("should navigate back to home on BACK_TO_HOME", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.BACK_TO_HOME);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, HomeMenuIds.BACK_TO_HOME, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.HOME_MENU);
		});

		it("should send ignite action on COOKING_IGNITE", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).toHaveBeenCalled();
		});

		it("should send revive action on COOKING_REVIVE", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_REVIVE);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_REVIVE, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).toHaveBeenCalled();
		});

		it("should send wood confirm on COOKING_WOOD_CONFIRM", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_WOOD_CONFIRM);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_WOOD_CONFIRM, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).toHaveBeenCalled();
		});

		it("should send wood cancel on COOKING_WOOD_CANCEL and return to cooking menu when no slots", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_WOOD_CANCEL);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_WOOD_CANCEL, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			// Wood cancel is fire-and-forget: uses PacketUtils.sendPacketToBackend
			expect(PacketUtils.sendPacketToBackend).toHaveBeenCalled();
			expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.COOKING_MENU,
				expect.objectContaining({
					containers: expect.any(Array)
				})
			);
			expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
		});

		it("should handle craft selection with COOKING_CRAFT_PREFIX", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
			const interaction = createMockComponentInteraction(craftValue);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalled();
			expect(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).toHaveBeenCalled();
		});

		it("should return false for unknown selection", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction("UNKNOWN_VALUE");
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, "UNKNOWN_VALUE", interaction as any, nestedMenus as any);
			expect(result).toBe(false);
		});

		it("should ignore craft selection with invalid slot index", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}notanumber`;
			const interaction = createMockComponentInteraction(craftValue);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			// No MQTT call since slot index is NaN
			expect(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse).not.toHaveBeenCalled();
		});
	});

	describe("MQTT response handling", () => {
		describe("ignite flow", () => {
			it("should handle successful ignite response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
					slots: [createSlotWithRecipe({ slotIndex: 0 }), createEmptySlot(1)],
					furnaceUsesRemaining: 3,
					cookingGrade: "apprentice",
					cookingLevel: 5,
					woodConsumed: true,
					woodMaterialId: 42
				} as CommandReportCookingIgniteRes);

				// Should register ignited menu with V2 containers
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array),
						createCollector: expect.any(Function)
					})
				);
				expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
			});

			it("should handle no wood response during ignite", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingNoWoodRes.name, {});

				// Should re-register cooking menu (not ignited menu) since no slots yet
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
				expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
			});

			it("should handle overheat response during ignite", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingOverheatRes.name, {
					overheatUntil: Date.now() + 300000
				} as CommandReportCookingOverheatRes);

				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
				expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
			});

			it("should handle wood confirmation request during ignite", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingWoodConfirmReq.name, {
					woodMaterialId: 42,
					woodRarity: 3
				} as CommandReportCookingWoodConfirmReq);

				// Should register wood confirmation menu with containers
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array),
						createCollector: expect.any(Function)
					})
				);
				expect(nestedMenus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.COOKING_MENU);
			});
		});

		describe("revive flow", () => {
			it("should handle successful revive response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_REVIVE);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_REVIVE, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingReviveRes.name, {
					slots: [createSlotWithRecipe({ slotIndex: 0 })],
					furnaceUsesRemaining: 2,
					cookingGrade: "apprentice",
					cookingLevel: 5,
					woodConsumed: false,
					woodMaterialId: 42
				} as CommandReportCookingReviveRes);

				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
			});

			it("should handle no wood response during revive with ignited menu", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});

				// First ignite to set slots
				const igniteInteraction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, igniteInteraction as any, createMockNestedMenus() as any);
				await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
					slots: [createSlotWithRecipe()],
					furnaceUsesRemaining: 3,
					cookingGrade: "apprentice",
					cookingLevel: 5,
					woodConsumed: true,
					woodMaterialId: 42
				} as CommandReportCookingIgniteRes);

				// Then revive with no wood
				vi.clearAllMocks();
				const reviveInteraction = createMockComponentInteraction(HomeMenuIds.COOKING_REVIVE);
				const nestedMenus = createMockNestedMenus();
				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_REVIVE, reviveInteraction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingNoWoodRes.name, {});

				// Since we already had slots, should register ignited menu (with containers)
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
			});
		});

		describe("wood confirm flow", () => {
			it("should send accepted=true and handle ignite response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_WOOD_CONFIRM);
				const nestedMenus = createMockNestedMenus();

				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_WOOD_CONFIRM, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
					slots: [createSlotWithRecipe()],
					furnaceUsesRemaining: 3,
					cookingGrade: "apprentice",
					cookingLevel: 5,
					woodConsumed: true,
					woodMaterialId: 42
				} as CommandReportCookingIgniteRes);

				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
			});

			it("should send accepted=false and return to appropriate menu", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_WOOD_CANCEL);
				const nestedMenus = createMockNestedMenus();

				// No prior slots, so should go back to cooking menu
				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_WOOD_CANCEL, interaction as any, nestedMenus as any);

				expect(PacketUtils.sendPacketToBackend).toHaveBeenCalled();
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
			});

			it("should return to ignited menu when cancelling with existing slots", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});

				// First ignite to set slots
				const igniteInteraction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, igniteInteraction as any, createMockNestedMenus() as any);
				await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
					slots: [createSlotWithRecipe()],
					furnaceUsesRemaining: 3,
					cookingGrade: "apprentice",
					cookingLevel: 5,
					woodConsumed: true,
					woodMaterialId: 42
				} as CommandReportCookingIgniteRes);

				// Then cancel wood
				vi.clearAllMocks();
				const cancelInteraction = createMockComponentInteraction(HomeMenuIds.COOKING_WOOD_CANCEL);
				const nestedMenus = createMockNestedMenus();
				await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_WOOD_CANCEL, cancelInteraction as any, nestedMenus as any);

				// Should register ignited menu since we have slots
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
			});
		});

		describe("craft flow", () => {
			it("should send craft request with correct slot index", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2)
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}1`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined),
					createMessageComponentCollector: vi.fn().mockReturnValue({
						on: vi.fn().mockReturnThis()
					})
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;
				expect(sendMock).toHaveBeenCalled();
				// Verify the packet has slotIndex = 1
				const packetArg = sendMock.mock.calls[0][1];
				expect(packetArg).toHaveProperty("slotIndex", 1);
			});

			it("should handle craft success response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "testRecipe",
					cookingXpGained: 10,
					outputType: CookingOutputType.POTION,
					cookingLevelUp: false,
					updatedSlots: [createEmptySlot(0)],
					furnaceUsesRemaining: 2
				} as CommandReportCookingCraftRes);

				// Should register ignited menu with allDisabled=true
				expect(nestedMenus.registerMenu).toHaveBeenCalledWith(
					HomeMenuIds.COOKING_MENU,
					expect.objectContaining({
						containers: expect.any(Array)
					})
				);
				// Should send followup via message.reply
				expect(nestedMenus.message.reply).toHaveBeenCalled();
			});

			it("should handle craft error response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					error: CookingCraftErrors.INVENTORY_FULL,
					recipeId: "testRecipe",
					cookingXpGained: 0,
					success: false,
					cookingLevelUp: false
				} as CommandReportCookingCraftRes);

				expect(nestedMenus.message.reply).toHaveBeenCalled();
				const replyContent = (nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(replyContent.content).toContain("inventoryFull");
			});

			it("should handle craft with level up and grade change", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "testRecipe",
					cookingXpGained: 50,
					outputType: CookingOutputType.MATERIAL,
					material: { materialId: 5, quantity: 3 },
					cookingLevelUp: true,
					newCookingLevel: 10,
					newCookingGrade: "expert",
					updatedSlots: [createSlotWithRecipe()],
					furnaceUsesRemaining: 2
				} as CommandReportCookingCraftRes);

				// Should send two replies: craft result + level up embed
				expect(nestedMenus.message.reply).toHaveBeenCalledTimes(2);
			});

			it("should handle craft with pet food output", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "testRecipe",
					cookingXpGained: 15,
					outputType: CookingOutputType.PET_FOOD,
					petFood: {
						type: "kibble",
						storedQuantity: 2,
						fedFromSurplus: false
					},
					cookingLevelUp: false,
					updatedSlots: [createEmptySlot(0)],
					furnaceUsesRemaining: 1
				} as CommandReportCookingCraftRes);

				expect(nestedMenus.message.reply).toHaveBeenCalled();
				const replyContent = (nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(replyContent.content).toContain("petFoodStored");
			});

			it("should prevent double craft when craftPending is true", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				// Simulate the MQTT call not resolving immediately (stays pending)
				const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;
				let resolveFirst!: () => void;
				sendMock.mockImplementationOnce(() => new Promise<void>(resolve => { resolveFirst = resolve; }));

				// Fire first craft (stays pending)
				const firstCraft = handler.handleSubMenuSelection(
					ctx,
					craftValue,
					createMockComponentInteraction(craftValue) as any,
					nestedMenus as any
				);

				// Fire second craft immediately
				const result = await handler.handleSubMenuSelection(
					ctx,
					craftValue,
					createMockComponentInteraction(craftValue) as any,
					nestedMenus as any
				);

				// Second should be ignored (return true but no new MQTT call)
				expect(result).toBe(true);
				expect(sendMock).toHaveBeenCalledTimes(1);

				// Resolve the first one to avoid dangling promise
				resolveFirst();
				await firstCraft;
			});
		});
	});

	describe("addSubMenuContainerContent", () => {
		it("should add buttons including ignite and back to container", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const buttons = getButtonsFromContainer(container);
			expect(buttons.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("getSubMenuDescription", () => {
		it("should include cooking slot count", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(3)
			});
			const desc = handler.getSubMenuDescription(ctx);
			expect(desc).toContain("commands:report.city.homes.cooking.description");
			expect(desc).toContain("3");
		});
	});

	describe("getSubMenuTitle", () => {
		it("should include pseudo", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const title = handler.getSubMenuTitle(ctx, "TestPlayer");
			expect(title).toContain("commands:report.city.homes.cooking.title");
		});
	});

	describe("session state management", () => {
		it("should create fresh state for new user", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			// getMenuOption accesses state (cookingLevel, cookingGrade)
			const option = handler.getMenuOption(ctx);
			expect(option).not.toBeNull();
			// Default level is 0
			expect(option!.description).toContain('"level":0');
		});

		it("should update state after ignite response", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
			const nestedMenus = createMockNestedMenus();

			await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

			await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
				slots: [createSlotWithRecipe({ slotIndex: 0 })],
				furnaceUsesRemaining: 5,
				cookingGrade: "master",
				cookingLevel: 20,
				woodConsumed: true,
				woodMaterialId: 1
			} as CommandReportCookingIgniteRes);

			// Now check state via getMenuOption
			const option = handler.getMenuOption(ctx);
			expect(option!.description).toContain('"level":20');
		});
	});
});
