import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	ContainerBuilder, SectionBuilder, SeparatorBuilder,
	SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
	TextDisplayBuilder, parseEmoji
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import { createHomeFeatureCollector } from "../HomeCollectorUtils";
import i18n from "../../../../../translations/i18n";
import { StringUtils } from "../../../../../utils/StringUtils";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../../Lib/src/Language";
import {
	getCookingGrade, CookingOutputType, CookingGradeDefinition, getCookingSpecialtiesLimit, getNextCookingSpecialtyUnlockLevel,
	hasUnlockedCookingSpecialties, SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_CRAFT_LIMIT
} from "../../../../../../../Lib/src/constants/CookingConstants";
import { HomeMenuIds } from "../HomeMenuConstants";

import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCookingIgniteReq,
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
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
	CommandReportCookingSetSpecialtyReq,
	CommandReportCookingSetSpecialtyRes,
	CommandReportCookingRemoveSpecialtyReq,
	CommandReportCookingRemoveSpecialtyRes,
	CookingMenuSnapshot,
	CookingSlotData,
	CookingSpecialtyInfo,
	PinnedRecipeInfo,
	RecipeIngredients
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";
import { PacketUtils } from "../../../../../utils/PacketUtils";
import { DiscordCollectorUtils } from "../../../../../utils/DiscordCollectorUtils";
import { buildCustomId } from "../../../../../utils/CustomIdUtils";
import { buildRecipeDiscoveryMessage } from "../../../../../utils/CookingDisplayUtils";
import { ReactionCollectorRefuseReaction } from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import type { CookingRecipeId } from "../../../../../../../Lib/src/types/CookingRecipe";
import type { CookingCraftError } from "../../../../../../../Lib/src/types/CookingTypes";

/**
 * Cosmetic cache of the last menu state known to the client.
 *
 * Architecture (#4257): Core is the sole source of truth and every response
 * carries a full `CookingMenuSnapshot`. This cache is rebuilt from those
 * snapshots and is read in only two places where no Res is available:
 * - `getMenuOption` (label on the home select menu before the cooking
 * sub-menu is opened)
 * - Pin/Unpin requests, to inform Core which menu the user was viewing
 * so it can echo back a snapshot with the right `isIgnited` value.
 * It is NOT used to choose between pre-ignite / ignited render paths after
 * a Res — `snapshot.isIgnited` from the Res is always authoritative.
 */
interface CookingSessionState {
	currentSlots: CookingSlotData[];
	cookingGrade: string;
	cookingLevel: number;
	craftPending: boolean;
	isIgnited: boolean;
	pinnedRecipe?: PinnedRecipeInfo;
	specialties: CookingSpecialtyInfo[];
}

/**
 * Notice displayed under the description of a cooking menu
 */
interface CookingMenuNotice {
	text: string;

	// Separate the notice from the header with a blank line instead of a single line break
	asParagraph?: boolean;
}

/**
 * A recipe offered on a given slot, as embedded in a craft button or a specialty option
 */
interface SlotRecipeSelection {
	slotIndex: number;
	recipeId: CookingRecipeId;
}

interface CookingCraftAnswer {
	context: PacketContext;
	packetName: string;
	packet: CrowniclesPacket;
}

