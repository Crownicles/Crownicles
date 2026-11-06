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
		},
		packetListener: {
			getListener: vi.fn()
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
			...(await import("../mocks/DiscordCollectorUtilsMock")).collectorAcknowledgementMocks,
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
	CommandReportCookingWoodConfirmReq,
	CommandReportCookingReviveRes,
	CommandReportCookingCraftRes,
	CommandReportCookingMenuReq,
	CommandReportCookingMenuRes,
	CommandReportCookingSetSpecialtyReq,
	CommandReportCookingSetSpecialtyRes,
	CommandReportCookingRemoveSpecialtyReq
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CookingCraftErrors, CookingSlotData, CookingSpecialtyErrors
} from "../../../Lib/src/types/CookingTypes";
import {
	CookingOutputType, CookingSpecialtyConstants, RecipeType, SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
} from "../../../Lib/src/constants/CookingConstants";
import { ReactionCollectorHomeMenuReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorRefuseReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { HomeFeatureHandlerContext } from "../../src/commands/player/report/home/HomeMenuTypes";

// Cooking level unlocking every specialty, and the one before the first specialty
const ALL_SPECIALTIES_LEVEL = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1];
const BEFORE_SPECIALTIES_LEVEL = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0] - 1;

/**
 * Create home data with cooking configuration.
 */
