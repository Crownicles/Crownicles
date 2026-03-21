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
	CookingSlotData
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../../../../utils/ErrorUtils";
import { addButtonToRow } from "../../../../../utils/DiscordCollectorUtils";
import { finishInTimeDisplay } from "../../../../../../../Lib/src/utils/TimeUtils";

export class CookingFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = HomeMenuIds.FEATURE_COOKING;

	private currentSlots: CookingSlotData[] = [];

	private furnaceUsesRemaining = 0;

	private cookingGrade = "";

	private cookingLevel = 0;

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		return ctx.homeData.features.cookingSlots > 0;
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		if (!this.isAvailable(ctx)) {
			return null;
		}

		return {
			label: i18n.t("commands:report.city.homes.cooking.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.cooking.menuDescription", {
				lng: ctx.lng,
				level: this.cookingLevel,
				grade: i18n.t(`models:cooking.grades.${this.cookingGrade}`, { lng: ctx.lng })
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.cooking,
			value: HomeMenuIds.COOKING_MENU
		};
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		if (!this.isAvailable(ctx)) {
			return [];
		}
		return [i18n.t("commands:report.city.homes.cooking.available", { lng: ctx.lng })];
	}

	public async handleFeatureSelection(
		_ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await selectInteraction.deferUpdate();
		await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		if (selectedValue === HomeMenuIds.BACK_TO_HOME) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(HomeMenuIds.HOME_MENU);
			return true;
		}

		if (selectedValue === HomeMenuIds.COOKING_IGNITE) {
			await componentInteraction.deferUpdate();
			await this.sendIgniteAction(ctx, nestedMenus);
			return true;
		}

		if (selectedValue === HomeMenuIds.COOKING_REVIVE) {
			await componentInteraction.deferUpdate();
			await this.sendReviveAction(ctx, nestedMenus);
			return true;
		}

		if (selectedValue === HomeMenuIds.COOKING_WOOD_CONFIRM) {
			await componentInteraction.deferUpdate();
			await this.sendWoodConfirmResponse(ctx, true, nestedMenus);
			return true;
		}

		if (selectedValue === HomeMenuIds.COOKING_WOOD_CANCEL) {
			await componentInteraction.deferUpdate();
			await this.sendWoodConfirmResponse(ctx, false, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.COOKING_CRAFT_PREFIX)) {
			await componentInteraction.deferUpdate();
			const slotIndex = parseInt(selectedValue.replace(HomeMenuIds.COOKING_CRAFT_PREFIX, ""), 10);
			await this.sendCraftAction(ctx, slotIndex, nestedMenus);
			return true;
		}

		return false;
	}

	/**
	 * Update local cooking state from an ignite/revive response
	 */
	private updateStateFromIgniteResponse(response: CommandReportCookingIgniteRes | CommandReportCookingReviveRes): void {
		this.currentSlots = response.slots;
		this.furnaceUsesRemaining = response.furnaceUsesRemaining;
		this.cookingGrade = response.cookingGrade;
		this.cookingLevel = response.cookingLevel;
	}

	/**
	 * Build the cooking main menu description
	 */
	private buildCookingDescription(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.cooking.description", {
			lng: ctx.lng,
			slots: ctx.homeData.features.cookingSlots
		});
	}

	/**
	 * Build the ignited furnace description with slot details
	 */
	private buildIgnitedDescription(ctx: HomeFeatureHandlerContext): string {
		let description = i18n.t("commands:report.city.homes.cooking.usesRemaining", {
			lng: ctx.lng,
			count: this.furnaceUsesRemaining
		});
		description += "\n";

		for (const slot of this.currentSlots) {
			description += `\n${this.buildSlotDescription(slot, ctx)}`;
		}

		return description;
	}

	/**
	 * Build description for a single cooking slot
	 */
	private buildSlotDescription(slot: CookingSlotData, ctx: HomeFeatureHandlerContext): string {
		if (!slot.recipe) {
			return i18n.t("commands:report.city.homes.cooking.slotEmpty", {
				lng: ctx.lng,
				slot: slot.slotIndex + 1
			});
		}

		if (slot.recipe.isSecret) {
			return i18n.t("commands:report.city.homes.cooking.slotSecret", {
				lng: ctx.lng,
				slot: slot.slotIndex + 1
			});
		}

		const ingredientsList = this.buildIngredientsDescription(slot.recipe.ingredients, ctx.lng);
		return i18n.t("commands:report.city.homes.cooking.slotRecipe", {
			lng: ctx.lng,
			slot: slot.slotIndex + 1,
			recipe: slot.recipe.outputDescription,
			level: slot.recipe.level,
			ingredients: ingredientsList,
			canCraft: slot.recipe.canCraft
		});
	}

	/**
	 * Build a human-readable ingredient list
	 */
	private buildIngredientsDescription(ingredients: NonNullable<CookingSlotData["recipe"]>["ingredients"], lng: Language): string {
		const parts: string[] = [];

		for (const plant of ingredients.plants) {
			const plantName = i18n.t(`models:plants.${plant.plantId}`, { lng });
			const emoji = CrowniclesIcons.plants[plant.plantId];
			const status = plant.playerHas >= plant.quantity ? "✅" : "❌";
			parts.push(`${emoji} ${plantName} ${plant.playerHas}/${plant.quantity} ${status}`);
		}

		for (const material of ingredients.materials) {
			const materialName = i18n.t(`models:materials.${material.materialId}`, { lng });
			const emoji = CrowniclesIcons.materials[material.materialId as keyof typeof CrowniclesIcons.materials] ?? "🧱";
			const status = material.playerHas >= material.quantity ? "✅" : "❌";
			parts.push(`${emoji} ${materialName} ${material.playerHas}/${material.quantity} ${status}`);
		}

		return parts.join("\n");
	}

	/**
	 * Build buttons for the initial cooking menu (before ignite)
	 */
	private buildCookingButtons(ctx: HomeFeatureHandlerContext): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		rows[0].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_IGNITE)
				.setLabel(i18n.t("commands:report.city.homes.cooking.igniteButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.cooking)!)
				.setStyle(ButtonStyle.Success)
		);

		addButtonToRow(rows, new ButtonBuilder()
			.setCustomId(HomeMenuIds.BACK_TO_HOME)
			.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
			.setEmoji(CrowniclesIcons.collectors.back)
			.setStyle(ButtonStyle.Danger));

		return rows;
	}

	/**
	 * Build buttons for the ignited furnace (slot craft buttons + revive)
	 */
	private buildIgnitedButtons(ctx: HomeFeatureHandlerContext): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		for (const slot of this.currentSlots) {
			if (slot.recipe) {
				addButtonToRow(rows, new ButtonBuilder()
					.setCustomId(`${HomeMenuIds.COOKING_CRAFT_PREFIX}${slot.slotIndex}`)
					.setLabel(i18n.t("commands:report.city.homes.cooking.craftButton", {
						lng: ctx.lng,
						slot: slot.slotIndex + 1
					}))
					.setStyle(slot.recipe.canCraft ? ButtonStyle.Primary : ButtonStyle.Secondary)
					.setDisabled(!slot.recipe.canCraft));
			}
		}

		if (this.furnaceUsesRemaining > 0) {
			addButtonToRow(rows, new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_REVIVE)
				.setLabel(i18n.t("commands:report.city.homes.cooking.reviveButton", { lng: ctx.lng }))
				.setEmoji(parseEmoji(CrowniclesIcons.city.homeUpgrades.cooking)!)
				.setStyle(ButtonStyle.Success));
		}

		addButtonToRow(rows, new ButtonBuilder()
			.setCustomId(HomeMenuIds.BACK_TO_HOME)
			.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
			.setEmoji(CrowniclesIcons.collectors.back)
			.setStyle(ButtonStyle.Danger));

		return rows;
	}

	/**
	 * Build buttons for wood confirmation prompt
	 */
	private buildWoodConfirmButtons(ctx: HomeFeatureHandlerContext): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		rows[0].addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_WOOD_CONFIRM)
				.setLabel(i18n.t("commands:report.city.homes.cooking.confirmButton", { lng: ctx.lng }))
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.COOKING_WOOD_CANCEL)
				.setLabel(i18n.t("commands:report.city.homes.cooking.cancelButton", { lng: ctx.lng }))
				.setStyle(ButtonStyle.Danger)
		);

		return rows;
	}

	/**
	 * Create a collector that delegates interactions to handleSubMenuSelection
	 */
	private createCookingCollector(ctx: HomeFeatureHandlerContext): (menus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
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
	 * Register the cooking main menu (before ignite)
	 */
	private registerCookingMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): void {
		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(this.buildCookingDescription(ctx)),
			components: this.buildCookingButtons(ctx),
			createCollector: this.createCookingCollector(ctx)
		});
	}

	/**
	 * Register the ignited furnace menu with slot recipes
	 */
	private registerIgnitedMenu(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus, extraMessage = ""): void {
		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(this.buildIgnitedDescription(ctx) + extraMessage),
			components: this.buildIgnitedButtons(ctx),
			createCollector: this.createCookingCollector(ctx)
		});
	}

	/**
	 * Send ignite request to Core
	 */
	private async sendIgniteAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingIgniteReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingNoWoodRes.name) {
					this.registerCookingMenu(ctx, nestedMenus);
					const noWoodMessage = `\n\n${i18n.t("commands:report.city.homes.cooking.noWood", { lng: ctx.lng })}`;
					nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
						embed: new CrowniclesEmbed()
							.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
							.setDescription(this.buildCookingDescription(ctx) + noWoodMessage),
						components: this.buildCookingButtons(ctx),
						createCollector: this.createCookingCollector(ctx)
					});
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				if (packetName === CommandReportCookingOverheatRes.name) {
					const response = responsePacket as unknown as CommandReportCookingOverheatRes;
					const overheatMessage = `\n\n${i18n.t("commands:report.city.homes.cooking.overheat", {
						lng: ctx.lng,
						time: finishInTimeDisplay(new Date(response.overheatUntil))
					})}`;
					nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
						embed: new CrowniclesEmbed()
							.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
							.setDescription(this.buildCookingDescription(ctx) + overheatMessage),
						components: this.buildCookingButtons(ctx),
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

				if (packetName === CommandReportCookingIgniteRes.name) {
					const response = responsePacket as unknown as CommandReportCookingIgniteRes;
					this.updateStateFromIgniteResponse(response);
					this.registerIgnitedMenu(ctx, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
				}
			}
		);
	}

	/**
	 * Register the wood confirmation prompt menu
	 */
	private registerWoodConfirmMenu(
		ctx: HomeFeatureHandlerContext,
		woodInfo: CommandReportCookingWoodConfirmReq,
		nestedMenus: CrowniclesNestedMenus
	): void {
		const materialName = i18n.t(`models:materials.${woodInfo.woodMaterialId}`, { lng: ctx.lng });
		const description = i18n.t("commands:report.city.homes.cooking.woodConfirm", {
			lng: ctx.lng,
			material: materialName,
			rarity: woodInfo.woodRarity
		});

		nestedMenus.registerMenu(HomeMenuIds.COOKING_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(description),
			components: this.buildWoodConfirmButtons(ctx),
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
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingWoodConfirmRes, { accepted }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingIgniteRes.name) {
					const response = responsePacket as unknown as CommandReportCookingIgniteRes;
					this.updateStateFromIgniteResponse(response);
					this.registerIgnitedMenu(ctx, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
					return;
				}

				// Cancelled or no wood — go back to initial cooking menu
				this.registerCookingMenu(ctx, nestedMenus);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Send revive request to Core to re-roll recipes
	 */
	private async sendReviveAction(ctx: HomeFeatureHandlerContext, nestedMenus: CrowniclesNestedMenus): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingReviveReq, {}),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName === CommandReportCookingReviveRes.name) {
					const response = responsePacket as unknown as CommandReportCookingReviveRes;
					this.updateStateFromIgniteResponse(response);
					this.registerIgnitedMenu(ctx, nestedMenus);
					await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
				}
			}
		);
	}

	/**
	 * Send craft request for a specific slot
	 */
	private async sendCraftAction(
		ctx: HomeFeatureHandlerContext,
		slotIndex: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportCookingCraftReq, { slotIndex }),
			async (_responseContext, packetName, responsePacket) => {
				if (packetName !== CommandReportCookingCraftRes.name) {
					return;
				}

				const response = responsePacket as unknown as CommandReportCookingCraftRes;
				const resultMessage = this.buildCraftResultMessage(response, ctx);

				// Update state after craft
				if (response.cookingLevelUp && response.newCookingLevel !== undefined && response.newCookingGrade !== undefined) {
					this.cookingLevel = response.newCookingLevel;
					this.cookingGrade = response.newCookingGrade;
				}

				// Mark the crafted slot as empty
				const slot = this.currentSlots.find(s => s.slotIndex === slotIndex);
				if (slot) {
					slot.recipe = null;
				}

				this.registerIgnitedMenu(ctx, nestedMenus, resultMessage);
				await nestedMenus.changeMenu(HomeMenuIds.COOKING_MENU);
			}
		);
	}

	/**
	 * Build the craft result notification message
	 */
	private buildCraftResultMessage(response: CommandReportCookingCraftRes, ctx: HomeFeatureHandlerContext): string {
		let message = "\n\n";

		if (response.success) {
			message += i18n.t("commands:report.city.homes.cooking.craftSuccess", {
				lng: ctx.lng,
				recipe: i18n.t(`models:cooking.recipes.${response.recipeId}`, { lng: ctx.lng }),
				wasSecret: response.wasSecret
			});
		}
		else {
			message += i18n.t("commands:report.city.homes.cooking.craftFailure", {
				lng: ctx.lng,
				recipe: i18n.t(`models:cooking.recipes.${response.recipeId}`, { lng: ctx.lng })
			});
		}

		message += `\n${i18n.t("commands:report.city.homes.cooking.xpGained", {
			lng: ctx.lng,
			xp: response.cookingXpGained
		})}`;

		if (response.cookingLevelUp) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.levelUp", {
				lng: ctx.lng,
				level: response.newCookingLevel,
				grade: i18n.t(`models:cooking.grades.${response.newCookingGrade}`, { lng: ctx.lng })
			})}`;
		}

		if (response.materialSaved !== undefined) {
			message += `\n${i18n.t("commands:report.city.homes.cooking.materialSaved", {
				lng: ctx.lng,
				material: i18n.t(`models:materials.${response.materialSaved}`, { lng: ctx.lng })
			})}`;
		}

		if (response.discoveredRecipeIds && response.discoveredRecipeIds.length > 0) {
			if (response.discoveredRecipeIds.length === 1) {
				message += `\n${i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {
					lng: ctx.lng,
					recipe: i18n.t(`models:cooking.recipes.${response.discoveredRecipeIds[0]}`, { lng: ctx.lng })
				})}`;
			}
			else {
				const recipeNames = response.discoveredRecipeIds
					.map(id => `**${i18n.t(`models:cooking.recipes.${id}`, { lng: ctx.lng })}**`)
					.join(", ");
				message += `\n${i18n.t("commands:report.city.homes.cooking.recipesDiscovered", {
					lng: ctx.lng,
					recipes: recipeNames
				})}`;
			}
		}

		return message;
	}

	public addSubMenuOptions(_ctx: HomeFeatureHandlerContext, _selectMenu: StringSelectMenuBuilder): void {
		// Cooking uses custom button components instead of select menu options
	}

	public getSubMenuComponents(ctx: HomeFeatureHandlerContext): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
		return this.buildCookingButtons(ctx);
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		return this.buildCookingDescription(ctx);
	}

	public getSubMenuPlaceholder(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.cooking.placeholder", { lng: ctx.lng });
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.cooking.title", {
			lng: ctx.lng, pseudo
		});
	}
}
