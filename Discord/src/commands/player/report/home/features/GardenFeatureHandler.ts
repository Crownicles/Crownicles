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
import {
	ReactionCollectorCityData,
	ReactionCollectorGardenCompostReaction
} from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorRefuseReaction } from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../../../../utils/DiscordCollectorUtils";
import {
	escapeUsername, StringUtils
} from "../../../../../utils/StringUtils";
import { DiscordCache } from "../../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";

type GardenPlotData = NonNullable<HomeFeatureHandlerContext["homeData"]["garden"]>["plots"][number];
type GardenData = NonNullable<HomeFeatureHandlerContext["homeData"]["garden"]>;

/** Max number of compost plant-select buttons per Discord action row */
const COMPOST_BUTTONS_PER_ROW = 5;

/**
 * Max number of action rows reserved for plant-select buttons in the compost
 * menu (the last action row in the container is reserved for the "Annuler"
 * button). Discord allows up to 5 action rows per message, so we leave at most
 * 4 for plant buttons + 1 for the cancel row.
 */
const COMPOST_MAX_PLANT_ROWS = 4;

/** Parsed custom-id of a compost confirmation button (`GARDEN_COMPOST_CONFIRM_<quantity>_<plantId>`) */
type CompostConfirmCustomId = {
	plantId: PlantId;
	quantity: number;
};

