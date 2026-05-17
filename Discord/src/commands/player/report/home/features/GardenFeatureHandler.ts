import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
	parseEmoji, SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../../Lib/src/Language";
import { HomeMenuIds } from "../HomeMenuConstants";
import { createHomeFeatureCollector } from "../HomeCollectorUtils";
import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import { makePacket } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGardenHarvestReq,
	CommandReportGardenHarvestRes,
	CommandReportGardenPlantReq,
	CommandReportGardenPlantRes,
	CommandReportGardenWaterReq,
	CommandReportGardenWaterRes,
	CommandReportGardenErrorRes
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	PlantConstants, PlantId
} from "../../../../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../../../../Lib/src/constants/GardenConstants";
import { GardenEarthQuality } from "../../../../../../../Lib/src/types/GardenEarthQuality";
import { TimeConstants } from "../../../../../../../Lib/src/constants/TimeConstants";
import { printTimeBeforeDate } from "../../../../../../../Lib/src/utils/TimeUtils";
import { GardenAccessMode } from "../../../../../../../Lib/src/types/GardenAccessMode";
import { ReactionCollectorCityData } from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";

type GardenPlotData = NonNullable<HomeFeatureHandlerContext["homeData"]["garden"]>["plots"][number];
type GardenData = NonNullable<HomeFeatureHandlerContext["homeData"]["garden"]>;

