import {
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest";

// ===== Module mocks (must be before imports) =====

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
			// Return key + serialized params for assertion
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

vi.mock("../../../Discord/src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn()
	}
}));

// ===== Imports (after mocks) =====

import { GardenFeatureHandler } from "../../src/commands/player/report/home/features/GardenFeatureHandler";
import { HomeMenuIds } from "../../src/commands/player/report/home/HomeMenuConstants";
import {
	createGardenData,
	createHandlerContext,
	createHomeData,
	createMockComponentInteraction,
	createMockNestedMenus,
	createMockPacket
} from "./homeTestUtils";
import { DiscordMQTT } from "../../src/bot/DiscordMQTT";
import {
	ActionRowBuilder, ContainerBuilder
} from "discord.js";
import {
	CommandReportGardenErrorRes,
	CommandReportGardenHarvestRes,
	CommandReportGardenPlantRes,
	CommandReportGardenWaterRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorRefuseReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { DiscordCache } from "../../src/bot/DiscordCache";
import i18n from "../../src/translations/i18n";

describe("GardenFeatureHandler", () => {
	let handler: GardenFeatureHandler;

	/**
	 * Extract all buttons from a ContainerBuilder's ActionRow components
	 */
	function getButtonsFromContainer(container: ContainerBuilder): any[] {
		return container.components
			.filter((c): c is ActionRowBuilder<any> => c instanceof ActionRowBuilder)
			.flatMap(row => row.components);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new GardenFeatureHandler();
	});

	describe("featureId", () => {
		it("should be 'garden'", () => {
			expect(handler.featureId).toBe(HomeMenuIds.FEATURE_GARDEN);
		});
	});

	describe("isAvailable", () => {
		it("should return true when garden data exists", () => {
			const ctx = createHandlerContext();
			expect(handler.isAvailable(ctx)).toBe(true);
		});

		it("should return false when garden data is undefined", () => {
			const ctx = createHandlerContext({
				homeData: createHomeData({ garden: undefined })
			});
			expect(handler.isAvailable(ctx)).toBe(false);
		});
	});

	describe("getMenuOption", () => {
		it("should return menu option when garden is available", () => {
			const ctx = createHandlerContext();
			const option = handler.getMenuOption(ctx);

			expect(option).not.toBeNull();
			expect(option!.value).toBe(HomeMenuIds.GARDEN_MENU);
			expect(option!.label).toContain("commands:report.city.homes.garden.menuLabel");
			expect(option!.buttonLabel).toContain("commands:report.city.homes.garden.buttonLabel");
		});

		it("should include ready count in description", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 1, isReady: true, readyAtTimestamp: 0
					},
					{
						slot: 1, plantId: 2, growthProgress: 1, isReady: true, readyAtTimestamp: 0
					}
				],
				totalPlots: 2
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const option = handler.getMenuOption(ctx);

			expect(option).not.toBeNull();
			// The description should contain ready=2 and total=2
			expect(option!.description).toContain('"ready":2');
			expect(option!.description).toContain('"total":2');
		});

		it("should return null when garden is not available", () => {
			const ctx = createHandlerContext({
				homeData: createHomeData({ garden: undefined })
			});
			const option = handler.getMenuOption(ctx);
			expect(option).toBeNull();
		});
	});

	describe("getDescriptionLines", () => {
		it("should return description line when garden is available", () => {
			const ctx = createHandlerContext();
			const lines = handler.getDescriptionLines(ctx);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain("commands:report.city.homes.garden.available");
		});

		it("should return empty array when garden is not available", () => {
			const ctx = createHandlerContext({
				homeData: createHomeData({ garden: undefined })
			});
			const lines = handler.getDescriptionLines(ctx);
			expect(lines).toHaveLength(0);
		});
	});

	describe("handleFeatureSelection", () => {
		it("should defer update and navigate to garden menu", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction();
			const menus = createMockNestedMenus();

			await handler.handleFeatureSelection(ctx, interaction as never, menus as never);

			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});
	});

	describe("handleSubMenuSelection", () => {
		it("should handle BACK_TO_HOME navigation", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction(HomeMenuIds.BACK_TO_HOME);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.BACK_TO_HOME, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.HOME_MENU);
		});

		it("should handle GARDEN_BACK navigation", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_BACK);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_BACK, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});

		it("should handle GARDEN_STORAGE navigation", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_STORAGE);
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_STORAGE, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_STORAGE,
				expect.objectContaining({
					containers: expect.any(Array),
					createCollector: expect.any(Function)
				})
			);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_STORAGE);
		});

		it("should send refuse reaction and stop collector when putting away the talisman", async () => {
			const ctx = createHandlerContext({
				packet: createMockPacket([
					{ type: "SomeOtherReaction" },
					{ type: ReactionCollectorRefuseReaction.name }
				])
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN);
			const menus = createMockNestedMenus();
			const sendReaction = vi.spyOn(DiscordCollectorUtils, "sendReaction").mockImplementation(() => {});

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(sendReaction).toHaveBeenCalledWith(ctx.packet, ctx.context, ctx.context.keycloakId, interaction, 1);
			expect(menus.stopCurrentCollector).toHaveBeenCalledOnce();
		});

		it("should handle GARDEN_HARVEST by sending MQTT packet", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_HARVEST);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockResolvedValue(undefined);

			const handled = await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_HARVEST, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(mockSendPacket).toHaveBeenCalledOnce();
			// Verify correct context was sent
			const [sentContext] = mockSendPacket.mock.calls[0];
			expect(sentContext).toBe(ctx.context);
		});

		it("should handle GARDEN_PLANT_PREFIX by sending MQTT packet", async () => {
			const ctx = createHandlerContext();
			const plantValue = `${HomeMenuIds.GARDEN_PLANT_PREFIX}auto`;
			const interaction = createMockComponentInteraction(plantValue);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockResolvedValue(undefined);

			const handled = await handler.handleSubMenuSelection(
				ctx, plantValue, interaction as never, menus as never
			);

			expect(handled).toBe(true);
			expect(interaction.deferUpdate).toHaveBeenCalledOnce();
			expect(mockSendPacket).toHaveBeenCalledOnce();
			// Verify correct context was sent
			const [sentContext] = mockSendPacket.mock.calls[0];
			expect(sentContext).toBe(ctx.context);
		});

		it("should return false for unknown selection values", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction("UNKNOWN_VALUE");
			const menus = createMockNestedMenus();

			const handled = await handler.handleSubMenuSelection(
				ctx, "UNKNOWN_VALUE", interaction as never, menus as never
			);

			expect(handled).toBe(false);
		});
	});

	describe("MQTT response handling", () => {
		it("should update garden data after successful harvest", async () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 1, isReady: true, readyAtTimestamp: 0
					},
					{
						slot: 1, plantId: 2, growthProgress: 0.5, isReady: false, readyAtTimestamp: 300
					}
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_HARVEST);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockImplementation(async (_ctx, _packet, handler) => {
				// Simulate a successful harvest response
				const response: Partial<CommandReportGardenHarvestRes> = {
					plantsHarvested: 1,
					plantsComposted: 0,
					compostResults: [],
					plantStorage: [{ plantId: 1, quantity: 4, maxCapacity: 10 }],
					harvestedSlots: [0]
				};
				await handler!(
					_ctx,
					CommandReportGardenHarvestRes.name,
					response as never
				);
			});

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_HARVEST, interaction as never, menus as never
			);

			// Verify garden data was updated
			expect(garden.plots[0].isReady).toBe(false);
			expect(garden.plots[0].growthProgress).toBe(0);
			// Slot 1 should not be affected
			expect(garden.plots[1].isReady).toBe(false);
			expect(garden.plots[1].growthProgress).toBe(0.5);
			// Plant storage updated
			expect(garden.plantStorage[0].quantity).toBe(4);
			// Menu was refreshed
			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_MENU,
				expect.anything()
			);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});

		it("should handle garden error response", async () => {
			const ctx = createHandlerContext();
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_HARVEST);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockImplementation(async (_ctx, _packet, handler) => {
				await handler!(
					_ctx,
					CommandReportGardenErrorRes.name,
					{} as never
				);
			});

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_HARVEST, interaction as never, menus as never
			);

			// On error, garden menu should be re-registered and navigated to
			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_MENU,
				expect.anything()
			);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});

		it("should update garden data after successful plant action", async () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0
					}
				],
				hasSeed: true,
				seedPlantId: 3
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const plantValue = `${HomeMenuIds.GARDEN_PLANT_PREFIX}auto`;
			const interaction = createMockComponentInteraction(plantValue);
			const menus = createMockNestedMenus();

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockImplementation(async (_ctx, _packet, handler) => {
				const response: Partial<CommandReportGardenPlantRes> = {
					plantId: 3,
					gardenSlot: 0
				};
				await handler!(
					_ctx,
					CommandReportGardenPlantRes.name,
					response as never
				);
			});

			await handler.handleSubMenuSelection(
				ctx, plantValue, interaction as never, menus as never
			);

			// Plot should now be planted
			expect(garden.plots[0].plantId).toBe(3);
			expect(garden.plots[0].growthProgress).toBe(0);
			expect(garden.plots[0].isReady).toBe(false);
			// Seed should be consumed
			expect(garden.hasSeed).toBe(false);
			expect(garden.seedPlantId).toBe(0);
			// Menu refreshed
			expect(menus.registerMenu).toHaveBeenCalled();
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});

		it("should end the city interaction after a successful watering, like a shop purchase", async () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 0.5, isReady: false, readyAtTimestamp: Math.ceil(Date.now() / 1000) + 60
					}
				]
			});
			const ctx = createHandlerContext({
				homeData: createHomeData({ garden }),
				packet: createMockPacket([
					{ type: "SomeOtherReaction" },
					{ type: ReactionCollectorRefuseReaction.name }
				])
			});
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_WATER);
			const menus = createMockNestedMenus();
			const sendReaction = vi.spyOn(DiscordCollectorUtils, "sendReaction").mockImplementation(() => {});
			const followUp = vi.fn().mockResolvedValue(undefined);
			const reply = vi.fn().mockResolvedValue(undefined);
			vi.mocked(DiscordCache.getInteraction).mockReturnValue({
				replied: true,
				followUp,
				reply,
				user: {
					displayName: "TestUser",
					displayAvatarURL: vi.fn(() => "https://example.com/avatar.png")
				}
			} as never);

			const mockSendPacket = vi.mocked(DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse);
			mockSendPacket.mockImplementation(async (_ctx, _packet, handler) => {
				const response: Partial<CommandReportGardenWaterRes> = {
					slotsWatered: 1,
					slotsBecameReady: 1,
					nextWateringAvailableAt: Date.now() + 60_000
				};
				await handler!(
					_ctx,
					CommandReportGardenWaterRes.name,
					response as never
				);
			});

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_WATER, interaction as never, menus as never
			);

			// Success embed sent via followUp on the original interaction
			expect(followUp).toHaveBeenCalledTimes(1);
			expect(i18n.t).toHaveBeenCalledWith(
				"commands:report.city.homes.garden.waterSuccess",
				expect.objectContaining({
					lng: ctx.lng,
					slotsBecameReady: 1,
					count: 1
				})
			);
			// Then the city interaction is closed like a shop purchase
			expect(sendReaction).toHaveBeenCalledWith(ctx.packet, ctx.context, ctx.context.keycloakId, null, 1);
			expect(menus.stopCurrentCollector).toHaveBeenCalledOnce();
			expect(menus.changeMenu).not.toHaveBeenCalledWith(HomeMenuIds.GARDEN_MENU);
		});
	});

	describe("addSubMenuContainerContent", () => {
		it("should include harvest button (disabled when no ready plants)", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 0.5, isReady: false, readyAtTimestamp: 300
					}
				],
				eligibility: {
					canHarvest: false, canPlantSeed: false, canWaterGarden: true, canCompost: true
				}
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const harvestButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_HARVEST
			);
			expect(harvestButton).toBeDefined();
			expect((harvestButton as any).data.disabled).toBe(true);
		});

		it("should include enabled harvest button when plants are ready", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 1, isReady: true, readyAtTimestamp: 0
					}
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const harvestButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_HARVEST
			);
			expect(harvestButton).toBeDefined();
			expect((harvestButton as any).data.disabled).toBeFalsy();
		});

		it("should include plant button when player has seed and empty plot", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0
					}
				],
				hasSeed: true,
				seedPlantId: 2
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const plantButton = allButtons.find(
				(b: any) => b.data?.custom_id?.startsWith(HomeMenuIds.GARDEN_PLANT_PREFIX)
			);
			expect(plantButton).toBeDefined();
		});

		it("should not include plant button when player has no seed", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0
					}
				],
				hasSeed: false,
				eligibility: {
					canHarvest: false, canPlantSeed: false, canWaterGarden: false, canCompost: true
				}
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const plantButton = allButtons.find(
				(b: any) => b.data?.custom_id?.startsWith(HomeMenuIds.GARDEN_PLANT_PREFIX)
			);
			expect(plantButton).toBeUndefined();
		});

		it("should include storage button", () => {
			const ctx = createHandlerContext();
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const storageButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_STORAGE
			);
			expect(storageButton).toBeDefined();
		});

		it("should include back button", () => {
			const ctx = createHandlerContext();
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const backButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.BACK_TO_HOME
			);
			expect(backButton).toBeDefined();
		});
	});

	describe("getSubMenuDescription", () => {
		it("should include plot descriptions", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 1, isReady: true, readyAtTimestamp: 0
					},
					{
						slot: 1, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0
					}
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const description = handler.getSubMenuDescription(ctx);

			expect(description).toContain("commands:report.city.homes.garden.description");
			expect(description).toContain("commands:report.city.homes.garden.readyPlot");
			expect(description).toContain("commands:report.city.homes.garden.emptyPlot");
		});

		it("should include seed information when available", () => {
			const garden = createGardenData({
				hasSeed: true,
				seedPlantId: 2
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const description = handler.getSubMenuDescription(ctx);

			expect(description).toContain("commands:report.city.homes.garden.hasSeed");
		});

		it("should show growing plot with progress", () => {
			const garden = createGardenData({
				plots: [
					{
						slot: 0, plantId: 1, growthProgress: 0.5, isReady: false, readyAtTimestamp: 300
					}
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const description = handler.getSubMenuDescription(ctx);

			expect(description).toContain("commands:report.city.homes.garden.growingPlot");
		});
	});

	describe("getSubMenuTitle", () => {
		it("should include pseudo", () => {
			const ctx = createHandlerContext();
			const title = handler.getSubMenuTitle(ctx, "TestPlayer");

			expect(title).toContain("commands:report.city.homes.garden.title");
		});
	});

	describe("storage sub-menu", () => {
		it("should register storage menu with stored plants info", async () => {
			const garden = createGardenData({
				plantStorage: [
					{ plantId: 1, quantity: 5, maxCapacity: 10 },
					{ plantId: 2, quantity: 0, maxCapacity: 10 }
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_STORAGE);
			const menus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_STORAGE, interaction as never, menus as never
			);

			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_STORAGE,
				expect.objectContaining({
					containers: expect.any(Array),
					createCollector: expect.any(Function)
				})
			);

			// Verify the registered menu has a back button in its container
			const registeredMenu = menus.registerMenu.mock.calls[0][1];
			const allButtons = getButtonsFromContainer(registeredMenu.containers[0]);
			const backButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_BACK
			);
			expect(backButton).toBeDefined();
		});
	});

	describe("compost sub-menu", () => {
		it("should include compost button when storage has at least one plant", () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 1, maxCapacity: 10 }]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const compostButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_COMPOST
			);
			expect(compostButton).toBeDefined();
		});

		it("should NOT include compost button when storage is empty", () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 0, maxCapacity: 10 }],
				eligibility: {
					canHarvest: true, canPlantSeed: true, canWaterGarden: false, canCompost: false
				}
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const compostButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_COMPOST
			);
			expect(compostButton).toBeUndefined();
		});

		it("should NOT include compost button when garden is READ_ONLY", () => {
			const garden = {
				...createGardenData({
					plantStorage: [{ plantId: 1, quantity: 5, maxCapacity: 10 }],
					eligibility: {
						canHarvest: true, canPlantSeed: false, canWaterGarden: false, canCompost: false
					}
				}),
				accessMode: "readOnly"
			} as unknown as ReturnType<typeof createGardenData>;
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const container = new ContainerBuilder();
			handler.addSubMenuContainerContent!(ctx, container);

			const allButtons = getButtonsFromContainer(container);
			const compostButton = allButtons.find(
				(b: any) => b.data?.custom_id === HomeMenuIds.GARDEN_COMPOST
			);
			expect(compostButton).toBeUndefined();
		});

		it("should register the compost plant-selection menu when compost button is clicked", async () => {
			const garden = createGardenData({
				plantStorage: [
					{ plantId: 1, quantity: 3, maxCapacity: 10 },
					{ plantId: 2, quantity: 7, maxCapacity: 10 }
				]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_COMPOST);
			const menus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_COMPOST, interaction as never, menus as never
			);

			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_COMPOST_MENU,
				expect.objectContaining({ containers: expect.any(Array) })
			);
			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_COMPOST_MENU);

			// Each stored plant with quantity > 0 should be selectable
			const registered = menus.registerMenu.mock.calls[0][1];
			const buttons = getButtonsFromContainer(registered.containers[0]);
			const plantButtons = buttons.filter(
				(b: any) => b.data?.custom_id?.startsWith(HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX)
			);
			expect(plantButtons.length).toBe(2);
		});

		it("should hide the 'Composter 5' button when stock < 5", async () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 2, maxCapacity: 10 }]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(
				`${HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX}1`
			);
			const menus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx, `${HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX}1`, interaction as never, menus as never
			);

			expect(menus.registerMenu).toHaveBeenCalledWith(
				HomeMenuIds.GARDEN_COMPOST_CONFIRM_MENU,
				expect.any(Object)
			);
			const registered = menus.registerMenu.mock.calls[0][1];
			const buttons = getButtonsFromContainer(registered.containers[0]);
			const confirmButtons = buttons.filter(
				(b: any) => b.data?.custom_id?.startsWith(HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX)
			);
			// Only the "1" button should be there, not the "5"
			expect(confirmButtons.length).toBe(1);
			expect(confirmButtons[0].data.custom_id).toBe(
				`${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}1_1`
			);
		});

		it("should show both '1' and '5' confirm buttons when stock >= 5", async () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 7, maxCapacity: 10 }]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(
				`${HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX}1`
			);
			const menus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx, `${HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX}1`, interaction as never, menus as never
			);

			const registered = menus.registerMenu.mock.calls[0][1];
			const buttons = getButtonsFromContainer(registered.containers[0]);
			const confirmButtons = buttons.filter(
				(b: any) => b.data?.custom_id?.startsWith(HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX)
			);
			expect(confirmButtons.length).toBe(2);
			const ids = confirmButtons.map((b: any) => b.data.custom_id);
			expect(ids).toContain(`${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}1_1`);
			expect(ids).toContain(`${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}5_1`);
		});

		it("should go back to compost plant selection when confirmation is cancelled", async () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 7, maxCapacity: 10 }]
			});
			const ctx = createHandlerContext({ homeData: createHomeData({ garden }) });
			const interaction = createMockComponentInteraction(HomeMenuIds.GARDEN_COMPOST_CONFIRM_CANCEL);
			const menus = createMockNestedMenus();

			await handler.handleSubMenuSelection(
				ctx, HomeMenuIds.GARDEN_COMPOST_CONFIRM_CANCEL, interaction as never, menus as never
			);

			expect(menus.changeMenu).toHaveBeenCalledWith(HomeMenuIds.GARDEN_COMPOST_MENU);
		});

		it("should send the matching compost reaction when a confirm button is clicked", async () => {
			const garden = createGardenData({
				plantStorage: [{ plantId: 1, quantity: 7, maxCapacity: 10 }]
			});
			const reactions = [
				{
					type: "ReactionCollectorGardenCompostReaction",
					data: { plantId: 1, quantity: 5 }
				},
				{
					type: "ReactionCollectorGardenCompostReaction",
					data: { plantId: 1, quantity: 1 }
				}
			];
			const ctx = createHandlerContext({
				homeData: createHomeData({ garden }),
				packet: createMockPacket(reactions)
			});
			const customId = `${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}5_1`;
			const interaction = createMockComponentInteraction(customId);
			const menus = createMockNestedMenus();
			const sendReactionSpy = vi.spyOn(DiscordCollectorUtils, "sendReaction").mockImplementation(() => {});

			await handler.handleSubMenuSelection(
				ctx, customId, interaction as never, menus as never
			);

			expect(sendReactionSpy).toHaveBeenCalledWith(
				ctx.packet, ctx.context, "test-keycloak-id", interaction, 0
			);
			expect(menus.stopCurrentCollector).toHaveBeenCalled();
		});
	});
});