export class GardenFeatureHandler implements HomeFeatureHandler {
	private static readonly MAX_BUTTONS_PER_ROW = 5;

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
		const action = this.resolveSubMenuAction(ctx, selectedValue, componentInteraction);
		if (!action) {
			return false;
		}
		await componentInteraction.deferUpdate();
		await action(nestedMenus);
		return true;
	}

	private resolveSubMenuAction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction
	): ((nestedMenus: CrowniclesNestedMenus) => Promise<void>) | null {
		const exact: Record<string, (menus: CrowniclesNestedMenus) => Promise<void>> = {
			[HomeMenuIds.BACK_TO_HOME]: menus => menus.changeMenu(HomeMenuIds.HOME_MENU),
			[HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN]: async menus => {
				this.sendRefuseReaction(ctx, componentInteraction);
				await menus.stopCurrentCollector();
			},
			[HomeMenuIds.GARDEN_BACK]: menus => menus.changeMenu(HomeMenuIds.GARDEN_MENU),
			[HomeMenuIds.GARDEN_STORAGE]: async menus => {
				this.registerStorageMenu(ctx, menus);
				await menus.changeMenu(HomeMenuIds.GARDEN_STORAGE);
			},
			[HomeMenuIds.GARDEN_HARVEST]: menus => this.sendHarvestAction(ctx, menus),
			[HomeMenuIds.GARDEN_WATER]: menus => this.sendWaterAction(ctx, menus),
			[HomeMenuIds.GARDEN_COMPOST]: async menus => {
				this.registerCompostMenu(ctx, menus);
				await menus.changeMenu(HomeMenuIds.GARDEN_COMPOST_MENU);
			},
			[HomeMenuIds.GARDEN_COMPOST_CANCEL]: menus => menus.changeMenu(HomeMenuIds.GARDEN_MENU),
			[HomeMenuIds.GARDEN_COMPOST_CONFIRM_CANCEL]: menus => menus.changeMenu(HomeMenuIds.GARDEN_COMPOST_MENU)
		};
		if (exact[selectedValue]) {
			return exact[selectedValue];
		}

		if (selectedValue.startsWith(HomeMenuIds.GARDEN_PLANT_PREFIX)) {
			return menus => this.sendPlantAction(ctx, -1, menus);
		}

		if (selectedValue.startsWith(HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX)) {
			const plantId = Number(selectedValue.slice(HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX.length)) as PlantId;
			return async menus => {
				this.registerCompostConfirmMenu(ctx, plantId, menus);
				await menus.changeMenu(HomeMenuIds.GARDEN_COMPOST_CONFIRM_MENU);
			};
		}

		const compostConfirm = this.parseCompostConfirmCustomId(selectedValue);
		if (compostConfirm) {
			return async menus => {
				this.sendCompostReaction(ctx, compostConfirm.plantId, compostConfirm.quantity, componentInteraction);
				await menus.stopCurrentCollector();
			};
		}

		return null;
	}

	private parseCompostConfirmCustomId(selectedValue: string): CompostConfirmCustomId | null {
		for (const quantity of GardenConstants.COMPOST_QUANTITIES) {
			const prefix = `${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}${quantity}_`;
			if (selectedValue.startsWith(prefix)) {
				return {
					plantId: Number(selectedValue.slice(prefix.length)) as PlantId,
					quantity
				};
			}
		}
		return null;
	}

	/**
	 * Build the garden main view description
	 */
	private buildGardenDescription(ctx: HomeFeatureHandlerContext): string {
		const garden = ctx.homeData.garden!;
		return StringUtils.joinParagraphs([
			i18n.t("commands:report.city.homes.garden.description", { lng: ctx.lng }),
			garden.plots.map(plot => this.buildPlotDescription(plot, ctx)).join("\n"),
			this.buildSeedDescription(garden, ctx),
			this.buildWaterCooldownDescription(garden, ctx)
		]);
	}

	private buildSeedDescription(garden: GardenData, ctx: HomeFeatureHandlerContext): string | null {
		if (!this.hasSeedToPlant(garden)) {
			return null;
		}

		return i18n.t("commands:report.city.homes.garden.hasSeed", {
			lng: ctx.lng,
			plantId: garden.seedPlantId
		});
	}

	private hasSeedToPlant(garden: GardenData): boolean {
		if (!garden.hasSeed) {
			return false;
		}
		return garden.seedPlantId !== 0;
	}

	private buildWaterCooldownDescription(garden: GardenData, ctx: HomeFeatureHandlerContext): string | null {
		const wateringAvailableAt = this.getActiveWaterCooldownAvailableAt(garden);
		if (wateringAvailableAt === null) {
			return null;
		}

		return i18n.t("commands:report.city.homes.garden.waterCooldown", {
			lng: ctx.lng,
			timeLeft: printTimeBeforeDate(wateringAvailableAt)
		});
	}

	private getActiveWaterCooldownAvailableAt(garden: GardenData): number | null {
		if (garden.accessMode !== GardenAccessMode.FULL) {
			return null;
		}

		const wateringAvailableAt = garden.wateringAvailableAt;
		if (wateringAvailableAt === null) {
			return null;
		}

		return wateringAvailableAt > Date.now() ? wateringAvailableAt : null;
	}

	/**
	 * Build description for a single garden plot
	 */
	private buildPlotDescription(plot: GardenPlotData, ctx: HomeFeatureHandlerContext): string {
		if (plot.plantId === 0) {
			return i18n.t("commands:report.city.homes.garden.emptyPlot", {
				lng: ctx.lng,
				slot: plot.slot + 1
			});
		}
		if (plot.isReady) {
			return i18n.t("commands:report.city.homes.garden.readyPlot", {
				lng: ctx.lng,
				slot: plot.slot + 1,
				plantId: plot.plantId
			});
		}
		const progress = Math.floor(plot.growthProgress * 100);
		return i18n.t("commands:report.city.homes.garden.growingPlot", {
			lng: ctx.lng,
			slot: plot.slot + 1,
			plantId: plot.plantId,
			progress,
			readyAtTimestamp: plot.readyAtTimestamp
		});
	}

	/**
	 * Build buttons for the garden main view
	 */
	private addGardenButtons(ctx: HomeFeatureHandlerContext, container: ContainerBuilder): void {
		const garden = ctx.homeData.garden!;
		const buttons: ButtonBuilder[] = [
			this.buildHarvestButton(ctx, garden),
			...this.buildPlantButtons(ctx, garden),
			...this.buildWaterButtons(ctx, garden),
			...this.buildCompostButtons(ctx, garden),
			this.buildStorageButton(ctx, garden),
			this.buildExitButton(ctx, garden)
		];

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		for (let i = 0; i < buttons.length; i += GardenFeatureHandler.MAX_BUTTONS_PER_ROW) {
			container.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					...buttons.slice(i, i + GardenFeatureHandler.MAX_BUTTONS_PER_ROW)
				)
			);
		}
	}

	private buildHarvestButton(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(HomeMenuIds.GARDEN_HARVEST)
			.setLabel(i18n.t("commands:report.city.homes.garden.harvestButton", { lng: ctx.lng }))
			.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.garden)!)
			.setStyle(ButtonStyle.Success)
			.setDisabled(!garden.eligibility.canHarvest);
	}

	private buildPlantButtons(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder[] {
		if (!garden.eligibility.canPlantSeed) {
			return [];
		}

		return [
			new ButtonBuilder()
				.setCustomId(`${HomeMenuIds.GARDEN_PLANT_PREFIX}auto`)
				.setLabel(i18n.t("commands:report.city.homes.garden.plantButton", { lng: ctx.lng }))
				.setStyle(ButtonStyle.Primary)
		];
	}

	private buildWaterButtons(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder[] {
		if (this.isReadOnlyGarden(garden)) {
			return [];
		}

		return [
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_WATER)
				.setLabel(i18n.t("commands:report.city.homes.garden.waterButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.water)!)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!garden.eligibility.canWaterGarden)
		];
	}

	private buildCompostButtons(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder[] {
		if (!garden.eligibility.canCompost) {
			return [];
		}

		return [
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.GARDEN_COMPOST)
				.setLabel(i18n.t("commands:report.city.homes.garden.compost.button", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.compost)!)
				.setStyle(ButtonStyle.Secondary)
		];
	}

	private buildStorageButton(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder {
		const totalStored = garden.plantStorage.reduce((sum, storage) => sum + storage.quantity, 0);
		return new ButtonBuilder()
			.setCustomId(HomeMenuIds.GARDEN_STORAGE)
			.setLabel(i18n.t("commands:report.city.homes.garden.storageButton", {
				lng: ctx.lng,
				count: totalStored
			}))
			.setStyle(ButtonStyle.Secondary);
	}

	private buildExitButton(ctx: HomeFeatureHandlerContext, garden: GardenData): ButtonBuilder {
		if (this.isReadOnlyGarden(garden)) {
			return this.buildPutAwayTalismanButton(ctx);
		}
		if (this.isGardenOnlyContext(ctx)) {
			return this.buildCloseGardenButton(ctx);
		}
		return this.buildBackToHomeButton(ctx);
	}

	private buildPutAwayTalismanButton(ctx: HomeFeatureHandlerContext): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN)
			.setLabel(i18n.t("commands:report.city.homes.garden.putAwayTalisman", { lng: ctx.lng }))
			.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.remoteHarvestTalisman)!)
			.setStyle(ButtonStyle.Danger);
	}

	private buildCloseGardenButton(ctx: HomeFeatureHandlerContext): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(HomeMenuIds.GARDEN_PUT_AWAY_TALISMAN)
			.setLabel(i18n.t("commands:report.city.homes.garden.closeGarden", { lng: ctx.lng }))
			.setEmoji(CrowniclesIcons.collectors.refuse)
			.setStyle(ButtonStyle.Danger);
	}

	private buildBackToHomeButton(ctx: HomeFeatureHandlerContext): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(HomeMenuIds.BACK_TO_HOME)
			.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
			.setEmoji(CrowniclesIcons.collectors.back)
			.setStyle(ButtonStyle.Danger);
	}

	private isGardenOnlyContext(ctx: HomeFeatureHandlerContext): boolean {
		return (ctx.packet.data.data as ReactionCollectorCityData).gardenOnly === true;
	}

	private isReadOnlyGarden(garden: GardenData): boolean {
		return garden.accessMode === GardenAccessMode.READ_ONLY;
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createGardenCollector(ctx: HomeFeatureHandlerContext): ReturnType<typeof createHomeFeatureCollector> {
		return createHomeFeatureCollector(this, ctx);
	}

	private sendRefuseReaction(ctx: HomeFeatureHandlerContext, componentInteraction: ComponentInteraction | null): void {
		const reactionIndex = ctx.packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, componentInteraction, reactionIndex);
		}
	}

	private buildGardenContainer(ctx: HomeFeatureHandlerContext, extraMessage = ""): ContainerBuilder {
		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.joinParagraphs([
				this.buildGardenDescription(ctx),
				extraMessage
			]))
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

		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(this.buildStorageDescription(garden, ctx))
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
	 * Register the compost plant-selection sub-menu. Lists every plant type the
	 * player has in their home storage; clicking one opens the confirmation
	 * sub-menu for that plant.
	 */
	private registerCompostMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): void {
		const garden = ctx.homeData.garden!;
		const storedPlants = garden.plantStorage.filter(entry => entry.quantity > 0);

		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.joinParagraphs([
				i18n.t("commands:report.city.homes.garden.compost.selectTitle", { lng: ctx.lng }),
				this.buildStoredPlantsDescription(garden, ctx)
			]))
		);

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		const rows = this.buildCompostPlantRows(ctx, storedPlants);
		for (const row of rows) {
			container.addActionRowComponents(row);
		}
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				this.buildCompostCancelButton(ctx)
			)
		);

		nestedMenus.registerMenu(HomeMenuIds.GARDEN_COMPOST_MENU, {
			containers: [container],
			createCollector: this.createGardenCollector(ctx)
		});
	}

	private buildCompostPlantRows(
		ctx: HomeFeatureHandlerContext,
		storedPlants: GardenData["plantStorage"]
	): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		for (const entry of storedPlants) {
			if (rows.length === 0 || rows[rows.length - 1].components.length >= COMPOST_BUTTONS_PER_ROW) {
				rows.push(new ActionRowBuilder<ButtonBuilder>());
			}
			rows[rows.length - 1].addComponents(this.buildCompostPlantButton(ctx, entry));
			if (rows.length >= COMPOST_MAX_PLANT_ROWS) {
				break;
			}
		}
		return rows;
	}

	private buildCompostPlantButton(
		ctx: HomeFeatureHandlerContext,
		entry: GardenData["plantStorage"][number]
	): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(`${HomeMenuIds.GARDEN_COMPOST_SELECT_PREFIX}${entry.plantId}`)
			.setLabel(i18n.t("commands:report.city.homes.garden.compost.selectEntry", {
				lng: ctx.lng,
				plantId: entry.plantId,
				quantity: entry.quantity
			}))
			.setStyle(ButtonStyle.Secondary);
	}

	/**
	 * Register the compost confirmation sub-menu for a specific plant.
	 * Always shows "Annuler" and "Composter 1"; "Composter 5" is hidden when
	 * the storage holds fewer than 5 plants of the selected type.
	 */
	private registerCompostConfirmMenu(
		ctx: HomeFeatureHandlerContext,
		plantId: PlantId,
		nestedMenus: CrowniclesNestedMenus
	): void {
		const garden = ctx.homeData.garden!;
		const entry = garden.plantStorage.find(e => e.plantId === plantId);
		const storedQty = entry?.quantity ?? 0;
		const plant = PlantConstants.getPlantById(plantId);
		const materialsList = (plant?.compostMaterials ?? [])
			.map(materialId => i18n.t("commands:report.city.homes.garden.compost.confirmMaterialLine", {
				lng: ctx.lng,
				materialId
			}))
			.join("\n");

		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
		);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(i18n.t("commands:report.city.homes.garden.compost.confirmDescription", {
				lng: ctx.lng,
				plantId,
				quantity: storedQty,
				materialsList
			}))
		);

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				...this.buildCompostConfirmButtons(ctx, plantId, storedQty)
			)
		);

		nestedMenus.registerMenu(HomeMenuIds.GARDEN_COMPOST_CONFIRM_MENU, {
			containers: [container],
			createCollector: this.createGardenCollector(ctx)
		});
	}

	private buildCompostConfirmButtons(
		ctx: HomeFeatureHandlerContext,
		plantId: PlantId,
		storedQty: number
	): ButtonBuilder[] {
		const buttons: ButtonBuilder[] = [this.buildCompostCancelButton(ctx, HomeMenuIds.GARDEN_COMPOST_CONFIRM_CANCEL)];
		for (const quantity of GardenConstants.COMPOST_QUANTITIES) {
			if (storedQty >= quantity) {
				buttons.push(new ButtonBuilder()
					.setCustomId(`${HomeMenuIds.GARDEN_COMPOST_CONFIRM_PREFIX}${quantity}_${plantId}`)
					.setLabel(i18n.t("commands:report.city.homes.garden.compost.confirmButton", {
						lng: ctx.lng,
						quantity
					}))
					.setEmoji(parseEmoji(CrowniclesIcons.city.gardenStatus.compost)!)
					.setStyle(ButtonStyle.Success));
			}
		}
		return buttons;
	}

	private buildCompostCancelButton(ctx: HomeFeatureHandlerContext, customId: string = HomeMenuIds.GARDEN_COMPOST_CANCEL): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId(customId)
			.setLabel(i18n.t("commands:report.city.homes.garden.compost.cancelButton", { lng: ctx.lng }))
			.setEmoji(CrowniclesIcons.collectors.back)
			.setStyle(ButtonStyle.Secondary);
	}

	/**
	 * Forward the player's compost confirmation to Core via the city collector.
	 * Picks the pre-emitted reaction matching (plantId, quantity); the Core
	 * handler re-validates the storage under a row lock before granting
	 * materials. The collector terminates the `/rapport` flow on success.
	 */
	private sendCompostReaction(
		ctx: HomeFeatureHandlerContext,
		plantId: PlantId,
		quantity: number,
		componentInteraction: ComponentInteraction
	): void {
		const reactionIndex = ctx.packet.reactions.findIndex(reaction => {
			if (reaction.type !== ReactionCollectorGardenCompostReaction.name) {
				return false;
			}
			const data = reaction.data as ReactionCollectorGardenCompostReaction;
			return data.plantId === plantId && data.quantity === quantity;
		});
		if (reactionIndex === -1) {
			return;
		}
		DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, componentInteraction, reactionIndex);
	}

	private buildStorageDescription(garden: GardenData, ctx: HomeFeatureHandlerContext): string {
		return StringUtils.joinParagraphs([
			i18n.t("commands:report.city.homes.garden.storageTitle", { lng: ctx.lng }),
			this.buildStoredPlantsDescription(garden, ctx)
		]);
	}

	private buildStoredPlantsDescription(garden: GardenData, ctx: HomeFeatureHandlerContext): string {
		const storedPlants = garden.plantStorage.filter(storage => storage.quantity > 0);
		if (storedPlants.length === 0) {
			return i18n.t("commands:report.city.homes.garden.storageEmpty", { lng: ctx.lng });
		}

		return storedPlants
			.map(storage => i18n.t("commands:report.city.homes.garden.storageEntry", {
				lng: ctx.lng,
				plantId: storage.plantId,
				quantity: storage.quantity,
				maxCapacity: storage.maxCapacity
			}))
			.join("\n");
	}

	/**
	 * Compute the effective growth time (in seconds) for a plant in a slot
	 */
	private computeEffectiveGrowthTime(plantId: PlantId | 0, earthQuality: GardenEarthQuality): number {
		const plant = PlantConstants.getPlantById(plantId);
		return plant
			? GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)
			: 0;
	}

	/**
	 * Compute the ready-at unix timestamp (seconds) for a freshly planted slot
	 */
	private computeReadyAtTimestamp(plantId: PlantId | 0, earthQuality: GardenEarthQuality): number {
		const effectiveGrowthTime = this.computeEffectiveGrowthTime(plantId, earthQuality);
		if (effectiveGrowthTime === 0) {
			return 0;
		}
		return Math.ceil(Date.now() / TimeConstants.MS_TIME.SECOND) + effectiveGrowthTime;
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
				plot.readyAtTimestamp = this.computeReadyAtTimestamp(plot.plantId, ctx.homeData.features.gardenEarthQuality);
			}
		}
		garden.plantStorage = response.plantStorage;
	}

	/**
	 * Build a compost result notification string from a harvest response
	 */
	private buildCompostMessage(response: CommandReportGardenHarvestRes, ctx: HomeFeatureHandlerContext): string {
		const compostResults = response.compostResults ?? [];
		if (compostResults.length === 0) {
			return "";
		}
		let message = i18n.t("commands:report.city.homes.garden.compostTitle", { lng: ctx.lng });
		for (const result of compostResults) {
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

				const response = responsePacket as CommandReportGardenHarvestRes;
				const garden = ctx.homeData.garden!;
				this.updateGardenAfterHarvest(garden, response, ctx);
				const compostMessage = this.buildCompostMessage(response, ctx);
				this.registerGardenMenu(ctx, nestedMenus, compostMessage);
				await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
			}
		);
	}

	/**
	 * Send a watering action to Core. On success, post a confirmation embed
	 * (like a shop purchase) then end the city interaction so the player has
	 * to redo /report to interact with the garden again. On cooldown or when
	 * no plants are growing, the menu is re-rendered with a short status
	 * message instead of throwing.
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
					const errorPacket = responsePacket as CommandReportGardenErrorRes;
					await this.handleWaterError(ctx, nestedMenus, errorPacket);
					return;
				}

				const response = responsePacket as CommandReportGardenWaterRes;
				const garden = ctx.homeData.garden!;
				this.updateGardenAfterWatering(garden, ctx, response);
				await this.sendWaterSuccessFollowup(ctx, response);
				this.sendRefuseReaction(ctx, null);
				await nestedMenus.stopCurrentCollector();
			}
		);
	}

	/**
	 * Post a watering success embed via followUp on the original report
	 * interaction, mirroring the shop purchase confirmation pattern.
	 */
	private async sendWaterSuccessFollowup(
		ctx: HomeFeatureHandlerContext,
		response: CommandReportGardenWaterRes
	): Promise<void> {
		const interactionRef = ctx.context.discord?.interaction;
		if (!interactionRef) {
			return;
		}
		const interaction = DiscordCache.getInteraction(interactionRef);
		if (!interaction) {
			return;
		}
		const wateredPlots = i18n.t("commands:report.city.homes.garden.wateredPlots", {
			lng: ctx.lng,
			count: response.slotsWatered
		});
		const description = i18n.t("commands:report.city.homes.garden.waterSuccess", {
			lng: ctx.lng,
			wateredPlots,
			slotsBecameReady: response.slotsBecameReady,
			count: response.slotsBecameReady
		});
		const payload = {
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:report.city.homes.garden.waterSuccessTitle", {
						lng: ctx.lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(description)
			]
		};
		await (interaction.replied ? interaction.followUp(payload) : interaction.reply(payload));
	}

	/**
	 * Render a watering error inline in the garden menu without leaving the view.
	 */
	private async handleWaterError(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		errorPacket: CommandReportGardenErrorRes
	): Promise<void> {
		const extraMessage = this.buildWaterErrorMessage(ctx, errorPacket);
		this.registerGardenMenu(ctx, nestedMenus, extraMessage);
		await nestedMenus.changeMenu(HomeMenuIds.GARDEN_MENU);
	}

	private buildWaterErrorMessage(ctx: HomeFeatureHandlerContext, errorPacket: CommandReportGardenErrorRes): string {
		if (this.isWateringCooldownError(errorPacket)) {
			ctx.homeData.garden!.wateringAvailableAt = errorPacket.availableAt;
			return i18n.t("commands:report.city.homes.garden.waterCooldownError", {
				lng: ctx.lng,
				timeLeft: printTimeBeforeDate(errorPacket.availableAt)
			});
		}

		if (errorPacket.error === GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER) {
			return i18n.t("commands:report.city.homes.garden.waterNothingToWater", { lng: ctx.lng });
		}

		return "";
	}

	private isWateringCooldownError(
		errorPacket: CommandReportGardenErrorRes
	): errorPacket is CommandReportGardenErrorRes & { availableAt: number } {
		if (errorPacket.error !== GardenConstants.GARDEN_ERRORS.WATERING_ON_COOLDOWN) {
			return false;
		}
		return errorPacket.availableAt !== undefined;
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
		const nowSeconds = Math.ceil(Date.now() / TimeConstants.MS_TIME.SECOND);
		for (const plot of garden.plots) {
			if (plot.plantId === 0 || plot.isReady) {
				continue;
			}
			const plant = PlantConstants.getPlantById(plot.plantId);
			const wateringAdvanceSeconds = plant?.wateringAdvanceSeconds ?? 0;
			if (wateringAdvanceSeconds <= 0) {
				continue;
			}
			const newReadyAt = plot.readyAtTimestamp - wateringAdvanceSeconds;
			const newRemaining = newReadyAt - nowSeconds;
			if (newRemaining <= 0) {
				plot.readyAtTimestamp = 0;
				plot.growthProgress = 1;
				plot.isReady = true;
			}
			else {
				plot.readyAtTimestamp = newReadyAt;
				const fullGrowth = this.computeEffectiveGrowthTime(plot.plantId, ctx.homeData.features.gardenEarthQuality);
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

				const response = responsePacket as CommandReportGardenPlantRes;

				// Update the garden data locally
				const garden = ctx.homeData.garden!;
				const plot = garden.plots.find(p => p.slot === response.gardenSlot);
				if (plot) {
					plot.plantId = response.plantId;
					plot.growthProgress = 0;
					plot.isReady = false;
					plot.readyAtTimestamp = this.computeReadyAtTimestamp(response.plantId, ctx.homeData.features.gardenEarthQuality);
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