export class GardenFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = HomeMenuIds.FEATURE_GARDEN;

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
			value: HomeMenuIds.GARDEN_MENU,
			buttonLabel: i18n.t("commands:report.city.homes.garden.buttonLabel", { lng: ctx.lng })
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
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await componentInteraction.deferUpdate();
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

		if (selectedValue === HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN) {
			await componentInteraction.deferUpdate();
			await nestedMenus.stopCurrentCollector();
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

		// Water
		if (selectedValue === HomeMenuIds.GARDEN_WATER) {
			await componentInteraction.deferUpdate();
			await this.sendWaterAction(ctx, nestedMenus);
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
	 * Format remaining time for display
	 */
	private formatRemainingTime(remainingSeconds: number, lng: Language): string {
		const minutes = Math.ceil(remainingSeconds / TimeConstants.S_TIME.MINUTE);
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
			description += this.buildPlotDescription(plot, ctx);
		}

		if (garden.hasSeed && garden.seedPlantId !== 0) {
			description += `\n\n${i18n.t("commands:report.city.homes.garden.hasSeed", {
				lng: ctx.lng,
				plantId: garden.seedPlantId
			})}`;
		}

		if (garden.accessMode === GardenAccessMode.FULL && garden.wateringAvailableAt !== null && garden.wateringAvailableAt > Date.now()) {
			description += `\n\n${i18n.t("commands:report.city.homes.garden.waterCooldown", {
				lng: ctx.lng,
				timeLeft: printTimeBeforeDate(garden.wateringAvailableAt)
			})}`;
		}

		return description;
	}

	/**
	 * Build description for a single garden plot
	 */
	private buildPlotDescription(plot: GardenPlotData, ctx: HomeFeatureHandlerContext): string {
		if (plot.plantId === 0) {
			return `\n${i18n.t("commands:report.city.homes.garden.emptyPlot", {
				lng: ctx.lng,
				slot: plot.slot + 1
			})}`;
		}
		if (plot.isReady) {
			return `\n${i18n.t("commands:report.city.homes.garden.readyPlot", {
				lng: ctx.lng,
				slot: plot.slot + 1,
				plantId: plot.plantId
			})}`;
		}
		const progress = Math.floor(plot.growthProgress * 100);
		const timeLeft = this.formatRemainingTime(plot.remainingSeconds, ctx.lng);
		return `\n${i18n.t("commands:report.city.homes.garden.growingPlot", {
			lng: ctx.lng,
			slot: plot.slot + 1,
			plantId: plot.plantId,
			progress,
			timeLeft
		})}`;
	}

	/**
	 * Build buttons for the garden main view
	 */
	private addGardenButtons(ctx: HomeFeatureHandlerContext, container: ContainerBuilder): void {
		const garden = ctx.homeData.garden!;
		const isReadOnly = garden.accessMode === GardenAccessMode.READ_ONLY;
		const hasReadyPlants = garden.plots.some(p => p.isReady);
		const buttons: ButtonBuilder[] = [];

		// Harvest button (always available, including in readOnly remote access)
		buttons.push(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_HARVEST)
				.setLabel(i18n.t("commands:report.city.homes.garden.harvestButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.garden)!)
				.setStyle(ButtonStyle.Success)
				.setDisabled(!hasReadyPlants)
		);

		// Plant button (only at home, with a seed and at least one empty plot)
		if (!isReadOnly && garden.hasSeed) {
			const hasEmptyPlot = garden.plots.some(p => p.plantId === 0);
			if (hasEmptyPlot) {
				buttons.push(
					new ButtonBuilder()
						.setCustomId(`${HomeMenuIds.GARDEN_PLANT_PREFIX}auto`)
						.setLabel(i18n.t("commands:report.city.homes.garden.plantButton", { lng: ctx.lng }))
						.setStyle(ButtonStyle.Primary)
				);
			}
		}

		// Water button (only at home)
		if (!isReadOnly) {
			const hasGrowingPlants = garden.plots.some(p => p.plantId !== 0 && !p.isReady);
			const onCooldown = garden.wateringAvailableAt !== null && garden.wateringAvailableAt > Date.now();
			buttons.push(
				new ButtonBuilder()
					.setCustomId(HomeMenuIds.GARDEN_WATER)
					.setLabel(i18n.t("commands:report.city.homes.garden.waterButton", { lng: ctx.lng }))
					.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.water)!)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(!hasGrowingPlants || onCooldown)
			);
		}

		// Storage button
		const totalStored = garden.plantStorage.reduce((sum, s) => sum + s.quantity, 0);
		buttons.push(new ButtonBuilder()
			.setCustomId(HomeMenuIds.GARDEN_STORAGE)
			.setLabel(i18n.t("commands:report.city.homes.garden.storageButton", {
				lng: ctx.lng,
				count: totalStored
			}))
			.setStyle(ButtonStyle.Secondary));

		// Back button (or put away talisman in /jardin mode, whether read-only remote or at home)
		const isGardenOnly = (ctx.packet.data.data as ReactionCollectorCityData).gardenOnly === true;
		buttons.push(isReadOnly || isGardenOnly
			? new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN)
				.setLabel(i18n.t("commands:report.city.homes.garden.putAwayTalisman", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.remoteHarvestTalisman)!)
				.setStyle(ButtonStyle.Danger)
			: new ButtonBuilder()
				.setCustomId(HomeMenuIds.BACK_TO_HOME)
				.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Danger));

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createGardenCollector(ctx: HomeFeatureHandlerContext): ReturnType<typeof createHomeFeatureCollector> {
		return createHomeFeatureCollector(this, ctx);
	}

	private buildGardenContainer(ctx: HomeFeatureHandlerContext, extraMessage = ""): ContainerBuilder {
		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### ${this.getSubMenuTitle(ctx, ctx.pseudo)}`)
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(this.buildGardenDescription(ctx) + extraMessage)
		);
		this.addGardenButtons(ctx, container);
		return container;
	}

	/**
	 * Register the garden main menu
	 */
	private registerGardenMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, extraMessage = ""): void {
		nestedMenus.registerMenu(HomeMenuIds.GARDEN_MENU, {
			containers: [this.buildGardenContainer(ctx, extraMessage)],
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
				description += `\n${i18n.t("commands:report.city.homes.garden.storageEntry", {
					lng: ctx.lng,
					plantId: storage.plantId,
					quantity: storage.quantity,
					maxCapacity: storage.maxCapacity
				})}`;
			}
		}

		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### ${this.getSubMenuTitle(ctx, ctx.pseudo)}`)
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(description)
		);

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(HomeMenuIds.GARDEN_BACK)
					.setLabel(i18n.t("commands:report.city.homes.garden.backToGarden", { lng: ctx.lng }))
					.setEmoji(CrowniclesIcons.collectors.back)
					.setStyle(ButtonStyle.Secondary)
			)
		);

		nestedMenus.registerMenu(HomeMenuIds.GARDEN_STORAGE, {
			containers: [container],
			createCollector: this.createGardenCollector(ctx)
		});
	}

	/**
	 * Compute remaining seconds for a plant in a garden slot
	 */
	private computeRemainingSeconds(plantId: PlantId | 0, earthQuality: GardenEarthQuality): number {
		const plant = PlantConstants.getPlantById(plantId);
		return plant
			? GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)
			: 0;
	}

	/**
	 * Handle garden error response by refreshing the menu
	 */
	private async handleGardenError(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		this.registerGardenMenu(ctx, nestedMenus);
		await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
	}

	/**
	 * Reset harvested plots in local garden state after a successful harvest
	 */
	private updateGardenAfterHarvest(garden: GardenData, response: CommandReportGardenHarvestRes, ctx: HomeFeatureHandlerContext): void {
		for (const plot of garden.plots) {
			if (response.harvestedSlots.includes(plot.slot)) {
				plot.growthProgress = 0;
				plot.isReady = false;
				plot.remainingSeconds = this.computeRemainingSeconds(plot.plantId, ctx.homeData.features.gardenEarthQuality);
			}
		}
		garden.plantStorage = response.plantStorage;
	}

	/**
	 * Build a compost result notification string from a harvest response
	 */
	private buildCompostMessage(response: CommandReportGardenHarvestRes, ctx: HomeFeatureHandlerContext): string {
		if (!response.compostResults || response.compostResults.length === 0) {
			return "";
		}
		let message = `\n\n${i18n.t("commands:report.city.homes.garden.compostTitle", { lng: ctx.lng })}`;
		for (const result of response.compostResults) {
			message += `\n${i18n.t("commands:report.city.homes.garden.compostLine", {
				lng: ctx.lng,
				plantId: result.plantId,
				materialId: result.materialId
			})}`;
		}
		return message;
	}

	private async sendHarvestAction(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportGardenHarvestReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportGardenErrorRes.name) {
					await this.handleGardenError(ctx, nestedMenus);
					return;
				}

				const response = responsePacket as unknown as CommandReportGardenHarvestRes;
				const garden = ctx.homeData.garden!;
				this.updateGardenAfterHarvest(garden, response, ctx);
				const compostMessage = this.buildCompostMessage(response, ctx);
				this.registerGardenMenu(ctx, nestedMenus, compostMessage);
				await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			}
		);
	}

	/**
	 * Send a watering action to Core and refresh the garden menu. On cooldown
	 * or when no plants are growing, the menu is re-rendered with a short
	 * status message instead of throwing.
	 */
	private async sendWaterAction(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportGardenWaterReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportGardenErrorRes.name) {
					const errorPacket = responsePacket as unknown as CommandReportGardenErrorRes;
					await this.handleWaterError(ctx, nestedMenus, errorPacket);
					return;
				}

				const response = responsePacket as unknown as CommandReportGardenWaterRes;
				const garden = ctx.homeData.garden!;
				this.updateGardenAfterWatering(garden, ctx, response);
				const successMessage = `\n\n${i18n.t("commands:report.city.homes.garden.waterSuccess", {
					lng: ctx.lng,
					slotsWatered: response.slotsWatered,
					slotsBecameReady: response.slotsBecameReady,
					count: response.slotsBecameReady
				})}`;
				this.registerGardenMenu(ctx, nestedMenus, successMessage);
				await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			}
		);
	}

	/**
	 * Render a watering error inline in the garden menu without leaving the view.
	 */
	private async handleWaterError(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		errorPacket: CommandReportGardenErrorRes
	): Promise<void> {
		let extraMessage = "";
		if (errorPacket.error === GardenConstants.GARDEN_ERRORS.WATERING_ON_COOLDOWN && errorPacket.availableAt) {
			extraMessage = `\n\n${i18n.t("commands:report.city.homes.garden.waterCooldownError", {
				lng: ctx.lng,
				timeLeft: printTimeBeforeDate(errorPacket.availableAt)
			})}`;

			// Sync local state with server so the button stays disabled
			ctx.homeData.garden!.wateringAvailableAt = errorPacket.availableAt;
		}
		else if (errorPacket.error === GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER) {
			extraMessage = `\n\n${i18n.t("commands:report.city.homes.garden.waterNothingToWater", { lng: ctx.lng })}`;
		}
		this.registerGardenMenu(ctx, nestedMenus, extraMessage);
		await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
	}

	/**
	 * Apply the watering effect on local garden state: shave the configured
	 * advance off every growing plant, possibly marking some as ready.
	 */
	private updateGardenAfterWatering(
		garden: GardenData,
		ctx: HomeFeatureHandlerContext,
		response: CommandReportGardenWaterRes
	): void {
		const advanceSeconds = GardenConstants.WATERING_TIME_ADVANCE_MS / 1000;
		for (const plot of garden.plots) {
			if (plot.plantId === 0 || plot.isReady) {
				continue;
			}
			const newRemaining = plot.remainingSeconds - advanceSeconds;
			if (newRemaining <= 0) {
				plot.remainingSeconds = 0;
				plot.growthProgress = 1;
				plot.isReady = true;
			}
			else {
				plot.remainingSeconds = newRemaining;
				const fullGrowth = this.computeRemainingSeconds(plot.plantId, ctx.homeData.features.gardenEarthQuality);
				plot.growthProgress = fullGrowth > 0 ? 1 - newRemaining / fullGrowth : 0;
			}
		}
		garden.wateringAvailableAt = response.nextWateringAvailableAt;
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
				if (packetName === CommandReportGardenErrorRes.name) {
					await this.handleGardenError(ctx, nestedMenus);
					return;
				}

				const response = responsePacket as unknown as CommandReportGardenPlantRes;

				// Update the garden data locally
				const garden = ctx.homeData.garden!;
				const plot = garden.plots.find(p => p.slot === response.gardenSlot);
				if (plot) {
					plot.plantId = response.plantId;
					plot.growthProgress = 0;
					plot.isReady = false;
					plot.remainingSeconds = this.computeRemainingSeconds(response.plantId, ctx.homeData.features.gardenEarthQuality);
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

	public addSubMenuContainerContent(ctx: HomeFeatureHandlerContext, container: ContainerBuilder): void {
		this.addGardenButtons(ctx, container);
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		return this.buildGardenDescription(ctx);
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.garden.title", {
			lng: ctx.lng, pseudo
		});
	}
}
