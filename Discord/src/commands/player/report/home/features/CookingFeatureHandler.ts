import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	ContainerBuilder, SectionBuilder, SeparatorBuilder,
	SeparatorSpacingSize, TextDisplayBuilder,
	parseEmoji
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import { createHomeFeatureCollector } from "../HomeCollectorUtils";
import i18n from "../../../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../../Lib/src/Language";
import {
	getCookingGrade, CookingOutputType, RECIPE_TYPE_OUTPUT_EMOJI, CookingGradeDefinition
} from "../../../../../../../Lib/src/constants/CookingConstants";
import { HomeMenuIds } from "../HomeMenuConstants";

import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import { makePacket } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCookingIgniteReq,
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
	CommandReportCookingOverheatRes,
	CommandReportCookingWoodConfirmReq,
	CommandReportCookingWoodConfirmRes,
	CommandReportCookingReviveReq,
	CommandReportCookingReviveRes,
	CommandReportCookingCraftReq,
	CommandReportCookingCraftRes,
	CommandReportCookingMenuReq,
	CommandReportCookingMenuRes,
	CommandReportCookingPinReq,
	CommandReportCookingPinRes,
	CommandReportCookingUnpinReq,
	CommandReportCookingUnpinRes,
	CookingCraftErrors,
	CookingSlotData,
	PinnedRecipeInfo,
	RecipeIngredients
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";
import { finishInTimeDisplay } from "../../../../../../../Lib/src/utils/TimeUtils";
import { PacketUtils } from "../../../../../utils/PacketUtils";
import { DiscordCollectorUtils } from "../../../../../utils/DiscordCollectorUtils";
import { ReactionCollectorRefuseReaction } from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";

interface CookingSessionState {
	currentSlots: CookingSlotData[];
	furnaceUsesRemaining: number;
	cookingGrade: string;
	cookingLevel: number;
	craftPending: boolean;
	pinnedRecipe?: PinnedRecipeInfo;
}

