import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	Message, parseEmoji, StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import {
	CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../../Lib/src/Language";
import { HomeMenuIds } from "../HomeMenuConstants";
import { MessageActionRowComponentBuilder } from "@discordjs/builders";
import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import { makePacket } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGardenHarvestReq,
	CommandReportGardenHarvestRes,
	CommandReportGardenPlantReq,
	CommandReportGardenPlantRes,
	CommandReportGardenPlantErrorRes
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../../../../utils/ErrorUtils";
import {
	PlantConstants, PlantId, PLANT_TYPES
} from "../../../../../../../Lib/src/constants/PlantConstants";

export class GardenFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "garden";

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		return ctx.homeData.garden !== undefined;
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		if (!this.isAvailable(ctx)) {
			return null;
		}

		const garden = ctx.homeData.garden!;
		const readyCount = garden.plots.filter(p => p.isReady).length;

		return {
			label: i18n.t("commands:report.city.homes.garden.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.garden.menuDescription", {
				lng: ctx.lng, ready: readyCount, total: garden.totalPlots
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.garden,
			value: HomeMenuIds.GARDEN_MENU
		};
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		if (!this.isAvailable(ctx)) {
			return [];
		}
		return [i18n.t("commands:report.city.homes.garden.available", { lng: ctx.lng })];
	}

	public async handleFeatureSelection(
		_ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await selectInteraction.deferUpdate();
		await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		// Navigation
		if (selectedValue === HomeMenuIds.BACK_TO_HOME) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(HomeMenuIds.HOME_MENU);
			return true;
		}

		if (selectedValue === HomeMenuIds.GARDEN_BACK) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			return true;
		}

		// View plant storage
		if (selectedValue === HomeMenuIds.GARDEN_STORAGE) {
			await componentInteraction.deferUpdate();
			this.registerStorageMenu(ctx, nestedMenus);
			await nestedMenus.changeMenu(HomeMenuIds.GARDEN_STORAGE);
			return true;
		}

		// Harvest
		if (selectedValue === HomeMenuIds.GARDEN_HARVEST) {
			await componentInteraction.deferUpdate();
			await this.sendHarvestAction(ctx, nestedMenus);
			return true;
		}

		// Plant in first available slot
		if (selectedValue.startsWith(HomeMenuIds.GARDEN_PLANT_PREFIX)) {
			await componentInteraction.deferUpdate();
			await this.sendPlantAction(ctx, -1, nestedMenus);
			return true;
		}

		return false;
	}

	/**
	 * Get the plant name for display
	 */
	private getPlantName(plantId: PlantId, lng: Language): string {
		return i18n.t(`commands:report.city.homes.garden.plants.${plantId}`, { lng });
	}

	/**
	 * Get the plant emoji
	 */
	private getPlantEmoji(plantId: PlantId): string {
		const plant = PlantConstants.getPlantById(plantId);
		return plant?.fallbackEmote ?? "🌱";
	}

	/**
	 * Format remaining time for display
	 */
	private formatRemainingTime(remainingSeconds: number, lng: Language): string {
		const minutes = Math.ceil(remainingSeconds / 60);
		return i18n.formatDuration(minutes, lng);
	}

	/**
	 * Build the garden main view description
	 */
	private buildGardenDescription(ctx: HomeFeatureHandlerContext): string {
		const garden = ctx.homeData.garden!;
		let description = i18n.t("commands:report.city.homes.garden.description", { lng: ctx.lng });

		description += "\n";

		for (const plot of garden.plots) {
			if (plot.plantId === 0) {
				description += `\n${i18n.t("commands:report.city.homes.garden.emptyPlot", {
					lng: ctx.lng,
					slot: plot.slot + 1
				})}`;
			}
			else {
				const plantName = this.getPlantName(plot.plantId as PlantId, ctx.lng);
				const emoji = this.getPlantEmoji(plot.plantId as PlantId);

				if (plot.isReady) {
					description += `\n${i18n.t("commands:report.city.homes.garden.readyPlot", {
						lng: ctx.lng,
						slot: plot.slot + 1,
						emoji,
						plant: plantName
					})}`;
				}
				else {
					const progress = Math.floor(plot.growthProgress * 100);
					const timeLeft = this.formatRemainingTime(plot.remainingSeconds, ctx.lng);
					description += `\n${i18n.t("commands:report.city.homes.garden.growingPlot", {
						lng: ctx.lng,
						slot: plot.slot + 1,
						emoji,
						plant: plantName,
						progress,
						timeLeft
					})}`;
				}
			}
		}

		if (garden.hasSeed) {
			const seedName = this.getPlantName(garden.seedPlantId as PlantId, ctx.lng);
			const seedEmoji = this.getPlantEmoji(garden.seedPlantId as PlantId);
			description += `\n\n${i18n.t("commands:report.city.homes.garden.hasSeed", {
				lng: ctx.lng,
				emoji: seedEmoji,
				seed: seedName
			})}`;
		}

		return description;
	}

	/**
	 * Build buttons for the garden main view
	 */
	private buildGardenButtons(ctx: HomeFeatureHandlerContext): ActionRowBuilder<ButtonBuilder>[] {
		const garden = ctx.homeData.garden!;
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		const hasReadyPlants = garden.plots.some(p => p.isReady);

		// Harvest button
		rows[0].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_HARVEST)
				.setLabel(i18n.t("commands:report.city.homes.garden.harvestButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.garden)!)
				.setStyle(ButtonStyle.Success)
				.setDisabled(!hasReadyPlants)
		);

		// Plant button (only if player has a seed and there is an empty plot)
		if (garden.hasSeed) {
			const hasEmptyPlot = garden.plots.some(p => p.plantId === 0);
			if (hasEmptyPlot) {
				rows[0].addComponents(
					new ButtonBuilder()
						.setCustomId(`${HomeMenuIds.GARDEN_PLANT_PREFIX}auto`)
						.setLabel(i18n.t("commands:report.city.homes.garden.plantButton", { lng: ctx.lng }))
						.setStyle(ButtonStyle.Primary)
				);
			}
		}

		// Storage button
		const totalStored = garden.plantStorage.reduce((sum, s) => sum + s.quantity, 0);
		if (rows[rows.length - 1].components.length >= 5) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_STORAGE)
				.setLabel(i18n.t("commands:report.city.homes.garden.storageButton", {
					lng: ctx.lng,
					count: totalStored
				}))
				.setStyle(ButtonStyle.Secondary)
		);

		// Back button
		if (rows[rows.length - 1].components.length >= 5) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.BACK_TO_HOME)
				.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Danger)
		);

		return rows;
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createGardenCollector(ctx: HomeFeatureHandlerContext): (menus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
		return (menus: CrowniclesNestedMenus, message: Message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
			collector.on("collect", async interaction => {
				if (interaction.user.id !== ctx.user.id) {
					await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
					return;
				}

				if (interaction.isButton()) {
					await this.handleSubMenuSelection(ctx, interaction.customId, interaction, menus);
				}
			});
			return collector;
		};
	}

	/**
	 * Register the garden main menu
	 */
	private registerGardenMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, extraMessage = ""): void {
		nestedMenus.registerMenu(HomeMenuIds.GARDEN_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(this.buildGardenDescription(ctx) + extraMessage),
			components: this.buildGardenButtons(ctx),
			createCollector: this.createGardenCollector(ctx)
		});
	}

	/**
	 * Register the plant storage sub-menu
	 */
	private registerStorageMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): void {
		const garden = ctx.homeData.garden!;

		let description = i18n.t("commands:report.city.homes.garden.storageTitle", { lng: ctx.lng });
		description += "\n";

		const storedPlants = garden.plantStorage.filter(s => s.quantity > 0);

		if (storedPlants.length === 0) {
			description += `\n${i18n.t("commands:report.city.homes.garden.storageEmpty", { lng: ctx.lng })}`;
		}
		else {
			for (const storage of storedPlants) {
				const plantName = this.getPlantName(storage.plantId, ctx.lng);
				const emoji = this.getPlantEmoji(storage.plantId);
				description += `\n${emoji} ${plantName} — ${storage.quantity}/${storage.maxCapacity}`;
			}
		}

		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];
		rows[0].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_BACK)
				.setLabel(i18n.t("commands:report.city.homes.garden.backToGarden", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Secondary)
		);

		nestedMenus.registerMenu(HomeMenuIds.GARDEN_STORAGE, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(description),
			components: rows,
			createCollector: this.createGardenCollector(ctx)
		});
	}

	/**
	 * Send a harvest action to Core and refresh the garden menu
	 */
	private async sendHarvestAction(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportGardenHarvestReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportGardenPlantErrorRes.name) {
					// No ready plants — just refresh the menu
					this.registerGardenMenu(ctx, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
					return;
				}

				const response = responsePacket as unknown as CommandReportGardenHarvestRes;

				// Update the garden data: reset only harvested plots
				const garden = ctx.homeData.garden!;
				for (const plot of garden.plots) {
					if (response.harvestedSlots.includes(plot.slot)) {
						plot.growthProgress = 0;
						plot.isReady = false;
						const plant = PLANT_TYPES.find(p => p.id === plot.plantId);
						plot.remainingSeconds = plant?.growthTimeSeconds ?? 0;
					}
				}

				// Use refreshed storage data from Core
				garden.plantStorage = response.plantStorage;

				// Build compost notification if any plants were composted
				let compostMessage = "";
				if (response.compostResults && response.compostResults.length > 0) {
					compostMessage = `\n\n${i18n.t("commands:report.city.homes.garden.compostTitle", { lng: ctx.lng })}`;
					for (const result of response.compostResults) {
						const plant = PLANT_TYPES.find(p => p.id === result.plantId);
						const plantName = plant
							? i18n.t(`commands:report.city.homes.garden.plants.${plant.id}`, { lng: ctx.lng })
							: "?";
						const materialEmoji = CrowniclesIcons.materials[result.materialId] ?? "📦";
						const materialName = i18n.t(`models:materials.${result.materialId}`, { lng: ctx.lng });
						compostMessage += `\n${i18n.t("commands:report.city.homes.garden.compostLine", {
							lng: ctx.lng,
							plantEmoji: plant?.fallbackEmote ?? "🌱",
							plant: plantName,
							materialEmoji,
							material: materialName
						})}`;
					}
				}

				// Refresh the garden menu with updated data and compost message
				this.registerGardenMenu(ctx, nestedMenus, compostMessage);
				await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			}
		);
	}

	/**
	 * Send a plant action to Core and refresh the garden menu
	 */
	private async sendPlantAction(
		ctx: HomeFeatureHandlerContext,
		gardenSlot: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportGardenPlantReq, { gardenSlot }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportGardenPlantErrorRes.name) {
					// Error — just refresh the menu
					this.registerGardenMenu(ctx, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
					return;
				}

				const response = responsePacket as unknown as CommandReportGardenPlantRes;

				// Update the garden data locally
				const garden = ctx.homeData.garden!;
				const plot = garden.plots.find(p => p.slot === response.gardenSlot);
				if (plot) {
					plot.plantId = response.plantId as PlantId;
					plot.growthProgress = 0;
					plot.isReady = false;
					const plant = PLANT_TYPES.find(p => p.id === response.plantId);
					plot.remainingSeconds = plant?.growthTimeSeconds ?? 0;
				}

				// Seed consumed
				garden.hasSeed = false;
				garden.seedPlantId = 0;

				// Refresh the garden menu with updated data
				this.registerGardenMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			}
		);
	}

	public addSubMenuOptions(_ctx: HomeFeatureHandlerContext, _selectMenu: StringSelectMenuBuilder): void {
		// Garden uses custom button components instead of select menu options
	}

	public getSubMenuComponents(ctx: HomeFeatureHandlerContext): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
		return this.buildGardenButtons(ctx);
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		return this.buildGardenDescription(ctx);
	}

	public getSubMenuPlaceholder(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.garden.placeholder", { lng: ctx.lng });
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.garden.title", {
			lng: ctx.lng, pseudo
		});
	}
}