export class CookingFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = HomeMenuIds.FEATURE_COOKING;

	private readonly sessions = new Map<string, CookingSessionState>();

	private getState(ctx: HomeFeatureHandlerContext): CookingSessionState {
		let state = this.sessions.get(ctx.user.id);
		if (!state) {
			const cookingLevel = ctx.homeData.cooking.level;
			state = {
				currentSlots: [],
				cookingGrade: getCookingGrade(cookingLevel).id,
				cookingLevel,
				craftPending: false,
				isIgnited: false,
				specialties: []
			};
			this.sessions.set(ctx.user.id, state);
		}
		return state;
	}

	/**
	 * Mirror the authoritative Core snapshot into the local cosmetic cache.
	 * Leaves `craftPending` untouched (transient double-click guard).
	 */
	private applySnapshot(ctx: HomeFeatureHandlerContext, snapshot: CookingMenuSnapshot): void {
		const state = this.getState(ctx);
		state.cookingLevel = snapshot.cookingLevel;
		state.cookingGrade = snapshot.cookingGrade;
		state.pinnedRecipe = snapshot.pinnedRecipe;
		state.specialties = snapshot.specialties ?? [];
		state.currentSlots = snapshot.currentSlots;
		state.isIgnited = snapshot.isIgnited;
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
		await DiscordCollectorUtils.deferUpdate(componentInteraction);
		await this.fetchAndShowCookingMenu(ctx, nestedMenus);
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		await DiscordCollectorUtils.deferUpdate(componentInteraction);

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
			[HomeMenuIds.BACK_TO_HOME]: () => {
				/*
				 * Explicit cleanup: the collector .stop() triggered by changeMenu
				 * fires onEnd with reason="user" which we intentionally ignore
				 * to preserve state across internal cooking sub-menus, so we
				 * must drop the session here to avoid leaking it indefinitely.
				 */
				this.sessions.delete(ctx.user.id);
				return nestedMenus.changeMenu(HomeMenuIds.HOME_MENU);
			},
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
	 * Handle prefix-based menu actions (craft, pin, specialties)
	 */
	private handlePrefixMenuAction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const prefixActions: [string, () => Promise<boolean>][] = [
			[HomeMenuIds.COOKING_CRAFT_PREFIX, (): Promise<boolean> => this.handleCraftSelection(ctx, selectedValue, nestedMenus)],
			[HomeMenuIds.COOKING_PIN_PREFIX, (): Promise<boolean> => this.handlePinSelection(ctx, selectedValue, nestedMenus)],
			[HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX, (): Promise<boolean> => this.handleSetSpecialtySelection(ctx, selectedValue, nestedMenus)],
			[HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX, (): Promise<boolean> => this.handleRemoveSpecialtySelection(ctx, selectedValue, nestedMenus)]
		];
		const prefixAction = prefixActions.find(([prefix]) => selectedValue.startsWith(prefix));
		return prefixAction ? prefixAction[1]() : Promise.resolve(false);
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
		const craftSelection = this.parseSlotRecipeSelection(selectedValue, HomeMenuIds.COOKING_CRAFT_PREFIX);
		if (!craftSelection) {
			/*
			 * Buttons rendered before the recipe ID was added use the legacy
			 * slot-only format. Refresh instead of crafting from a stale snapshot.
			 */
			await this.fetchAndShowCookingMenu(ctx, nestedMenus);
			return true;
		}
		await this.sendCraftAction(ctx, craftSelection, nestedMenus);
		return true;
	}

	/**
	 * Decode the immutable recipe identity embedded in a craft button or a specialty
	 * option. The recipe ID is part of the component payload rather than the cosmetic
	 * cache so a delayed Discord interaction remains bound to what the player saw.
	 */
	private parseSlotRecipeSelection(selectedValue: string, prefix: string): SlotRecipeSelection | null {
		const payload = selectedValue.slice(prefix.length);
		const selection = (/^(\d+):([^:]+)$/).exec(payload);
		if (!selection) {
			return null;
		}
		return {
			slotIndex: Number(selection[1]),
			recipeId: selection[2]
		};
	}

	/**
	 * Handle pin slot selection from the ignited menu
	 */
	private async handlePinSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const recipeId = selectedValue.slice(HomeMenuIds.COOKING_PIN_PREFIX.length);
		if (!recipeId) {
			return true;
		}
		await this.sendPinAction(ctx, recipeId, nestedMenus);
		return true;
	}

	/**
	 * Handle the specialty select option making a slot recipe a specialty
	 */
	private async handleSetSpecialtySelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const selection = this.parseSlotRecipeSelection(selectedValue, HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX);
		if (selection) {
			await this.sendSetSpecialtyAction(ctx, selection, nestedMenus);
		}
		return true;
	}

	/**
	 * Handle the specialty select option removing a specialty
	 */
	private async handleRemoveSpecialtySelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const recipeId = selectedValue.slice(HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX.length);
		if (recipeId) {
			await this.sendRemoveSpecialtyAction(ctx, recipeId, nestedMenus);
		}
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
				this.getState(ctx).craftPending = false;
				if (packetName === CommandReportCookingMenuRes.name) {
					const response = responsePacket as CommandReportCookingMenuRes;
					this.applySnapshot(ctx, response.menu);
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				else {
					this.registerCookingMenu(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send pin request to Core
	 */
	private async sendPinAction(ctx: HomeFeatureHandlerContext, recipeId: string, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		const fromIgnitedView = this.getState(ctx).isIgnited;
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingPinReq, {
				recipeId, fromIgnitedView
			}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingPinRes.name) {
					const response = responsePacket as CommandReportCookingPinRes;
					this.applySnapshot(ctx, response.menu);
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				else {
					// Fallback: re-render whatever menu the user was on.
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send unpin request to Core
	 */
	private async sendUnpinAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		const fromIgnitedView = this.getState(ctx).isIgnited;
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingUnpinReq, { fromIgnitedView }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingUnpinRes.name) {
					const response = responsePacket as CommandReportCookingUnpinRes;
					this.applySnapshot(ctx, response.menu);
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				else {
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send the request making a slot recipe a specialty to Core (only offered on the ignited menu)
	 */
	private async sendSetSpecialtyAction(ctx: HomeFeatureHandlerContext, selection: SlotRecipeSelection, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingSetSpecialtyReq, selection),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingSetSpecialtyRes.name) {
					const response = responsePacket as CommandReportCookingSetSpecialtyRes;
					this.applySnapshot(ctx, response.menu);
					const text = response.error
						? i18n.t(`commands:report.city.homes.cooking.${response.error}`, {
							lng: ctx.lng,
							max: getCookingSpecialtiesLimit(this.getState(ctx).cookingLevel)
						})
						: i18n.t("commands:report.city.homes.cooking.specialtyAdded", {
							lng: ctx.lng,
							recipeId: selection.recipeId
						});
					this.registerFromCurrentState(ctx, nestedMenus, { text });
				}
				else {
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send the request removing a specialty to Core
	 */
	private async sendRemoveSpecialtyAction(ctx: HomeFeatureHandlerContext, recipeId: CookingRecipeId, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingRemoveSpecialtyReq, {
				recipeId,
				fromIgnitedView: this.getState(ctx).isIgnited
			}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingRemoveSpecialtyRes.name) {
					const response = responsePacket as CommandReportCookingRemoveSpecialtyRes;
					this.applySnapshot(ctx, response.menu);
					this.registerFromCurrentState(ctx, nestedMenus, {
						text: i18n.t("commands:report.city.homes.cooking.specialtyRemoved", {
							lng: ctx.lng,
							recipeId
						})
					});
				}
				else {
					this.registerFromCurrentState(ctx, nestedMenus);
				}
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Register the pre-ignite or ignited menu according to the cached `isIgnited` flag,
	 * which `applySnapshot` keeps aligned with the Core snapshot.
	 */
	private registerFromCurrentState(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, notice?: CookingMenuNotice): void {
		if (this.getState(ctx).isIgnited) {
			this.registerIgnitedMenu(ctx, nestedMenus, notice);
		}
		else {
			this.registerCookingMenu(ctx, nestedMenus, notice);
		}
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
	 * Build the ignited furnace header description (level + advice)
	 */
	private buildIgnitedDescription(ctx: HomeFeatureHandlerContext): string {
		const state = this.getState(ctx);
		const grade: CookingGradeDefinition = getCookingGrade(state.cookingLevel);
		return i18n.t("commands:report.city.homes.cooking.levelInfo", {
			lng: ctx.lng,
			level: state.cookingLevel,
			grade: i18n.t(`models:cooking.grades.${state.cookingGrade}`, { lng: ctx.lng }),
			maxLevel: grade.maxRecipeLevelWithoutPenalty
		});
	}

	/**
	 * Build a message indicating which wood was consumed (or saved)
	 */
	private buildWoodConsumedMessage(
		response: CommandReportCookingIgniteRes | CommandReportCookingReviveRes,
		ctx: HomeFeatureHandlerContext
	): CookingMenuNotice {
		const key = response.woodConsumed ? "woodConsumed" : "woodSaved";
		return {
			text: i18n.t(`commands:report.city.homes.cooking.${key}`, {
				lng: ctx.lng,
				woodId: response.woodMaterialId
			})
		};
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

		const ingredientsList = this.buildIngredientsDescription(state.pinnedRecipe.ingredients, ctx.lng);
		const readyStatus = state.pinnedRecipe.canCraft
			? i18n.t("commands:report.city.homes.cooking.pinnedReady", { lng: ctx.lng })
			: "";

		return StringUtils.joinLines([
			i18n.t("commands:report.city.homes.cooking.pinnedRecipeTitle", {
				lng: ctx.lng,
				recipeId: state.pinnedRecipe.recipeId,
				recipeType: state.pinnedRecipe.recipeType,
				level: state.pinnedRecipe.level
			}),
			ingredientsList + readyStatus
		]);
	}

	/**
	 * Line announcing the cooking level unlocking the next specialty, null once they are all unlocked
	 */
	private buildNextSpecialtyUnlockLine(ctx: HomeFeatureHandlerContext): string | null {
		const nextUnlockLevel = getNextCookingSpecialtyUnlockLevel(this.getState(ctx).cookingLevel);
		return nextUnlockLevel === null
			? null
			: i18n.t("commands:report.city.homes.cooking.specialtyNextUnlock", {
				lng: ctx.lng,
				level: nextUnlockLevel
			});
	}

	/**
	 * Build the specialties block of the pre-ignite menu, empty while they are not unlocked
	 */
	private buildSpecialtiesDisplay(ctx: HomeFeatureHandlerContext): string {
		const state = this.getState(ctx);
		if (!hasUnlockedCookingSpecialties(state.cookingLevel)) {
			return "";
		}
		const specialtiesLimit = getCookingSpecialtiesLimit(state.cookingLevel);
		if (state.specialties.length === 0) {
			return StringUtils.joinLines([
				i18n.t("commands:report.city.homes.cooking.specialtiesNone", {
					lng: ctx.lng,
					count: specialtiesLimit
				}),
				this.buildNextSpecialtyUnlockLine(ctx)
			]);
		}
		return StringUtils.joinLines([
			i18n.t("commands:report.city.homes.cooking.specialtiesTitle", {
				lng: ctx.lng,
				current: state.specialties.length,
				max: specialtiesLimit
			}),
			...state.specialties.map(specialty => i18n.t("commands:report.city.homes.cooking.specialtyLine", {
				lng: ctx.lng,
				recipeId: specialty.recipeId,
				recipeType: specialty.recipeType,
				level: specialty.level
			}) + (specialty.canCraft ? ` ${CrowniclesIcons.collectors.accept}` : "")),
			this.buildNextSpecialtyUnlockLine(ctx)
		]);
	}

	/**
	 * Build the V2 container for the pre-ignite cooking menu
	 */
	private buildCookingContainer(ctx: HomeFeatureHandlerContext, notice?: CookingMenuNotice): ContainerBuilder {
		const container = new ContainerBuilder();
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
		);
		const description = StringUtils.joinParagraphs([
			this.buildCookingDescription(ctx),
			this.buildPinnedRecipeDisplay(ctx),
			this.buildSpecialtiesDisplay(ctx)
		]);
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(this.withNotice(description, notice))
		);
		this.addSpecialtySelect(ctx, container, false);
		this.addCookingButtons(ctx, container);
		return container;
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createCookingCollector(ctx: HomeFeatureHandlerContext): ReturnType<typeof createHomeFeatureCollector> {
		return createHomeFeatureCollector(this, ctx, {
			onEnd: reason => {
				/*
				 * Only clear session on real terminal end (timeout/idle), not on programmatic
				 * .stop() triggered by menu transitions (reason === "user"), which would wipe
				 * state mid-flow and break handlers that depend on currentSlots / pinnedRecipe.
				 */
				if (reason !== "user") {
					this.sessions.delete(ctx.user.id);
				}
			}
		});
	}

	/**
	 * Register the cooking main menu (before ignite)
	 */
	private registerCookingMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, notice?: CookingMenuNotice): void {
		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			containers: [this.buildCookingContainer(ctx, notice)],
			createCollector: this.createCookingCollector(ctx)
		});
	}

	/**
	 * Register the ignited furnace menu with slot recipes using Components V2
	 */
	private registerIgnitedMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, notice?: CookingMenuNotice, allDisabled = false): void {
		const container = this.buildIgnitedContainer(ctx, notice, allDisabled);

		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			containers: [container],
			createCollector: allDisabled ? undefined : this.createCookingCollector(ctx)
		});
	}

	/**
	 * Append the notice, if any, under a menu description
	 */
	private withNotice(description: string, notice: CookingMenuNotice | undefined): string {
		if (!notice) {
			return description;
		}
		return notice.asParagraph
			? StringUtils.joinParagraphs([description, notice.text])
			: StringUtils.joinLines([description, notice.text]);
	}

	/**
	 * Build the V2 container for the ignited furnace
	 */
	private buildIgnitedContainer(ctx: HomeFeatureHandlerContext, notice: CookingMenuNotice | undefined, allDisabled = false): ContainerBuilder {
		const container = new ContainerBuilder();

		// Title
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo))
			)
		);

		// Furnace uses remaining + notice
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(this.withNotice(this.buildIgnitedDescription(ctx), notice))
		);

		// Build slot sections. The specialty rows share a single separator: a full furnace must fit in Discord's 40 components
		const state = this.getState(ctx);
		state.currentSlots.forEach((slot, index) => {
			if (!this.isSpecialtySlot(slot) || !this.isSpecialtySlot(state.currentSlots[index - 1])) {
				container.addSeparatorComponents(
					new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
				);
			}
			container.addSectionComponents(
				this.buildSlotSection(slot, ctx, allDisabled)
			);
		});

		// Bottom action row
		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
		);
		if (!allDisabled) {
			this.addSpecialtySelect(ctx, container, true);
		}
		container.addActionRowComponents(this.buildIgnitedActionRow(ctx, allDisabled));

		return container;
	}

	private isSpecialtySlot(slot: CookingSlotData | undefined): boolean {
		return slot?.slotIndex === SPECIALTY_SLOT_INDEX;
	}

	private buildSpecialtyOptionLabel(recipeId: CookingRecipeId, level: number, ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.cooking.specialtyOptionLabel", {
			lng: ctx.lng,
			recipeId,
			level
		});
	}

	/**
	 * Options making a visible recipe of the rotating stations a specialty, while the limit is not reached
	 */
	private buildSetSpecialtyOptions(ctx: HomeFeatureHandlerContext): StringSelectMenuOptionBuilder[] {
		const state = this.getState(ctx);
		if (state.specialties.length >= getCookingSpecialtiesLimit(state.cookingLevel)) {
			return [];
		}
		return state.currentSlots
			.filter(slot => slot.recipe
				&& !slot.recipe.isSecret
				&& !this.isSpecialtySlot(slot))
			.map(slot => new StringSelectMenuOptionBuilder()
				.setLabel(this.buildSpecialtyOptionLabel(slot.recipe!.id, slot.recipe!.level, ctx))
				.setDescription(i18n.t("commands:report.city.homes.cooking.specialtySetDescription", { lng: ctx.lng }))
				.setValue(this.buildSlotRecipeCustomId(HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX, slot.slotIndex, slot.recipe!.id))
				.setEmoji(parseEmoji(CrowniclesIcons.cookingStations[SPECIALTY_SLOT_INDEX])!));
	}

	private buildRemoveSpecialtyOptions(ctx: HomeFeatureHandlerContext): StringSelectMenuOptionBuilder[] {
		return this.getState(ctx).specialties.map(specialty => new StringSelectMenuOptionBuilder()
			.setLabel(this.buildSpecialtyOptionLabel(specialty.recipeId, specialty.level, ctx))
			.setDescription(i18n.t("commands:report.city.homes.cooking.specialtyRemoveDescription", { lng: ctx.lng }))
			.setValue(buildCustomId(HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX, specialty.recipeId))
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!));
	}

	/**
	 * Add the select menu managing the specialties of a master chef. New specialties can only
	 * be chosen among the recipes of the ignited furnace, existing ones can be removed from both menus.
	 */
	private addSpecialtySelect(ctx: HomeFeatureHandlerContext, container: ContainerBuilder, fromIgnitedView: boolean): void {
		const state = this.getState(ctx);
		if (!hasUnlockedCookingSpecialties(state.cookingLevel)) {
			return;
		}
		const options = [
			...fromIgnitedView ? this.buildSetSpecialtyOptions(ctx) : [],
			...this.buildRemoveSpecialtyOptions(ctx)
		];
		if (options.length === 0) {
			return;
		}
		container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(HomeMenuIds.COOKING_SPECIALTY_SELECT)
				.setPlaceholder(i18n.t("commands:report.city.homes.cooking.specialtySelectPlaceholder", {
					lng: ctx.lng,
					current: state.specialties.length,
					max: getCookingSpecialtiesLimit(state.cookingLevel)
				}))
				.addOptions(options)
		));
	}

	/**
	 * Line telling how many time potions can still be cooked this week, only on time potion recipes.
	 * A secret recipe only gets it once the limit is reached, to explain why it can't be cooked.
	 */
	private buildTimePotionLine(recipe: NonNullable<CookingSlotData["recipe"]>, ctx: HomeFeatureHandlerContext): string | null {
		if (recipe.timePotionsLeftThisWeek === undefined) {
			return null;
		}
		if (recipe.timePotionsLeftThisWeek === 0) {
			return i18n.t("commands:report.city.homes.cooking.timePotionsExhausted", { lng: ctx.lng });
		}
		return recipe.isSecret
			? null
			: i18n.t("commands:report.city.homes.cooking.timePotionsLeft", {
				lng: ctx.lng,
				count: recipe.timePotionsLeftThisWeek
			});
	}

	/**
	 * Build a V2 Section for a single cooking slot with its craft button as accessory
	 */
	private buildSlotSection(slot: CookingSlotData, ctx: HomeFeatureHandlerContext, allDisabled = false): SectionBuilder {
		const section = new SectionBuilder();

		if (!slot.recipe) {
			return this.buildEmptySlotSection(section, slot, ctx);
		}

		const slotTitle = this.buildSlotTitle(slot, ctx);
		const ingredientsList = this.buildIngredientsDescription(slot.recipe.ingredients, ctx.lng);
		section.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.joinLines([
				slotTitle,
				this.buildTimePotionLine(slot.recipe, ctx),
				ingredientsList
			]))
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
				.setCustomId(buildCustomId(HomeMenuIds.COOKING_CRAFT_PREFIX, slot.slotIndex))
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
	private buildSlotTitle(slot: CookingSlotData, ctx: HomeFeatureHandlerContext): string {
		const recipe = slot.recipe!;
		if (recipe.isSecret) {
			return i18n.t("commands:report.city.homes.cooking.slotSecretName", {
				lng: ctx.lng,
				stationId: slot.slotIndex,
				level: recipe.level
			});
		}
		return i18n.t("commands:report.city.homes.cooking.slotRecipeName", {
			lng: ctx.lng,
			stationId: slot.slotIndex,
			recipeId: recipe.id,
			recipeType: recipe.recipeType,
			level: recipe.level
		});
	}

	/**
	 * The pin button replaces the craft button on a recipe the player can't cook yet, unless it is secret, a
	 * specialty (already offered at every ignition) or a time potion blocked until next week
	 */
	private canShowPinButton(slot: CookingSlotData, allDisabled: boolean): boolean {
		const recipe = slot.recipe!;
		return !recipe.canCraft
			&& !recipe.isSecret
			&& !allDisabled
			&& recipe.timePotionsLeftThisWeek !== 0
			&& !this.isSpecialtySlot(slot);
	}

	/**
	 * Build the appropriate button accessory for a recipe slot (craft, pin, or unpin)
	 */
	private buildSlotAccessoryButton(slot: CookingSlotData, ctx: HomeFeatureHandlerContext, allDisabled: boolean): ButtonBuilder {
		const recipe = slot.recipe!;

		if (this.canShowPinButton(slot, allDisabled)) {
			return this.buildPinOrUnpinButton(slot, ctx);
		}

		const stationEmoji = CrowniclesIcons.cookingStations[slot.slotIndex] ?? CrowniclesIcons.city.homeUpgrades.cooking;
		const craftLabel = i18n.t(`commands:report.city.homes.cooking.craftButton.${slot.slotIndex}`, { lng: ctx.lng });
		return new ButtonBuilder()
			.setCustomId(this.buildSlotRecipeCustomId(HomeMenuIds.COOKING_CRAFT_PREFIX, slot.slotIndex, recipe.id))
			.setLabel(craftLabel)
			.setEmoji(parseEmoji(stationEmoji)!)
			.setStyle(recipe.canCraft && !allDisabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
			.setDisabled(!recipe.canCraft || allDisabled);
	}

	/**
	 * Keep the slot and recipe in one custom-ID part because buildCustomId uses
	 * underscores to separate multiple parts.
	 */
	private buildSlotRecipeCustomId(prefix: string, slotIndex: number, recipeId: CookingRecipeId): string {
		return buildCustomId(prefix, `${slotIndex}:${recipeId}`);
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

		return new ButtonBuilder()
			.setCustomId(buildCustomId(HomeMenuIds.COOKING_PIN_PREFIX, recipe.id))
			.setLabel(i18n.t("commands:report.city.homes.cooking.pinButton", { lng: ctx.lng }))
			.setEmoji(parseEmoji(CrowniclesIcons.messages.pin)!)
			.setStyle(ButtonStyle.Secondary);
	}

	/**
	 * Build the bottom action row for the ignited menu (revive + back)
	 */
	private buildIgnitedActionRow(ctx: HomeFeatureHandlerContext, allDisabled = false): ActionRowBuilder<ButtonBuilder> {
		const row = new ActionRowBuilder<ButtonBuilder>();

		row.addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_REVIVE)
				.setLabel(i18n.t("commands:report.city.homes.cooking.reviveButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.cooking)!)
				.setStyle(ButtonStyle.Success)
				.setDisabled(allDisabled)
		);

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
					const noWoodNotice: CookingMenuNotice = {
						text: i18n.t("commands:report.city.homes.cooking.noWood", { lng: ctx.lng }),
						asParagraph: true
					};
					if (isRevive) {
						this.registerIgnitedMenu(ctx, nestedMenus, noWoodNotice);
					}
					else {
						this.registerCookingMenu(ctx, nestedMenus, noWoodNotice);
					}
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === CommandReportCookingWoodConfirmReq.name) {
					const response = responsePacket as CommandReportCookingWoodConfirmReq;
					this.registerWoodConfirmMenu(ctx, response, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === resPacket.name) {
					const response = responsePacket as CommandReportCookingIgniteRes | CommandReportCookingReviveRes;
					this.applySnapshot(ctx, response.menu);
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
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(this.getSubMenuTitle(ctx, ctx.pseudo)))
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
			this.registerFromCurrentState(ctx, nestedMenus);
			await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			return;
		}

		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingWoodConfirmRes, { accepted }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingIgniteRes.name || packetName === CommandReportCookingReviveRes.name) {
					const response = responsePacket as CommandReportCookingIgniteRes | CommandReportCookingReviveRes;
					this.applySnapshot(ctx, response.menu);
					this.registerIgnitedMenu(ctx, nestedMenus, this.buildWoodConsumedMessage(response, ctx));
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				this.registerFromCurrentState(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
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
		this.registerIgnitedMenu(ctx, nestedMenus, undefined, true);
		await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);

		const message = nestedMenus.message;
		if (message) {
			await message.reply({ content: craftResult });
			if (levelUpEmbed) {
				await message.reply({ embeds: [levelUpEmbed] });
			}
		}

		this.releaseCookingSession(ctx);
	}

	private releaseCookingSession(ctx: HomeFeatureHandlerContext): void {
		this.sessions.delete(ctx.user.id);

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorRefuseReaction.name
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, null, reactionIndex);
		}
	}

	/**
	 * Nothing was consumed and the furnace is still lit: show the refreshed recipes so the player can pick again
	 */
	private async showBlockedCraft(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, error: CookingCraftError): Promise<void> {
		// CookingCraftError values are themselves the i18n key suffixes
		this.registerIgnitedMenu(ctx, nestedMenus, {
			text: i18n.t(`commands:report.city.homes.cooking.${error}`, {
				lng: ctx.lng,
				limit: TIME_POTION_WEEKLY_CRAFT_LIMIT
			})
		});
		await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
	}

	/**
	 * The Core answered with something else than a craft result (e.g. an internal error): show it instead of
	 * swallowing it, and close the furnace like after a craft since its state is unknown
	 */
	private async handleUnexpectedCraftAnswer(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		answer: CookingCraftAnswer
	): Promise<void> {
		await DiscordMQTT.packetListener.getListener(answer.packetName)?.(answer.context, answer.packet);
		this.registerIgnitedMenu(ctx, nestedMenus, undefined, true);
		await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
		this.releaseCookingSession(ctx);
	}

	private async handleCraftAnswer(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus,
		answer: CookingCraftAnswer
	): Promise<void> {
		if (answer.packetName !== CommandReportCookingCraftRes.name) {
			await this.handleUnexpectedCraftAnswer(ctx, nestedMenus, answer);
			return;
		}

		const response = answer.packet as CommandReportCookingCraftRes;
		this.applySnapshot(ctx, response.menu);
		if (response.error) {
			await this.showBlockedCraft(ctx, nestedMenus, response.error);
			return;
		}

		await this.sendCraftFollowup(
			ctx,
			nestedMenus,
			this.buildCraftResultMessage(response, ctx),
			this.buildLevelUpEmbed(response, ctx)
		);
	}

	/**
	 * Send craft request for a specific slot
	 */
	private async sendCraftAction(
		ctx: HomeFeatureHandlerContext,
		craftSelection: SlotRecipeSelection,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const state = this.getState(ctx);
		state.craftPending = true;
		const releaseCraft = (): void => {
			state.craftPending = false;
		};

		// Sending resolves at once: hold the guard until the answer so a slow craft cannot be clicked twice
		try {
			await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
				ctx.context,
				makePacket(CommandReportCookingCraftReq, craftSelection),
				async (responseContext, packetName, responsePacket) => {
					// The old craft buttons stay clickable until the menu edit completes
					try {
						await this.handleCraftAnswer(ctx, nestedMenus, {
							context: responseContext,
							packetName,
							packet: responsePacket
						});
					}
					finally {
						releaseCraft();
					}
				},
				{ onTimeout: releaseCraft }
			);
		}
		catch (error) {
			releaseCraft();
			throw error;
		}
	}

	/**
	 * Build the craft result notification message
	 */
	private buildCraftResultMessage(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): string {
		return this.buildCraftBaseMessage(response, ctx)
			+ this.buildCraftOutputMessage(response, ctx)
			+ this.buildDiscoveredRecipesMessage(response, ctx)
			+ (response.masterChefBadgeEarned ? i18n.t("commands:report.city.homes.cooking.masterChefBadgeEarned", { lng: ctx.lng }) : "");
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

		if (response.bonusOutput) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.bonusOutput", {
				lng: ctx.lng
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
		const getFoodName = (count: number): string => i18n.t(`models:foods.${petFood.type}`, {
			lng: ctx.lng,
			count
		});

		if (petFood.storedQuantity > 0) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.petFoodStored", {
				lng: ctx.lng,
				count: petFood.storedQuantity,
				food: getFoodName(petFood.storedQuantity)
			})}`;
		}

		if (petFood.fedFromSurplus) {
			// The pet eats a single ration, whatever the stored quantity
			message += `\n${i18n.t("commands:report.city.homes.cooking.petFedFromSurplus", {
				lng: ctx.lng,
				food: getFoodName(1)
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
		const message = buildRecipeDiscoveryMessage(response.discoveredRecipes ?? [], ctx.lng);
		return message === "" ? "" : `\n${message}`;
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
			.formatAuthor(i18n.t("commands:report.city.homes.cooking.levelUpTitle", {
				lng: ctx.lng,
				pseudo: ctx.pseudo
			}), ctx.user)
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