export class CookingFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = HomeMenuIds.FEATURE_COOKING;

	private readonly sessions = new Map<string, CookingSessionState>();

	private getState(ctx: HomeFeatureHandlerContext): CookingSessionState {
		let state = this.sessions.get(ctx.user.id);
		if (!state) {
			state = {
				currentSlots: [],
				furnaceUsesRemaining: 0,
				cookingGrade: getCookingGrade(0).id,
				cookingLevel: 0,
				craftPending: false
			};
			this.sessions.set(ctx.user.id, state);
		}
		return state;
	}

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		return ctx.homeData.features.cookingSlots > 0;
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		if (!this.isAvailable(ctx)) {
			return null;
		}

		const state = this.getState(ctx);
		return {
			label: i18n.t("commands:report.city.homes.cooking.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.cooking.menuDescription", {
				lng: ctx.lng,
				level: state.cookingLevel,
				grade: i18n.t(`models:cooking.grades.${state.cookingGrade}`, { lng: ctx.lng })
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.cooking,
			value: HomeMenuIds.COOKING_MENU,
			buttonLabel: i18n.t("commands:report.city.homes.cooking.buttonLabel", { lng: ctx.lng })
		};
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		if (!this.isAvailable(ctx)) {
			return [];
		}
		return [i18n.t("commands:report.city.homes.cooking.available", { lng: ctx.lng })];
	}

	public async handleFeatureSelection(
		ctx: HomeFeatureHandlerContext,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await componentInteraction.deferUpdate();
		await this.fetchAndShowCookingMenu(ctx, nestedMenus);
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		await componentInteraction.deferUpdate();

		if (await this.handleExactMenuAction(ctx, selectedValue, nestedMenus)) {
			return true;
		}

		return this.handlePrefixMenuAction(ctx, selectedValue, nestedMenus);
	}

	/**
	 * Handle exact-match menu actions using a lookup table
	 */
	private async handleExactMenuAction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const actions: Record<string, () => Promise<void>> = {
			[HomeMenuIds.BACK_TO_HOME]: () => nestedMenus.changeMenu(HomeMenuIds.HOME_MENU),
			[HomeMenuIds.COOKING_IGNITE]: () => this.sendIgniteAction(ctx, nestedMenus),
			[HomeMenuIds.COOKING_REVIVE]: () => this.sendReviveAction(ctx, nestedMenus),
			[HomeMenuIds.COOKING_WOOD_CONFIRM]: () => this.sendWoodConfirmResponse(ctx, true, nestedMenus),
			[HomeMenuIds.COOKING_WOOD_CANCEL]: () => this.sendWoodConfirmResponse(ctx, false, nestedMenus),
			[HomeMenuIds.COOKING_UNPIN]: () => this.sendUnpinAction(ctx, nestedMenus)
		};

		const action = actions[selectedValue];
		if (action) {
			await action();
			return true;
		}
		return false;
	}

	/**
	 * Handle prefix-based menu actions (craft, pin)
	 */
	private handlePrefixMenuAction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		if (selectedValue.startsWith(HomeMenuIds.COOKING_CRAFT_PREFIX)) {
			return this.handleCraftSelection(ctx, selectedValue, nestedMenus);
		}

		if (selectedValue.startsWith(HomeMenuIds.COOKING_PIN_PREFIX)) {
			return this.handlePinSelection(ctx, selectedValue, nestedMenus);
		}

		return Promise.resolve(false);
	}

	/**
	 * Handle craft slot selection from the ignited menu
	 */
	private async handleCraftSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		if (this.getState(ctx).craftPending) {
			return true;
		}
		const slotIndex = parseInt(selectedValue.replace(HomeMenuIds.COOKING_CRAFT_PREFIX, ""), 10);
		if (isNaN(slotIndex)) {
			return true;
		}
		await this.sendCraftAction(ctx, slotIndex, nestedMenus);
		return true;
	}

	/**
	 * Handle pin slot selection from the ignited menu
	 */
	private async handlePinSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const slotIndex = parseInt(selectedValue.replace(HomeMenuIds.COOKING_PIN_PREFIX, ""), 10);
		if (isNaN(slotIndex)) {
			return true;
		}
		const state = this.getState(ctx);
		const slot = state.currentSlots.find(s => s.slotIndex === slotIndex);
		if (!slot?.recipe || slot.recipe.isSecret) {
			return true;
		}
		await this.sendPinAction(ctx, slot.recipe.id, nestedMenus);
		return true;
	}

	/**
	 * Fetch cooking menu info (level, grade, pinned recipe) from Core and show the pre-ignite menu
	 */
	private async fetchAndShowCookingMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingMenuReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingMenuRes.name) {
					const response = responsePacket as unknown as CommandReportCookingMenuRes;
					const state = this.getState(ctx);
					state.cookingLevel = response.cookingLevel;
					state.cookingGrade = response.cookingGrade;
					state.pinnedRecipe = response.pinnedRecipe;
				}
				this.registerCookingMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send pin request to Core
	 */
	private async sendPinAction(ctx: HomeFeatureHandlerContext, recipeId: string, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingPinReq, { recipeId }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingPinRes.name) {
					const response = responsePacket as unknown as CommandReportCookingPinRes;
					const state = this.getState(ctx);
					state.pinnedRecipe = response.pinnedRecipe;
				}
				this.registerIgnitedMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send unpin request to Core
	 */
	private async sendUnpinAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingUnpinReq, {}),
			async (_responseContext, packetName) => {
				const state = this.getState(ctx);
				if (packetName === CommandReportCookingUnpinRes.name) {
					state.pinnedRecipe = undefined;
				}
				if (state.currentSlots.length > 0) {
					this.registerIgnitedMenu(ctx, nestedMenus);
				}
				else {
					this.registerCookingMenu(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Update local cooking state from an ignite/revive response
	 */
	private updateStateFromIgniteResponse(ctx: HomeFeatureHandlerContext, response: CommandReportCookingIgniteRes | CommandReportCookingReviveRes): void {
		const state = this.getState(ctx);
		state.currentSlots = response.slots;
		state.furnaceUsesRemaining = response.furnaceUsesRemaining;
		state.cookingGrade = response.cookingGrade;
		state.cookingLevel = response.cookingLevel;
	}

	/**
	 * Build the cooking main menu description
	 */
	private buildCookingDescription(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.cooking.description", {
			lng: ctx.lng,
			count: ctx.homeData.features.cookingSlots
		});
	}

	/**
	 * Build the ignited furnace header description (uses remaining + level + advice)
	 */
	private buildIgnitedDescription(ctx: HomeFeatureHandlerContext): string {
		const state = this.getState(ctx);
		const grade: CookingGradeDefinition = getCookingGrade(state.cookingLevel);
		let description = i18n.t("commands:report.city.homes.cooking.usesRemaining", {
			lng: ctx.lng,
			count: state.furnaceUsesRemaining
		});
		description += `\n${i18n.t("commands:report.city.homes.cooking.levelInfo", {
			lng: ctx.lng,
			level: state.cookingLevel,
			grade: i18n.t(`models:cooking.grades.${state.cookingGrade}`, { lng: ctx.lng }),
			maxLevel: grade.maxRecipeLevelWithoutPenalty
		})}`;
		return description;
	}

	/**
	 * Build a message indicating which wood was consumed (or saved)
	 */
	private buildWoodConsumedMessage(
		response: CommandReportCookingIgniteRes | CommandReportCookingReviveRes,
		ctx: HomeFeatureHandlerContext
	): string {
		const key = response.woodConsumed ? "woodConsumed" : "woodSaved";
		return `\n${i18n.t(`commands:report.city.homes.cooking.${key}`, {
			lng: ctx.lng,
			woodId: response.woodMaterialId
		})}`;
	}

	/**
	 * Build a human-readable ingredient list
	 */
	private buildIngredientsDescription(ingredients: RecipeIngredients, lng: Language): string {
		const parts: string[] = [];

		for (const plant of ingredients.plants) {
			const status = plant.playerHas >= plant.quantity ? ` ${CrowniclesIcons.collectors.accept}` : "";
			parts.push(i18n.t("commands:report.city.homes.cooking.ingredientPlant", {
				lng,
				plantId: plant.plantId,
				playerHas: plant.playerHas,
				quantity: plant.quantity
			}) + status);
		}

		for (const material of ingredients.materials) {
			const status = material.playerHas >= material.quantity ? ` ${CrowniclesIcons.collectors.accept}` : "";
			parts.push(i18n.t("commands:report.city.homes.cooking.ingredientMaterial", {
				lng,
				materialId: material.materialId,
				playerHas: material.playerHas,
				quantity: material.quantity
			}) + status);
		}

		return parts.join("\n");
	}

	/**
	 * Build buttons for the initial cooking menu (before ignite)
	 */
	private addCookingButtons(ctx: HomeFeatureHandlerContext, container: ContainerBuilder): void {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_IGNITE)
				.setLabel(i18n.t("commands:report.city.homes.cooking.igniteButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.cooking)!)
				.setStyle(ButtonStyle.Success)
		);

		const state = this.getState(ctx);
		if (state.pinnedRecipe) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(HomeMenuIds.COOKING_UNPIN)
					.setLabel(i18n.t("commands:report.city.homes.cooking.unpinButton", { lng: ctx.lng }))
					.setStyle(ButtonStyle.Secondary)
			);
		}

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.BACK_TO_HOME)
				.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Danger)
		);

		container.addActionRowComponents(row);
	}

	/**
	 * Build pinned recipe display for the pre-ignite menu
	 */
	private buildPinnedRecipeDisplay(ctx: HomeFeatureHandlerContext): string {
		const state = this.getState(ctx);
		if (!state.pinnedRecipe) {
			return "";
		}

		const recipeName = i18n.t(`models:cooking.recipes.${state.pinnedRecipe.recipeId}`, { lng: ctx.lng });
		const outputEmoji = RECIPE_TYPE_OUTPUT_EMOJI[state.pinnedRecipe.recipeType] ?? "";
		const ingredientsList = this.buildIngredientsDescription(state.pinnedRecipe.ingredients, ctx.lng);
		const readyStatus = state.pinnedRecipe.canCraft
			? i18n.t("commands:report.city.homes.cooking.pinnedReady", { lng: ctx.lng })
			: "";

		return `\n\n${i18n.t("commands:report.city.homes.cooking.pinnedRecipeTitle", {
			lng: ctx.lng,
			outputEmoji,
			recipe: recipeName,
			level: state.pinnedRecipe.level
		})}\n${ingredientsList}${readyStatus}`;
	}

	/**
	 * Build a V2 container for the pre-ignite cooking menu
	 */
	private buildCookingContainer(ctx: HomeFeatureHandlerContext, extraMessage = ""): ContainerBuilder {
		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### ${this.getSubMenuTitle(ctx, ctx.pseudo)}`)
		);
		const pinnedDisplay = this.buildPinnedRecipeDisplay(ctx);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(this.buildCookingDescription(ctx) + pinnedDisplay + extraMessage)
		);
		this.addCookingButtons(ctx, container);
		return container;
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createCookingCollector(ctx: HomeFeatureHandlerContext): ReturnType<typeof createHomeFeatureCollector> {
		return createHomeFeatureCollector(this, ctx, {
			onEnd: reason => {
				if (reason === "time") {
					this.sessions.delete(ctx.user.id);
				}
			}
		});
	}

	/**
	 * Register the cooking main menu (before ignite)
	 */
	private registerCookingMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): void {
		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			containers: [this.buildCookingContainer(ctx)],
			createCollector: this.createCookingCollector(ctx)
		});
	}

	/**
	 * Register the ignited furnace menu with slot recipes using Components V2
	 */
	private registerIgnitedMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, extraMessage = "", allDisabled = false): void {
		const container = this.buildIgnitedContainer(ctx, extraMessage, allDisabled);

		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			containers: [container],
			createCollector: allDisabled ? undefined : this.createCookingCollector(ctx)
		});
	}

	/**
	 * Build the V2 container for the ignited furnace
	 */
	private buildIgnitedContainer(ctx: HomeFeatureHandlerContext, extraMessage: string, allDisabled = false): ContainerBuilder {
		const container = new ContainerBuilder();

		// Title
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`### ${this.getSubMenuTitle(ctx, ctx.pseudo)}`
			)
		);

		// Furnace uses remaining + extra message
		let headerText = this.buildIgnitedDescription(ctx);
		if (extraMessage) {
			headerText += extraMessage;
		}
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(headerText)
		);

		// Build slot sections
		const state = this.getState(ctx);
		for (const slot of state.currentSlots) {
			container.addSeparatorComponents(
				new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
			);
			container.addSectionComponents(
				this.buildSlotSection(slot, ctx, allDisabled)
			);
		}

		// Bottom action row
		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
		);
		container.addActionRowComponents(this.buildIgnitedActionRow(ctx, allDisabled));

		return container;
	}

	/**
	 * Build a V2 Section for a single cooking slot with its craft button as accessory
	 */
	private buildSlotSection(slot: CookingSlotData, ctx: HomeFeatureHandlerContext, allDisabled = false): SectionBuilder {
		const section = new SectionBuilder();

		if (!slot.recipe) {
			return this.buildEmptySlotSection(section, slot, ctx);
		}

		const slotTitle = this.buildSlotTitle(slot.recipe, slot.slotIndex, ctx);
		const ingredientsList = this.buildIngredientsDescription(slot.recipe.ingredients, ctx.lng);
		section.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`${slotTitle}\n${ingredientsList}`)
		);
		section.setButtonAccessory(this.buildSlotAccessoryButton(slot, ctx, allDisabled));

		return section;
	}

	/**
	 * Build an empty slot section with a disabled craft button
	 */
	private buildEmptySlotSection(section: SectionBuilder, slot: CookingSlotData, ctx: HomeFeatureHandlerContext): SectionBuilder {
		const stationEmoji = CrowniclesIcons.cookingStations[slot.slotIndex] ?? CrowniclesIcons.city.homeUpgrades.cooking;
		const craftLabel = i18n.t(`commands:report.city.homes.cooking.craftButton.${slot.slotIndex}`, { lng: ctx.lng });
		section.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.homes.cooking.slotEmptyContent", {
					lng: ctx.lng,
					stationId: slot.slotIndex
				})
			)
		);
		section.setButtonAccessory(
			new ButtonBuilder()
				.setCustomId(`${HomeMenuIds.COOKING_CRAFT_PREFIX}${slot.slotIndex}`)
				.setLabel(craftLabel)
				.setEmoji(parseEmoji(stationEmoji)!)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(true)
		);
		return section;
	}

	/**
	 * Build the title line for a recipe slot
	 */
	private buildSlotTitle(recipe: NonNullable<CookingSlotData["recipe"]>, slotIndex: number, ctx: HomeFeatureHandlerContext): string {
		if (recipe.isSecret) {
			return i18n.t("commands:report.city.homes.cooking.slotSecretName", {
				lng: ctx.lng,
				stationId: slotIndex,
				level: recipe.level
			});
		}
		const recipeName = i18n.t(`models:cooking.recipes.${recipe.id}`, { lng: ctx.lng });
		const outputEmoji = RECIPE_TYPE_OUTPUT_EMOJI[recipe.recipeType] ?? "";
		return i18n.t("commands:report.city.homes.cooking.slotRecipeName", {
			lng: ctx.lng,
			stationId: slotIndex,
			outputEmoji,
			recipe: recipeName,
			level: recipe.level
		});
	}

	/**
	 * Build the appropriate button accessory for a recipe slot (craft, pin, or unpin)
	 */
	private buildSlotAccessoryButton(slot: CookingSlotData, ctx: HomeFeatureHandlerContext, allDisabled: boolean): ButtonBuilder {
		const recipe = slot.recipe!;
		const canShowPinButton = !recipe.canCraft && !recipe.isSecret && !allDisabled;

		if (canShowPinButton) {
			return this.buildPinOrUnpinButton(slot, ctx);
		}

		const stationEmoji = CrowniclesIcons.cookingStations[slot.slotIndex] ?? CrowniclesIcons.city.homeUpgrades.cooking;
		const craftLabel = i18n.t(`commands:report.city.homes.cooking.craftButton.${slot.slotIndex}`, { lng: ctx.lng });
		return new ButtonBuilder()
			.setCustomId(`${HomeMenuIds.COOKING_CRAFT_PREFIX}${slot.slotIndex}`)
			.setLabel(craftLabel)
			.setEmoji(parseEmoji(stationEmoji)!)
			.setStyle(recipe.canCraft && !allDisabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
			.setDisabled(!recipe.canCraft || allDisabled);
	}

	/**
	 * Build a pin or unpin button depending on whether the recipe is currently pinned
	 */
	private buildPinOrUnpinButton(slot: CookingSlotData, ctx: HomeFeatureHandlerContext): ButtonBuilder {
		const recipe = slot.recipe!;
		const isPinned = this.getState(ctx).pinnedRecipe?.recipeId === recipe.id;

		if (isPinned) {
			return new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_UNPIN)
				.setLabel(i18n.t("commands:report.city.homes.cooking.unpinButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.messages.pin)!)
				.setStyle(ButtonStyle.Success);
		}

		const recipeName = i18n.t(`models:cooking.recipes.${recipe.id}`, { lng: ctx.lng });
		return new ButtonBuilder()
			.setCustomId(`${HomeMenuIds.COOKING_PIN_PREFIX}${slot.slotIndex}`)
			.setLabel(recipeName.substring(0, 80))
			.setEmoji(parseEmoji(CrowniclesIcons.messages.pin)!)
			.setStyle(ButtonStyle.Secondary);
	}

	/**
	 * Build the bottom action row for the ignited menu (revive + back)
	 */
	private buildIgnitedActionRow(ctx: HomeFeatureHandlerContext, allDisabled = false): ActionRowBuilder<ButtonBuilder> {
		const row = new ActionRowBuilder<ButtonBuilder>();
		const state = this.getState(ctx);

		if (state.furnaceUsesRemaining > 0) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(HomeMenuIds.COOKING_REVIVE)
					.setLabel(i18n.t("commands:report.city.homes.cooking.reviveButton", { lng: ctx.lng }))
					.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.cooking)!)
					.setStyle(ButtonStyle.Success)
					.setDisabled(allDisabled)
			);
		}

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.BACK_TO_HOME)
				.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(allDisabled)
		);

		return row;
	}

	/**
	 * Send ignite request to Core
	 */
	private async sendIgniteAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await this.sendIgniteOrReviveAction(ctx, nestedMenus, false);
	}

	/**
	 * Send revive request to Core to re-roll recipes
	 */
	private async sendReviveAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await this.sendIgniteOrReviveAction(ctx, nestedMenus, true);
	}

	/**
	 * Shared logic for ignite and revive actions
	 */
	private async sendIgniteOrReviveAction(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		isRevive: boolean
	): Promise<void> {
		const reqPacket = isRevive ? CommandReportCookingReviveReq : CommandReportCookingIgniteReq;
		const resPacket = isRevive ? CommandReportCookingReviveRes : CommandReportCookingIgniteRes;

		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(reqPacket, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingNoWoodRes.name) {
					const noWoodMessage = `\n\n${i18n.t("commands:report.city.homes.cooking.noWood", { lng: ctx.lng })}`;
					if (isRevive) {
						this.registerIgnitedMenu(ctx, nestedMenus, noWoodMessage);
					}
					else {
						nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
							containers: [this.buildCookingContainer(ctx, noWoodMessage)],
							createCollector: this.createCookingCollector(ctx)
						});
					}
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === CommandReportCookingOverheatRes.name) {
					const response = responsePacket as unknown as CommandReportCookingOverheatRes;
					this.getState(ctx).furnaceUsesRemaining = 0;
					const overheatMessage = `\n\n${i18n.t("commands:report.city.homes.cooking.overheat", {
						lng: ctx.lng,
						time: finishInTimeDisplay(new Date(response.overheatUntil))
					})}`;
					nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
						containers: [this.buildCookingContainer(ctx, overheatMessage)],
						createCollector: this.createCookingCollector(ctx)
					});
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === CommandReportCookingWoodConfirmReq.name) {
					const response = responsePacket as unknown as CommandReportCookingWoodConfirmReq;
					this.registerWoodConfirmMenu(ctx, response, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === resPacket.name) {
					const response = responsePacket as unknown as CommandReportCookingIgniteRes | CommandReportCookingReviveRes;
					this.updateStateFromIgniteResponse(ctx, response);
					this.registerIgnitedMenu(ctx, nestedMenus, this.buildWoodConsumedMessage(response, ctx));
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
				}
			}
		);
	}

	/**
	 * Register the wood confirmation prompt menu using V2 container
	 */
	private registerWoodConfirmMenu(
		ctx: HomeFeatureHandlerContext,
		woodInfo: CommandReportCookingWoodConfirmReq,
		nestedMenus: CrowniclesNestedMenus
	): void {
		const description = i18n.t("commands:report.city.homes.cooking.woodConfirm", {
			lng: ctx.lng,
			materialId: woodInfo.woodMaterialId,
			rarity: woodInfo.woodRarity
		});

		const container = new ContainerBuilder();

		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### ${this.getSubMenuTitle(ctx, ctx.pseudo)}`)
		);

		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(description)
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
		);

		const actionRow = new ActionRowBuilder<ButtonBuilder>();
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_WOOD_CONFIRM)
				.setLabel(i18n.t("commands:report.city.homes.cooking.confirmButton", { lng: ctx.lng }))
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_WOOD_CANCEL)
				.setLabel(i18n.t("commands:report.city.homes.cooking.cancelButton", { lng: ctx.lng }))
				.setStyle(ButtonStyle.Danger)
		);
		container.addActionRowComponents(actionRow);

		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			containers: [container],
			createCollector: this.createCookingCollector(ctx)
		});
	}

	/**
	 * Send wood confirmation response to Core
	 */
	private async sendWoodConfirmResponse(
		ctx: HomeFeatureHandlerContext,
		accepted: boolean,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		if (!accepted) {
			// Fire-and-forget: Core returns no response on cancel, no callback needed
			PacketUtils.sendPacketToBackend(ctx.context, makePacket(CommandReportCookingWoodConfirmRes, { accepted: false }));
			if (this.getState(ctx).currentSlots.length > 0) {
				this.registerIgnitedMenu(ctx, nestedMenus);
			}
			else {
				this.registerCookingMenu(ctx, nestedMenus);
			}
			await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			return;
		}

		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingWoodConfirmRes, { accepted }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingIgniteRes.name || packetName === CommandReportCookingReviveRes.name) {
					const response = responsePacket as unknown as CommandReportCookingIgniteRes | CommandReportCookingReviveRes;
					this.updateStateFromIgniteResponse(ctx, response);
					this.registerIgnitedMenu(ctx, nestedMenus, this.buildWoodConsumedMessage(response, ctx));
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				this.registerCookingMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Update local cooking state from a craft response
	 */
	private updateStateFromCraftResponse(state: CookingSessionState, response: CommandReportCookingCraftRes): void {
		if (response.updatedSlots) {
			state.currentSlots = response.updatedSlots;
		}

		if (response.furnaceUsesRemaining !== undefined) {
			state.furnaceUsesRemaining = response.furnaceUsesRemaining;
		}

		if (response.cookingLevelUp && response.newCookingLevel !== undefined) {
			state.cookingLevel = response.newCookingLevel;
			if (response.newCookingGrade !== undefined) {
				state.cookingGrade = response.newCookingGrade;
			}
		}
	}

	/**
	 * Send craft result as a followup reply and release the player
	 */
	private async sendCraftFollowup(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		craftResult: string,
		levelUpEmbed?: CrowniclesEmbed
	): Promise<void> {
		this.registerIgnitedMenu(ctx, nestedMenus, "", true);
		await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);

		const message = nestedMenus.message;
		if (message) {
			await message.reply({ content: craftResult });
			if (levelUpEmbed) {
				await message.reply({ embeds: [levelUpEmbed] });
			}
		}

		this.sessions.delete(ctx.user.id);

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorRefuseReaction.name
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, null, reactionIndex);
		}
	}

	/**
	 * Send craft request for a specific slot
	 */
	private async sendCraftAction(
		ctx: HomeFeatureHandlerContext,
		slotIndex: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const state = this.getState(ctx);
		state.craftPending = true;
		try {
			await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
				ctx.context,
				makePacket(CommandReportCookingCraftReq, { slotIndex }),
				async (_responseContext, packetName, responsePacket) => {
					if (packetName !== CommandReportCookingCraftRes.name) {
						return;
					}

					const response = responsePacket as unknown as CommandReportCookingCraftRes;
					this.updateStateFromCraftResponse(state, response);

					const {
						craftResult,
						levelUpEmbed
					} = this.buildCraftResultMessages(response, ctx);

					await this.sendCraftFollowup(ctx, nestedMenus, craftResult, levelUpEmbed);
				}
			);
		}
		finally {
			state.craftPending = false;
		}
	}

	private static readonly CRAFT_ERROR_KEYS: Record<string, string> = {
		[CookingCraftErrors.CRAFT_UNAVAILABLE]: "craftUnavailable",
		[CookingCraftErrors.INVENTORY_FULL]: "inventoryFull",
		[CookingCraftErrors.GUILD_REQUIRED]: "guildRequired",
		[CookingCraftErrors.GUILD_STORAGE_FULL]: "guildStorageFull"
	};

	/**
	 * Build the craft result notification message and optional level-up embed
	 */
	private buildCraftResultMessages(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): {
		craftResult: string;
		levelUpEmbed?: CrowniclesEmbed;
	} {
		if (response.error) {
			const errorKey = CookingFeatureHandler.CRAFT_ERROR_KEYS[response.error];
			if (errorKey) {
				return { craftResult: i18n.t(`commands:report.city.homes.cooking.${errorKey}`, { lng: ctx.lng }) };
			}
			return { craftResult: i18n.t("commands:report.city.homes.cooking.craftUnavailable", { lng: ctx.lng }) };
		}

		let message = this.buildCraftBaseMessage(response, ctx);
		message += this.buildCraftOutputMessage(response, ctx);
		message += this.buildDiscoveredRecipesMessage(response, ctx);

		return {
			craftResult: message,
			levelUpEmbed: this.buildLevelUpEmbed(response, ctx)
		};
	}

	/**
	 * Build the base craft message (success/failure + XP + material saved)
	 */
	private buildCraftBaseMessage(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): string {
		const recipeName = i18n.t(`models:cooking.recipes.${response.recipeId}`, { lng: ctx.lng });
		let message = response.success
			? i18n.t("commands:report.city.homes.cooking.craftSuccess", {
				lng: ctx.lng,
				recipe: recipeName,
				wasSecret: response.wasSecret
			})
			: i18n.t("commands:report.city.homes.cooking.craftFailure", {
				lng: ctx.lng,
				recipe: recipeName
			});

		message += `\n${i18n.t("commands:report.city.homes.cooking.xpGained", {
			lng: ctx.lng,
			xp: response.cookingXpGained
		})}`;

		if (response.materialSaved !== undefined) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.materialSaved", {
				lng: ctx.lng,
				materialId: response.materialSaved
			})}`;
		}

		return message;
	}

	/**
	 * Build the craft output message (pet food or material)
	 */
	private buildCraftOutputMessage(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): string {
		if (response.outputType === CookingOutputType.PET_FOOD && response.petFood !== undefined) {
			return this.buildPetFoodMessage(response.petFood, ctx);
		}

		if (response.outputType === CookingOutputType.MATERIAL && response.material !== undefined) {
			return `\n${i18n.t("commands:report.city.homes.cooking.materialCrafted", {
				lng: ctx.lng,
				quantity: response.material.quantity,
				materialId: response.material.materialId
			})}`;
		}

		return "";
	}

	/**
	 * Build the pet food output message
	 */
	private buildPetFoodMessage(petFood: NonNullable<CommandReportCookingCraftRes["petFood"]>, ctx: HomeFeatureHandlerContext): string {
		let message = "";
		const foodName = i18n.t(`models:foods.${petFood.type}`, {
			lng: ctx.lng,
			count: petFood.storedQuantity
		});

		if (petFood.storedQuantity > 0) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.petFoodStored", {
				lng: ctx.lng,
				quantity: petFood.storedQuantity,
				food: foodName
			})}`;
		}

		if (petFood.fedFromSurplus) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.petFedFromSurplus", {
				lng: ctx.lng,
				food: foodName
			})}`;
		}

		if (petFood.surplusMaterialId !== undefined && petFood.surplusMaterialQuantity !== undefined) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.surplusRecycled", {
				lng: ctx.lng,
				quantity: petFood.surplusMaterialQuantity,
				materialId: petFood.surplusMaterialId
			})}`;
		}

		return message;
	}

	/**
	 * Build the discovered recipes message
	 */
	private buildDiscoveredRecipesMessage(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): string {
		if (!response.discoveredRecipeIds || response.discoveredRecipeIds.length === 0) {
			return "";
		}

		if (response.discoveredRecipeIds.length === 1) {
			return `\n${i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {
				lng: ctx.lng,
				recipe: i18n.t(`models:cooking.recipes.${response.discoveredRecipeIds[0]}`, { lng: ctx.lng })
			})}`;
		}

		const recipeNames = response.discoveredRecipeIds
			.map(id => `**${i18n.t(`models:cooking.recipes.${id}`, { lng: ctx.lng })}**`)
			.join(", ");
		return `\n${i18n.t("commands:report.city.homes.cooking.recipesDiscovered", {
			lng: ctx.lng,
			recipes: recipeNames
		})}`;
	}

	/**
	 * Build the level-up embed if applicable
	 */
	private buildLevelUpEmbed(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): CrowniclesEmbed | undefined {
		if (!response.cookingLevelUp) {
			return undefined;
		}

		const description = response.newCookingGrade
			? i18n.t("commands:report.city.homes.cooking.levelUpWithGrade", {
				lng: ctx.lng,
				level: response.newCookingLevel,
				grade: i18n.t(`models:cooking.grades.${response.newCookingGrade}`, { lng: ctx.lng })
			})
			: i18n.t("commands:report.city.homes.cooking.levelUp", {
				lng: ctx.lng,
				level: response.newCookingLevel
			});

		return new CrowniclesEmbed()
			.setTitle(i18n.t("commands:report.city.homes.cooking.levelUpTitle", { lng: ctx.lng }))
			.setDescription(description);
	}

	public addSubMenuContainerContent(ctx: HomeFeatureHandlerContext, container: ContainerBuilder): void {
		this.addCookingButtons(ctx, container);
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		return this.buildCookingDescription(ctx);
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.cooking.title", {
			lng: ctx.lng, pseudo
		});
	}
}