function createCookingHomeData(cookingSlots = 2, cookingLevel = 5): ReturnType<typeof createHomeData> {
	const homeData = createHomeData({
		garden: undefined,
		cookingLevel
	});
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

			await simulateMqttResponse(CommandReportCookingMenuRes.name, {
				menu: {
					cookingLevel: 5,
					cookingGrade: "apprentice",
					currentSlots: [],
					isIgnited: false
				}
			} as CommandReportCookingMenuRes);

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
			const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
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

		it("should refresh the menu for a legacy craft button without a recipe ID", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0`;
			const interaction = createMockComponentInteraction(craftValue);
			const nestedMenus = createMockNestedMenus();

			const result = await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

			expect(result).toBe(true);
			const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;
			expect(sendMock.mock.calls[0][1]).toBeInstanceOf(CommandReportCookingMenuReq);
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe({ slotIndex: 0 }), createEmptySlot(1)],
						isIgnited: true
					},
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe({ slotIndex: 0 })],
						isIgnited: true
					},
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe()],
						isIgnited: true
					},
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe()],
						isIgnited: true
					},
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe()],
						isIgnited: true
					},
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
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}1:test_recipe`;
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
				// The request remains bound to the recipe rendered in the button.
				const packetArg = sendMock.mock.calls[0][1];
				expect(packetArg).toHaveProperty("slotIndex", 1);
				expect(packetArg).toHaveProperty("recipeId", "test_recipe");
			});

			it("should ignore a second craft click until the first craft is answered", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;
				const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;
				sendMock.mockResolvedValue(undefined);

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				expect(sendMock).toHaveBeenCalledTimes(1);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "test_recipe",
					cookingXpGained: 50,
					outputType: CookingOutputType.POTION,
					cookingLevelUp: true,
					newCookingLevel: 11,
					newCookingGrade: "scullion",
					menu: {
						cookingLevel: 11,
						cookingGrade: "scullion",
						currentSlots: [createSlotWithRecipe({ recipeId: "other_recipe" })],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				// Craft result then level up embed: no stale second craft answered with "craftUnavailable"
				expect(nestedMenus.message.reply).toHaveBeenCalledTimes(2);
				expect((nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[1][0]).toHaveProperty("embeds");

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				expect(sendMock).toHaveBeenCalledTimes(2);
			});

			it("should handle craft success response", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createEmptySlot(0)],
						isIgnited: true
					}
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

			it("should keep the furnace usable with refreshed recipes when a craft is refused", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorRefuseReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const interaction = createMockComponentInteraction(craftValue);
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, interaction as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					error: CookingCraftErrors.CRAFT_UNAVAILABLE,
					recipeId: "testRecipe",
					cookingXpGained: 0,
					success: false,
					cookingLevelUp: false,
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe({ recipeId: "refreshed_recipe" })],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				const registeredMenu = (nestedMenus.registerMenu as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
				const renderedMenu = JSON.stringify(registeredMenu.containers[0].toJSON());
				expect(registeredMenu.createCollector).toEqual(expect.any(Function));
				expect(renderedMenu).toContain("craftUnavailable");
				expect(renderedMenu).toContain("refreshed_recipe");
				expect(nestedMenus.message.reply).not.toHaveBeenCalled();
				expect(DiscordCollectorUtils.sendReaction).not.toHaveBeenCalled();
			});

			it("should ignore a stale craft click while the answered menu is still being displayed", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorRefuseReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const nestedMenus = createMockNestedMenus();
				let finishMenuEdit!: () => void;
				(nestedMenus.changeMenu as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise<void>(resolve => {
					finishMenuEdit = resolve;
				}));
				const sendMock = DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>;

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				const answerHandled = simulateMqttResponse(CommandReportCookingCraftRes.name, {
					error: CookingCraftErrors.CRAFT_UNAVAILABLE,
					recipeId: "testRecipe",
					cookingXpGained: 0,
					success: false,
					cookingLevelUp: false,
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createSlotWithRecipe()],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				expect(sendMock).toHaveBeenCalledTimes(1);

				finishMenuEdit();
				await answerHandled;
				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				expect(sendMock).toHaveBeenCalledTimes(2);
			});

			it("should show an unexpected answer instead of swallowing it and close the furnace", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorRefuseReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const nestedMenus = createMockNestedMenus();
				const errorListener = vi.fn().mockResolvedValue(undefined);
				(DiscordMQTT.packetListener.getListener as ReturnType<typeof vi.fn>).mockReturnValue(errorListener);

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);
				await simulateMqttResponse("ErrorInternalPacket", { reason: "boom" });

				expect(DiscordMQTT.packetListener.getListener).toHaveBeenCalledWith("ErrorInternalPacket");
				expect(errorListener).toHaveBeenCalledOnce();
				const registeredMenu = (nestedMenus.registerMenu as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1];
				expect(registeredMenu.createCollector).toBeUndefined();
				expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalled();
			});

			it("should handle craft with level up and grade change", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
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
					menu: {
						cookingLevel: 10,
						cookingGrade: "expert",
						currentSlots: [createSlotWithRecipe()],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				// Should send two replies: craft result + level up embed
				expect(nestedMenus.message.reply).toHaveBeenCalledTimes(2);
			});

			it("should handle craft with pet food output", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
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
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createEmptySlot(0)],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				expect(nestedMenus.message.reply).toHaveBeenCalled();
				const replyContent = (nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(replyContent.content).toContain("petFoodStored");
				expect(replyContent.content).not.toContain("masterChefBadgeEarned");
			});

			it("should pluralize the stored pet food by quantity and name a single ration when the pet is fed", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "testRecipe",
					cookingXpGained: 15,
					outputType: CookingOutputType.PET_FOOD,
					petFood: {
						type: "carnivorousFood",
						storedQuantity: 3,
						fedFromSurplus: true
					},
					cookingLevelUp: false,
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createEmptySlot(0)],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				const replyContent = (nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(replyContent.content).toContain(`petFoodStored|${JSON.stringify({
					count: 3,
					food: `models:foods.carnivorousFood|${JSON.stringify({ count: 3 })}`
				})}`);
				expect(replyContent.content).toContain(`petFedFromSurplus|${JSON.stringify({
					food: `models:foods.carnivorousFood|${JSON.stringify({ count: 1 })}`
				})}`);
			});

			it("should announce the master chef badge in the craft result", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
				const nestedMenus = createMockNestedMenus();
				nestedMenus.message = {
					reply: vi.fn().mockResolvedValue(undefined)
				} as any;

				await handler.handleSubMenuSelection(ctx, craftValue, createMockComponentInteraction(craftValue) as any, nestedMenus as any);

				await simulateMqttResponse(CommandReportCookingCraftRes.name, {
					success: true,
					recipeId: "testRecipe",
					cookingXpGained: 10,
					outputType: CookingOutputType.POTION,
					cookingLevelUp: false,
					masterChefBadgeEarned: true,
					menu: {
						cookingLevel: 5,
						cookingGrade: "apprentice",
						currentSlots: [createEmptySlot(0)],
						isIgnited: true
					}
				} as CommandReportCookingCraftRes);

				expect(nestedMenus.message.reply).toHaveBeenCalledOnce();
				const replyContent = (nestedMenus.message.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(replyContent.content).toContain("masterChefBadgeEarned");
			});

			it("should prevent double craft when craftPending is true", async () => {
				const ctx = createHandlerContext({
					homeData: createCookingHomeData(2),
					packet: createMockPacket([{ type: ReactionCollectorHomeMenuReaction.name }]) as HomeFeatureHandlerContext["packet"]
				});
				const craftValue = `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:test_recipe`;
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
		it("should initialize the menu option with the player's cooking level", () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2, 14)
			});
			const option = handler.getMenuOption(ctx);
			expect(option).not.toBeNull();
			expect(option!.description).toContain('"level":14');
		});

		it("should update state after ignite response", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE);
			const nestedMenus = createMockNestedMenus();

			await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, interaction as any, nestedMenus as any);

			await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
				menu: {
					cookingLevel: 20,
					cookingGrade: "master",
					currentSlots: [createSlotWithRecipe({ slotIndex: 0 })],
					isIgnited: true
				},
				woodConsumed: true,
				woodMaterialId: 1
			} as CommandReportCookingIgniteRes);

			// Now check state via getMenuOption
			const option = handler.getMenuOption(ctx);
			expect(option!.description).toContain('"level":20');
		});

		it("should bind each rendered craft button to its recipe ID", async () => {
			const ctx = createHandlerContext({
				homeData: createCookingHomeData(2)
			});
			const nestedMenus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx,
				HomeMenuIds.COOKING_IGNITE,
				createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE) as any,
				nestedMenus as any
			);
			await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
				menu: {
					cookingLevel: 5,
					cookingGrade: "apprentice",
					currentSlots: [createSlotWithRecipe({
						slotIndex: 0,
						recipeId: "testRecipe"
					})],
					isIgnited: true
				},
				woodConsumed: true,
				woodMaterialId: 1
			} as CommandReportCookingIgniteRes);

			const menuOptions = (nestedMenus.registerMenu as ReturnType<typeof vi.fn>).mock.calls[0][1];
			expect(JSON.stringify(menuOptions.containers)).toContain(`${HomeMenuIds.COOKING_CRAFT_PREFIX}0:testRecipe`);
		});
	});

	describe("master chef specialties and time potion weekly limit", () => {
		type RenderedComponent = Record<string, unknown> & { components?: RenderedComponent[]; accessory?: RenderedComponent };

		function lastRenderedMenu(nestedMenus: ReturnType<typeof createMockNestedMenus>): RenderedComponent {
			const calls = (nestedMenus.registerMenu as ReturnType<typeof vi.fn>).mock.calls;
			return calls[calls.length - 1][1].containers[0].toJSON() as RenderedComponent;
		}

		function findComponent(component: RenderedComponent, predicate: (candidate: RenderedComponent) => boolean): RenderedComponent | undefined {
			if (predicate(component)) {
				return component;
			}
			for (const child of [...component.components ?? [], ...component.accessory ? [component.accessory] : []]) {
				const found = findComponent(child, predicate);
				if (found) {
					return found;
				}
			}
			return undefined;
		}

		function lastSentPacket(): unknown {
			const calls = (DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse as ReturnType<typeof vi.fn>).mock.calls;
			return calls[calls.length - 1][1];
		}

		async function ignite(ctx: HomeFeatureHandlerContext, menu: Partial<CommandReportCookingIgniteRes["menu"]>): Promise<ReturnType<typeof createMockNestedMenus>> {
			const nestedMenus = createMockNestedMenus();
			await handler.handleSubMenuSelection(ctx, HomeMenuIds.COOKING_IGNITE, createMockComponentInteraction(HomeMenuIds.COOKING_IGNITE) as any, nestedMenus as any);
			await simulateMqttResponse(CommandReportCookingIgniteRes.name, {
				menu: {
					cookingLevel: ALL_SPECIALTIES_LEVEL,
					cookingGrade: "royalGrandChef",
					currentSlots: [],
					isIgnited: true,
					...menu
				},
				woodConsumed: true,
				woodMaterialId: 1
			} as CommandReportCookingIgniteRes);
			return nestedMenus;
		}

		it("should offer the visible recipes of the ignited furnace as specialties and send the chosen slot and recipe", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = await ignite(ctx, {
				currentSlots: [
					createSlotWithRecipe({ slotIndex: 0, recipeId: "visibleRecipe" }),
					createSlotWithRecipe({ slotIndex: 1, recipeId: "secretRecipe", isSecret: true })
				]
			});

			const rendered = JSON.stringify(lastRenderedMenu(nestedMenus));
			expect(rendered).toContain(HomeMenuIds.COOKING_SPECIALTY_SELECT);
			expect(rendered).toContain(`${HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX}0:visibleRecipe`);
			expect(rendered).not.toContain(`${HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX}1:secretRecipe`);

			const setValue = `${HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX}0:visibleRecipe`;
			await handler.handleSubMenuSelection(ctx, setValue, createMockComponentInteraction(setValue) as any, nestedMenus as any);
			expect(lastSentPacket()).toBeInstanceOf(CommandReportCookingSetSpecialtyReq);
			expect(lastSentPacket()).toMatchObject({ slotIndex: 0, recipeId: "visibleRecipe" });

			await simulateMqttResponse(CommandReportCookingSetSpecialtyRes.name, {
				error: CookingSpecialtyErrors.LIMIT_REACHED,
				menu: {
					cookingLevel: ALL_SPECIALTIES_LEVEL,
					cookingGrade: "royalGrandChef",
					currentSlots: [createSlotWithRecipe({ slotIndex: 0, recipeId: "visibleRecipe" })],
					isIgnited: true
				}
			});
			expect(JSON.stringify(lastRenderedMenu(nestedMenus))).toContain(`commands:report.city.homes.cooking.${CookingSpecialtyErrors.LIMIT_REACHED}`);
		});

		it("should only offer the recipes of the rotating stations as new specialties", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(5, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = await ignite(ctx, {
				currentSlots: [
					createSlotWithRecipe({ slotIndex: 0, recipeId: "rotatingRecipe" }),
					createSlotWithRecipe({ slotIndex: SPECIALTY_SLOT_INDEX, recipeId: "specialtyRecipe" })
				],
				specialties: [{
					recipeId: "specialtyRecipe", level: 1, recipeType: RecipeType.POTION_HEALTH, canCraft: true
				}]
			});

			const rendered = JSON.stringify(lastRenderedMenu(nestedMenus));
			expect(rendered).toContain(`${HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX}0:rotatingRecipe`);
			expect(rendered).not.toContain(`${HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX}${SPECIALTY_SLOT_INDEX}:specialtyRecipe`);
		});

		it("should tell which specialty the specialty station offers when several cycle on it", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const specialties = ["firstSpecialty", "secondSpecialty", "thirdSpecialty"].map(recipeId => ({
				recipeId, level: 1, recipeType: RecipeType.POTION_HEALTH, canCraft: true
			}));
			const nestedMenus = await ignite(ctx, {
				currentSlots: [createSlotWithRecipe({ slotIndex: SPECIALTY_SLOT_INDEX, recipeId: "secondSpecialty" })],
				specialties
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus)))
				.toContain(JSON.stringify("commands:report.city.homes.cooking.specialtyRotation|{\"current\":2,\"total\":3}").slice(1, -1));
		});

		it("should not mention any rotation with a single specialty", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = await ignite(ctx, {
				currentSlots: [createSlotWithRecipe({ slotIndex: SPECIALTY_SLOT_INDEX, recipeId: "onlySpecialty" })],
				specialties: [{
					recipeId: "onlySpecialty", level: 1, recipeType: RecipeType.POTION_HEALTH, canCraft: true
				}]
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus))).not.toContain("specialtyRotation");
		});

		it("should limit the specialties to the cooking level and announce the next unlock", async () => {
			const kitchenMasterLevel = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0];
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, kitchenMasterLevel) });
			const nestedMenus = createMockNestedMenus();
			await handler.handleFeatureSelection(ctx, createMockComponentInteraction() as any, nestedMenus as any);
			await simulateMqttResponse(CommandReportCookingMenuRes.name, {
				menu: {
					cookingLevel: kitchenMasterLevel,
					cookingGrade: "kitchenMaster",
					currentSlots: [],
					isIgnited: false
				}
			});

			const rendered = JSON.stringify(lastRenderedMenu(nestedMenus));
			expect(rendered).toContain(JSON.stringify("commands:report.city.homes.cooking.specialtiesNone|{\"count\":1}").slice(1, -1));
			expect(rendered).toContain(JSON.stringify(`commands:report.city.homes.cooking.specialtyNextUnlock|{"level":${CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[1]}}`).slice(1, -1));

			// Once the single specialty of the grade is taken, no other recipe is offered
			const igniteMenus = await ignite(ctx, {
				cookingLevel: kitchenMasterLevel,
				currentSlots: [createSlotWithRecipe({ slotIndex: 0, recipeId: "rotatingRecipe" })],
				specialties: [{
					recipeId: "specialtyRecipe", level: 1, recipeType: RecipeType.POTION_HEALTH, canCraft: true
				}]
			});
			expect(JSON.stringify(lastRenderedMenu(igniteMenus))).not.toContain(HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX);
		});

		it("should not announce any next unlock once every specialty is unlocked", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = createMockNestedMenus();
			await handler.handleFeatureSelection(ctx, createMockComponentInteraction() as any, nestedMenus as any);
			await simulateMqttResponse(CommandReportCookingMenuRes.name, {
				menu: {
					cookingLevel: ALL_SPECIALTIES_LEVEL,
					cookingGrade: "royalGrandChef",
					currentSlots: [],
					isIgnited: false
				}
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus))).not.toContain("specialtyNextUnlock");
		});

		it("should not offer specialties before the first unlock level", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, BEFORE_SPECIALTIES_LEVEL) });
			const nestedMenus = await ignite(ctx, {
				cookingLevel: BEFORE_SPECIALTIES_LEVEL,
				currentSlots: [createSlotWithRecipe({ slotIndex: 0 })]
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus))).not.toContain(HomeMenuIds.COOKING_SPECIALTY_SELECT);
		});

		it("should show the specialties on their own station with a craft button instead of a pin button", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = await ignite(ctx, {
				currentSlots: [createSlotWithRecipe({ slotIndex: SPECIALTY_SLOT_INDEX, recipeId: "specialtyRecipe", canCraft: false })],
				specialties: [{
					recipeId: "specialtyRecipe", level: 1, recipeType: RecipeType.POTION_HEALTH, canCraft: false
				}]
			});

			const rendered = lastRenderedMenu(nestedMenus);
			expect(JSON.stringify(rendered)).toContain(`commands:report.city.homes.cooking.slotRecipeName|{\\"stationId\\":${SPECIALTY_SLOT_INDEX}`);
			expect(JSON.stringify(rendered)).toContain(`${HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX}specialtyRecipe`);
			expect(JSON.stringify(rendered)).not.toContain(HomeMenuIds.COOKING_PIN_PREFIX);
			expect(findComponent(rendered, component => component.custom_id === `${HomeMenuIds.COOKING_CRAFT_PREFIX}${SPECIALTY_SLOT_INDEX}:specialtyRecipe`))
				.toMatchObject({ disabled: true });
		});

		it("should list the specialties before ignition and send their removal from the pre-ignite menu", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2, ALL_SPECIALTIES_LEVEL) });
			const nestedMenus = createMockNestedMenus();
			await handler.handleFeatureSelection(ctx, createMockComponentInteraction() as any, nestedMenus as any);
			await simulateMqttResponse(CommandReportCookingMenuRes.name, {
				menu: {
					cookingLevel: ALL_SPECIALTIES_LEVEL,
					cookingGrade: "royalGrandChef",
					currentSlots: [],
					isIgnited: false,
					specialties: [{
						recipeId: "specialtyRecipe", level: 4, recipeType: RecipeType.POTION_SPEED, canCraft: true
					}]
				}
			});

			const rendered = JSON.stringify(lastRenderedMenu(nestedMenus));
			expect(rendered).toContain("commands:report.city.homes.cooking.specialtiesTitle");
			expect(rendered).toContain("commands:report.city.homes.cooking.specialtyLine");
			expect(rendered).not.toContain(HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX);

			const removeValue = `${HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX}specialtyRecipe`;
			expect(rendered).toContain(removeValue);
			await handler.handleSubMenuSelection(ctx, removeValue, createMockComponentInteraction(removeValue) as any, nestedMenus as any);
			expect(lastSentPacket()).toBeInstanceOf(CommandReportCookingRemoveSpecialtyReq);
			expect(lastSentPacket()).toMatchObject({
				recipeId: "specialtyRecipe", fromIgnitedView: false
			});
		});

		it("should explain a time potion blocked by the weekly limit and disable its craft button", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2) });
			const timePotionSlot = createSlotWithRecipe({ slotIndex: 0, recipeId: "timeRecipe", canCraft: false });
			timePotionSlot.recipe = {
				...timePotionSlot.recipe!,
				recipeType: RecipeType.POTION_TIME_SPEEDUP,
				timePotionsLeftThisWeek: 0
			};
			const nestedMenus = await ignite(ctx, {
				cookingLevel: 5,
				currentSlots: [timePotionSlot]
			});

			const rendered = lastRenderedMenu(nestedMenus);
			expect(JSON.stringify(rendered)).toContain("commands:report.city.homes.cooking.timePotionsExhausted");
			expect(JSON.stringify(rendered)).not.toContain(HomeMenuIds.COOKING_PIN_PREFIX);
			expect(findComponent(rendered, component => component.custom_id === `${HomeMenuIds.COOKING_CRAFT_PREFIX}0:timeRecipe`))
				.toMatchObject({ disabled: true });
		});

		it("should not mention the weekly time potion limit while many time potions remain", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2) });
			const timePotionSlot = createSlotWithRecipe({ slotIndex: 0, recipeId: "timeRecipe" });
			timePotionSlot.recipe = {
				...timePotionSlot.recipe!,
				recipeType: RecipeType.POTION_TIME_SPEEDUP,
				timePotionsLeftThisWeek: TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD + 1
			};
			const nestedMenus = await ignite(ctx, {
				cookingLevel: 5,
				currentSlots: [timePotionSlot]
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus))).not.toContain("timePotionsLeft");
		});

		it("should tell how many time potions can still be cooked this week once few remain", async () => {
			const ctx = createHandlerContext({ homeData: createCookingHomeData(2) });
			const timePotionSlot = createSlotWithRecipe({ slotIndex: 0, recipeId: "timeRecipe" });
			timePotionSlot.recipe = {
				...timePotionSlot.recipe!,
				recipeType: RecipeType.POTION_TIME_SPEEDUP,
				timePotionsLeftThisWeek: TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
			};
			const nestedMenus = await ignite(ctx, {
				cookingLevel: 5,
				currentSlots: [timePotionSlot]
			});

			expect(JSON.stringify(lastRenderedMenu(nestedMenus)))
				.toContain(JSON.stringify(`commands:report.city.homes.cooking.timePotionsLeft|{"count":${TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD}}`).slice(1, -1));
		});
	});
});
