import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
	parseEmoji
} from "discord.js";
import {
	ComponentInteraction, HomeFeatureHandlerContext
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import { createHomeFeatureCollector } from "../HomeCollectorUtils";
import i18n from "../../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { HomeMenuIds } from "../HomeMenuConstants";
import { addButtonToRow } from "../../../../../utils/DiscordCollectorUtils";
import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import { makePacket } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportPlantTransferReq,
	CommandReportPlantTransferRes,
	PlantTransferAction
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { HomeConstants } from "../../../../../../../Lib/src/constants/HomeConstants";
import {
	PlantConstants, PlantId
} from "../../../../../../../Lib/src/constants/PlantConstants";

type PlantEntry = {
	section: "deposit" | "withdraw";
	plantId: PlantId | 0;
	slot?: number;
	quantity?: number;
	disabled: boolean;
};

type PlantTransferPrefixParams = {
	selectedValue: string;
	prefix: string;
	action: PlantTransferAction;
};

type PlantTransferData = {
	action: PlantTransferAction;
	plantId: PlantId;
	playerSlot: number;
};

/**
 * Handles plant storage operations within the chest feature.
 * Manages plant deposit, withdraw, and the plant tab UI.
 */
export class ChestPlantHandler {
	private readonly buildItemButton: (params: {
		emoteIndex: number; customId: string; disabled?: boolean;
	}) => ButtonBuilder;

	private readonly buildV2Container: (title: string, description: string, rows: ActionRowBuilder<ButtonBuilder>[]) => ContainerBuilder;

	private readonly createChestCollector: (ctx: HomeFeatureHandlerContext) => ReturnType<typeof createHomeFeatureCollector>;

	private readonly refreshChestCategoriesMenu: (ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus) => void;

	constructor(deps: {
		buildItemButton: (params: {
			emoteIndex: number; customId: string; disabled?: boolean;
		}) => ButtonBuilder;
		buildV2Container: (title: string, description: string, rows: ActionRowBuilder<ButtonBuilder>[]) => ContainerBuilder;
		createChestCollector: (ctx: HomeFeatureHandlerContext) => ReturnType<typeof createHomeFeatureCollector>;
		refreshChestCategoriesMenu: (ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus) => void;
	}) {
		this.buildItemButton = deps.buildItemButton;
		this.buildV2Container = deps.buildV2Container;
		this.createChestCollector = deps.createChestCollector;
		this.refreshChestCategoriesMenu = deps.refreshChestCategoriesMenu;
	}

	/**
	 * Handle plant-related button interactions. Returns true if handled.
	 */
	public async handlePlantInteraction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		if (selectedValue === HomeMenuIds.CHEST_PLANT_TAB) {
			await this.showPlantTabDetail(ctx, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_PLANT_DEPOSIT_PREFIX)) {
			await this.handlePlantTransferByPrefix(ctx, {
				selectedValue, prefix: HomeMenuIds.CHEST_PLANT_DEPOSIT_PREFIX, action: HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT
			}, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_PLANT_WITHDRAW_PREFIX)) {
			await this.handlePlantTransferByPrefix(ctx, {
				selectedValue, prefix: HomeMenuIds.CHEST_PLANT_WITHDRAW_PREFIX, action: HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW
			}, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_PLANT_PAGE_PREFIX)) {
			await componentInteraction.deferUpdate();
			const targetPage = parseInt(selectedValue.replace(HomeMenuIds.CHEST_PLANT_PAGE_PREFIX, ""), 10);

			if (Number.isNaN(targetPage) || targetPage < 0) {
				return true;
			}

			this.registerPlantTabMenu(ctx, nestedMenus, targetPage);
			await nestedMenus.changeMenu(HomeMenuIds.CHEST_PLANT_TAB);
			return true;
		}

		return false;
	}

	private async showPlantTabDetail(
		ctx: HomeFeatureHandlerContext,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		if (!ctx.homeData.chest?.plantStorage) {
			await componentInteraction.deferUpdate();
			return;
		}

		await componentInteraction.deferUpdate();
		this.registerPlantTabMenu(ctx, nestedMenus);
		await nestedMenus.changeMenu(HomeMenuIds.CHEST_PLANT_TAB);
	}

	/**
	 * Build and register the plant tab detail menu with deposit/withdraw buttons.
	 */
	public registerPlantTabMenu(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		page = 0
	): void {
		const chest = ctx.homeData.chest!;
		const plantStorage = chest.plantStorage ?? [];
		const playerSlots = chest.playerPlantSlots ?? [];
		const maxCapacity = chest.plantMaxCapacity ?? 0;
		const hasEmptySlot = playerSlots.some(s => s.plantId === 0);

		// Build full list of plant entries (deposit first, then withdraw)
		const entries = this.buildPlantEntryList(playerSlots, plantStorage, maxCapacity, hasEmptySlot);

		// Pagination
		const itemsPerPage = CrowniclesIcons.choiceEmotes.length;
		const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
		const currentPage = Math.min(Math.max(0, page), totalPages - 1);
		const pageEntries = entries.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

		const {
			description, rows
		} = this.buildPlantTabContent(ctx, pageEntries, maxCapacity);

		// Pagination buttons (prev / next)
		if (totalPages > 1) {
			addButtonToRow(rows, new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.previousPage)!)
				.setCustomId(`${HomeMenuIds.CHEST_PLANT_PAGE_PREFIX}${currentPage - 1}`)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 0));
			addButtonToRow(rows, new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.nextPage)!)
				.setCustomId(`${HomeMenuIds.CHEST_PLANT_PAGE_PREFIX}${currentPage + 1}`)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === totalPages - 1));
		}

		// Back button
		addButtonToRow(rows, new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(HomeMenuIds.CHEST_BACK_TO_CATEGORIES)
			.setStyle(ButtonStyle.Secondary));

		nestedMenus.registerMenu(HomeMenuIds.CHEST_PLANT_TAB, {
			containers: [
				this.buildV2Container(
					i18n.t("commands:report.city.homes.chest.title", {
						lng: ctx.lng, pseudo: ctx.pseudo
					}),
					description,
					rows
				)
			],
			createCollector: this.createChestCollector(ctx)
		});
	}

	/**
	 * Build description and button rows for the plant tab entries list.
	 */
	private buildPlantTabContent(
		ctx: HomeFeatureHandlerContext,
		pageEntries: PlantEntry[],
		maxCapacity: number
	): {
		description: string; rows: ActionRowBuilder<ButtonBuilder>[];
	} {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];
		let description = i18n.t("commands:report.city.homes.chest.plantHeader", {
			lng: ctx.lng,
			max: maxCapacity
		});
		let currentSection: "deposit" | "withdraw" | null = null;
		let emoteIndex = 0;

		for (const entry of pageEntries) {
			if (entry.section !== currentSection) {
				currentSection = entry.section;
				const sectionKey = entry.section === "deposit" ? "plantDepositSection" : "plantWithdrawSection";
				description += `\n\n${i18n.t(`commands:report.city.homes.chest.${sectionKey}`, { lng: ctx.lng })}`;
			}
			const plantType = PlantConstants.getPlantById(entry.plantId)!;
			const plantName = i18n.t(`models:plants.${plantType.id}`, { lng: ctx.lng });
			const icon = CrowniclesIcons.plants[plantType.id];

			if (entry.section === "deposit") {
				description += `\n${CrowniclesIcons.choiceEmotes[emoteIndex]} - ${icon} ${plantName}`;
				addButtonToRow(rows, this.buildItemButton({
					emoteIndex,
					customId: `${HomeMenuIds.CHEST_PLANT_DEPOSIT_PREFIX}${entry.plantId}_${entry.slot}`,
					disabled: entry.disabled
				}));
			}
			else {
				description += `\n${CrowniclesIcons.choiceEmotes[emoteIndex]} - ${icon} ${plantName} (${entry.quantity}/${maxCapacity})`;
				addButtonToRow(rows, this.buildItemButton({
					emoteIndex,
					customId: `${HomeMenuIds.CHEST_PLANT_WITHDRAW_PREFIX}${entry.plantId}`,
					disabled: entry.disabled
				}));
			}
			emoteIndex++;
		}

		if (pageEntries.length === 0) {
			description += `\n\n${i18n.t("commands:report.city.homes.chest.plantEmpty", { lng: ctx.lng })}`;
		}
		return {
			description, rows
		};
	}

	/**
	 * Build the full list of plant entries for the plant tab (deposit + withdraw).
	 */
	private buildPlantEntryList(
		playerSlots: {
			slot: number; plantId: PlantId | 0;
		}[],
		plantStorage: {
			plantId: PlantId; quantity: number;
		}[],
		maxCapacity: number,
		hasEmptySlot: boolean
	): PlantEntry[] {
		const entries: PlantEntry[] = [];

		for (const slot of playerSlots.filter(s => s.plantId !== 0)) {
			if (!PlantConstants.getPlantById(slot.plantId)) {
				continue;
			}
			const storageForType = plantStorage.find(s => s.plantId === slot.plantId);
			entries.push({
				section: "deposit",
				plantId: slot.plantId,
				slot: slot.slot,
				disabled: (storageForType?.quantity ?? 0) >= maxCapacity
			});
		}

		for (const stored of plantStorage.filter(s => s.quantity > 0)) {
			if (!PlantConstants.getPlantById(stored.plantId)) {
				continue;
			}
			entries.push({
				section: "withdraw",
				plantId: stored.plantId,
				quantity: stored.quantity,
				disabled: !hasEmptySlot
			});
		}

		return entries;
	}

	/**
	 * Handle a plant transfer action (deposit/withdraw) by prefix.
	 */
	private async handlePlantTransferByPrefix(
		ctx: HomeFeatureHandlerContext,
		params: PlantTransferPrefixParams,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await componentInteraction.deferUpdate();

		const parts = params.selectedValue.replace(params.prefix, "").split("_");
		const plantId = parseInt(parts[0], 10);

		if (Number.isNaN(plantId) || plantId < 0) {
			return;
		}

		const playerSlot = parts[1] !== undefined ? parseInt(parts[1], 10) : -1;

		if (parts[1] !== undefined && Number.isNaN(playerSlot)) {
			return;
		}

		await this.sendPlantTransferAction(ctx, {
			action: params.action, plantId, playerSlot
		}, nestedMenus);
	}

	/**
	 * Send a plant transfer action to Core and refresh the plant tab menu.
	 */
	private async sendPlantTransferAction(
		ctx: HomeFeatureHandlerContext,
		transferData: PlantTransferData,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportPlantTransferReq, {
				action: transferData.action, plantId: transferData.plantId, playerSlot: transferData.playerSlot
			}),
			async (_responseContext, _packetName, responsePacket) => {
				const response = responsePacket as unknown as CommandReportPlantTransferRes;

				if (!response.success) {
					return;
				}

				// Update chest plant data with refreshed data from Core
				if (ctx.homeData.chest) {
					ctx.homeData.chest.plantStorage = response.plantStorage;
					ctx.homeData.chest.playerPlantSlots = response.playerPlantSlots;
				}

				// Refresh category menu and plant tab
				this.refreshChestCategoriesMenu(ctx, nestedMenus);
				this.registerPlantTabMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.CHEST_PLANT_TAB);
			}
		);
	}
}
