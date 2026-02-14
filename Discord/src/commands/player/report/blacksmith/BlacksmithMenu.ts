import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector
} from "../../../../messages/CrowniclesNestedMenus";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorBlacksmithDisenchantReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorCityData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { Language } from "../../../../../../Lib/src/Language";
import { BlacksmithMenuIds } from "./BlacksmithMenuConstants";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

export interface BlacksmithMenuParams {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
}

/**
 * Type guard to check if a reaction is a blacksmith upgrade reaction
 */
function isBlacksmithUpgradeReaction(reaction: {
	type: string; data: unknown;
}): reaction is {
	type: string; data: ReactionCollectorBlacksmithUpgradeReaction;
} {
	if (reaction.type !== ReactionCollectorBlacksmithUpgradeReaction.name) {
		return false;
	}
	const data = reaction.data as Record<string, unknown>;
	return typeof data.slot === "number" && typeof data.itemCategory === "number" && typeof data.buyMaterials === "boolean";
}

/**
 * Type guard to check if a reaction is a blacksmith disenchant reaction
 */
function isBlacksmithDisenchantReaction(reaction: {
	type: string; data: unknown;
}): reaction is {
	type: string; data: ReactionCollectorBlacksmithDisenchantReaction;
} {
	if (reaction.type !== ReactionCollectorBlacksmithDisenchantReaction.name) {
		return false;
	}
	const data = reaction.data as Record<string, unknown>;
	return typeof data.slot === "number" && typeof data.itemCategory === "number";
}

/**
 * Get the translation key for the blacksmith menu description based on available services
 */
function getDescriptionKeyBlacksmithMenu(blacksmith: NonNullable<ReactionCollectorCityData["blacksmith"]>): string {
	const hasUpgrades = blacksmith.upgradeableItems.length > 0;
	const hasDisenchants = blacksmith.disenchantableItems.length > 0;

	if (hasUpgrades && hasDisenchants) {
		return "commands:report.city.blacksmith.descriptionBoth";
	}
	if (hasUpgrades) {
		return "commands:report.city.blacksmith.descriptionUpgradeOnly";
	}
	if (hasDisenchants) {
		return "commands:report.city.blacksmith.descriptionDisenchantOnly";
	}
	return "commands:report.city.blacksmith.descriptionNoItems";
}

/**
 * Get the main blacksmith menu
 */
export function getBlacksmithMenu(params: BlacksmithMenuParams): CrowniclesNestedMenu {
	const {
		interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const blacksmith = data.blacksmith!;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(BlacksmithMenuIds.BLACKSMITH_MENU)
		.setPlaceholder(i18n.t("commands:report.city.blacksmith.placeholder", { lng }));

	// Add upgrade items option if there are upgradeable items
	if (blacksmith.upgradeableItems.length > 0) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.blacksmith.upgradeLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.upgradeDescription", { lng }),
			value: BlacksmithMenuIds.UPGRADE_MENU,
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	}

	// Add disenchant items option if there are disenchantable items
	if (blacksmith.disenchantableItems.length > 0) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.blacksmith.disenchantLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.disenchantDescription", { lng }),
			value: BlacksmithMenuIds.DISENCHANT_MENU,
			emoji: CrowniclesIcons.city.blacksmith.disenchant
		});
	}

	// Add back to city option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToCity", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToCityDescription", { lng }),
		value: BlacksmithMenuIds.BACK_TO_CITY,
		emoji: CrowniclesIcons.city.back
	});

	// Build description based on available services
	const descriptionKey = getDescriptionKeyBlacksmithMenu(blacksmith);

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.blacksmith.title", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(i18n.t(descriptionKey, { lng })),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({
				time: collectorTime
			});

			collector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				await selectInteraction.deferUpdate();
				const selectedValue = selectInteraction.values[0];

				if (selectedValue === BlacksmithMenuIds.UPGRADE_MENU) {
					await nestedMenus.changeMenu(BlacksmithMenuIds.UPGRADE_MENU);
				}
				else if (selectedValue === BlacksmithMenuIds.DISENCHANT_MENU) {
					await nestedMenus.changeMenu(BlacksmithMenuIds.DISENCHANT_MENU);
				}
				else if (selectedValue === BlacksmithMenuIds.BACK_TO_CITY) {
					await nestedMenus.changeToMainMenu();
				}
			});

			return collector;
		}
	};
}

/**
 * Get the blacksmith upgrade item selection menu
 */
export function getBlacksmithUpgradeMenu(params: BlacksmithMenuParams): CrowniclesNestedMenu {
	const {
		interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const blacksmith = data.blacksmith!;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(BlacksmithMenuIds.UPGRADE_SELECT)
		.setPlaceholder(i18n.t("commands:report.city.blacksmith.selectItemPlaceholder", { lng }));

	// Add each upgradeable item
	for (let i = 0; i < blacksmith.upgradeableItems.length; i++) {
		const item = blacksmith.upgradeableItems[i];
		const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, lng);
		const parts = itemDisplay.split(" | ");
		const label = parts[0].split("**")[1] || parts[0].substring(0, 50);

		selectMenu.addOptions({
			label: label.substring(0, 100),
			description: i18n.t("commands:report.city.blacksmith.itemUpgradePreview", {
				lng,
				currentLevel: item.details.itemLevel ?? 0,
				nextLevel: item.nextLevel,
				cost: item.upgradeCost
			}),
			value: `${BlacksmithMenuIds.UPGRADE_ITEM_PREFIX}${i}`,
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	}

	// Add back option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToBlacksmithDescription", { lng }),
		value: BlacksmithMenuIds.BACK_TO_BLACKSMITH,
		emoji: CrowniclesIcons.city.back
	});

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.blacksmith.upgradeTitle", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(i18n.t("commands:report.city.blacksmith.upgradeSelectDescription", {
				lng,
				money: blacksmith.playerMoney
			})),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({
				time: collectorTime
			});

			collector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				await selectInteraction.deferUpdate();
				const selectedValue = selectInteraction.values[0];

				if (selectedValue === BlacksmithMenuIds.BACK_TO_BLACKSMITH) {
					await nestedMenus.changeMenu(BlacksmithMenuIds.BLACKSMITH_MENU);
				}
				else if (selectedValue.startsWith(BlacksmithMenuIds.UPGRADE_ITEM_PREFIX)) {
					const itemIndex = parseInt(selectedValue.replace(BlacksmithMenuIds.UPGRADE_ITEM_PREFIX, ""), 10);
					await nestedMenus.changeMenu(`${BlacksmithMenuIds.UPGRADE_MENU}_DETAIL_${itemIndex}`);
				}
			});

			return collector;
		}
	};
}

/**
 * Build description for upgrade item details
 */
function buildUpgradeDetailDescription(
	item: NonNullable<ReactionCollectorCityData["blacksmith"]>["upgradeableItems"][0],
	lng: Language
): string {
	const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);

	// Build materials list with icons (same format as upgrade station)
	const materialLines = item.requiredMaterials.map(m => {
		const icon = CrowniclesIcons.materials[m.materialId] ?? CrowniclesIcons.collectors.question;
		const materialName = i18n.t(`models:materials.${m.materialId}`, { lng });
		const hasEnough = m.playerQuantity >= m.quantity;
		const statusIcon = hasEnough ? CrowniclesIcons.collectors.accept : CrowniclesIcons.collectors.refuse;
		return `${statusIcon} ${icon} **${materialName}** : ${m.playerQuantity}/${m.quantity}`;
	});

	// Build description with conditional missing materials message
	let description = i18n.t("commands:report.city.blacksmith.upgradeItemDetailsBase", {
		lng,
		itemDisplay,
		currentLevel: item.details.itemLevel ?? 0,
		nextLevel: item.nextLevel,
		upgradeCost: item.upgradeCost,
		materials: materialLines.join("\n")
	});

	// Add missing materials message if needed
	if (!item.hasAllMaterials) {
		description += `\n\n${i18n.t("commands:report.city.blacksmith.missingMaterialsOffer", {
			lng,
			missingMaterialsCost: item.missingMaterialsCost
		})}`;
	}

	return description;
}

/**
 * Get the upgrade item detail menu with confirm/buy materials buttons
 */
export function getBlacksmithUpgradeDetailMenu(
	params: BlacksmithMenuParams,
	itemIndex: number
): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const blacksmith = data.blacksmith!;
	const item = blacksmith.upgradeableItems[itemIndex];

	const description = buildUpgradeDetailDescription(item, lng);

	// Build buttons
	const buttons: ButtonBuilder[] = [];

	// Confirm upgrade button (if has all materials and enough money)
	const canUpgradeWithMaterials = item.hasAllMaterials && blacksmith.playerMoney >= item.upgradeCost;
	buttons.push(
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.CONFIRM_UPGRADE)
			.setLabel(i18n.t("commands:report.city.blacksmith.confirmUpgrade", {
				lng,
				cost: item.upgradeCost
			}))
			.setStyle(canUpgradeWithMaterials ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!canUpgradeWithMaterials)
	);

	// Buy materials and upgrade button (if missing materials and has enough money)
	if (!item.hasAllMaterials) {
		const totalCost = item.upgradeCost + item.missingMaterialsCost;
		const canBuyAndUpgrade = blacksmith.playerMoney >= totalCost;
		buttons.push(
			new ButtonBuilder()
				.setCustomId(BlacksmithMenuIds.BUY_AND_UPGRADE)
				.setLabel(i18n.t("commands:report.city.blacksmith.buyMaterialsAndUpgrade", {
					lng,
					cost: totalCost
				}))
				.setStyle(canBuyAndUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
				.setDisabled(!canBuyAndUpgrade)
		);
	}

	// Back button
	buttons.push(
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.BACK_TO_UPGRADE_LIST)
			.setLabel(i18n.t("commands:report.city.blacksmith.backToItems", { lng }))
			.setStyle(ButtonStyle.Secondary)
	);

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.blacksmith.upgradeTitle", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(description),
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({
				time: collectorTime
			});

			collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
				if (buttonInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
					return;
				}

				if (buttonInteraction.customId === BlacksmithMenuIds.BACK_TO_UPGRADE_LIST) {
					await buttonInteraction.deferUpdate();
					await nestedMenus.changeMenu(BlacksmithMenuIds.UPGRADE_MENU);
					return;
				}

				if (buttonInteraction.customId === BlacksmithMenuIds.CONFIRM_UPGRADE || buttonInteraction.customId === BlacksmithMenuIds.BUY_AND_UPGRADE) {
					await buttonInteraction.deferReply();
					const buyMaterials = buttonInteraction.customId === BlacksmithMenuIds.BUY_AND_UPGRADE;

					// Find the reaction with matching slot, category, and buyMaterials flag
					const reactionIndex = packet.reactions.findIndex(
						r => isBlacksmithUpgradeReaction(r)
							&& r.data.slot === item.slot
							&& r.data.itemCategory === item.category
							&& r.data.buyMaterials === buyMaterials
					);

					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
					}
					else {
						CrowniclesLogger.error(`Blacksmith upgrade reaction not found for slot ${item.slot}, category ${item.category}, buyMaterials ${buyMaterials}`);
						await buttonInteraction.deleteReply();
					}
				}
			});

			return collector;
		}
	};
}

/**
 * Get the blacksmith disenchant item selection menu
 */
export function getBlacksmithDisenchantMenu(params: BlacksmithMenuParams): CrowniclesNestedMenu {
	const {
		interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const blacksmith = data.blacksmith!;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(BlacksmithMenuIds.DISENCHANT_SELECT)
		.setPlaceholder(i18n.t("commands:report.city.blacksmith.selectItemPlaceholder", { lng }));

	// Add each disenchantable item
	for (let i = 0; i < blacksmith.disenchantableItems.length; i++) {
		const item = blacksmith.disenchantableItems[i];
		const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, lng);
		const parts = itemDisplay.split(" | ");
		const label = parts[0].split("**")[1] || parts[0].substring(0, 50);

		selectMenu.addOptions({
			label: label.substring(0, 100),
			description: i18n.t("commands:report.city.blacksmith.itemDisenchantPreview", {
				lng,
				enchantmentType: item.enchantmentType,
				cost: item.disenchantCost
			}),
			value: `${BlacksmithMenuIds.DISENCHANT_ITEM_PREFIX}${i}`,
			emoji: CrowniclesIcons.city.blacksmith.disenchant
		});
	}

	// Add back option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToBlacksmithDescription", { lng }),
		value: BlacksmithMenuIds.BACK_TO_BLACKSMITH,
		emoji: CrowniclesIcons.city.back
	});

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.blacksmith.disenchantTitle", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(i18n.t("commands:report.city.blacksmith.disenchantSelectDescription", {
				lng,
				money: blacksmith.playerMoney
			})),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({
				time: collectorTime
			});

			collector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				await selectInteraction.deferUpdate();
				const selectedValue = selectInteraction.values[0];

				if (selectedValue === BlacksmithMenuIds.BACK_TO_BLACKSMITH) {
					await nestedMenus.changeMenu(BlacksmithMenuIds.BLACKSMITH_MENU);
				}
				else if (selectedValue.startsWith(BlacksmithMenuIds.DISENCHANT_ITEM_PREFIX)) {
					const itemIndex = parseInt(selectedValue.replace(BlacksmithMenuIds.DISENCHANT_ITEM_PREFIX, ""), 10);
					await nestedMenus.changeMenu(`${BlacksmithMenuIds.DISENCHANT_MENU}_DETAIL_${itemIndex}`);
				}
			});

			return collector;
		}
	};
}

/**
 * Get the disenchant item detail menu with confirm button
 */
export function getBlacksmithDisenchantDetailMenu(
	params: BlacksmithMenuParams,
	itemIndex: number
): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const blacksmith = data.blacksmith!;
	const item = blacksmith.disenchantableItems[itemIndex];

	const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);
	const description = i18n.t("commands:report.city.blacksmith.disenchantItemDetails", {
		lng,
		itemDisplay,
		enchantmentType: item.enchantmentType,
		cost: item.disenchantCost
	});

	// Build buttons
	const canDisenchant = blacksmith.playerMoney >= item.disenchantCost;
	const buttons: ButtonBuilder[] = [
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.CONFIRM_DISENCHANT)
			.setLabel(i18n.t("commands:report.city.blacksmith.confirmDisenchant", {
				lng,
				cost: item.disenchantCost
			}))
			.setStyle(canDisenchant ? ButtonStyle.Danger : ButtonStyle.Secondary)
			.setDisabled(!canDisenchant),
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.BACK_TO_DISENCHANT_LIST)
			.setLabel(i18n.t("commands:report.city.blacksmith.backToItems", { lng }))
			.setStyle(ButtonStyle.Secondary)
	];

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.blacksmith.disenchantTitle", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(description),
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({
				time: collectorTime
			});

			collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
				if (buttonInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
					return;
				}

				if (buttonInteraction.customId === BlacksmithMenuIds.BACK_TO_DISENCHANT_LIST) {
					await buttonInteraction.deferUpdate();
					await nestedMenus.changeMenu(BlacksmithMenuIds.DISENCHANT_MENU);
					return;
				}

				if (buttonInteraction.customId === BlacksmithMenuIds.CONFIRM_DISENCHANT) {
					await buttonInteraction.deferReply();

					// Find the reaction and send it
					const reactionIndex = packet.reactions.findIndex(
						r => isBlacksmithDisenchantReaction(r)
							&& r.data.slot === item.slot
							&& r.data.itemCategory === item.category
					);

					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
					}
					else {
						CrowniclesLogger.error(`Blacksmith disenchant reaction not found for slot ${item.slot}, category ${item.category}`);
						await buttonInteraction.deleteReply();
					}
				}
			});

			return collector;
		}
	};
}

/**
 * Register a main menu and its detail sub-menus into the provided map
 */
function registerSubMenus(
	menus: Map<string, CrowniclesNestedMenu>,
	items: unknown[],
	mainKey: string,
	mainMenu: CrowniclesNestedMenu,
	detailMenuFactory: (index: number) => CrowniclesNestedMenu
): void {
	if (items.length === 0) {
		return;
	}
	menus.set(mainKey, mainMenu);
	for (let i = 0; i < items.length; i++) {
		menus.set(`${mainKey}_DETAIL_${i}`, detailMenuFactory(i));
	}
}

/**
 * Get all blacksmith menus (main + sub-menus) for registration
 */
export function getBlacksmithMenus(params: BlacksmithMenuParams): Map<string, CrowniclesNestedMenu> {
	const data = params.packet.data.data as ReactionCollectorCityData;
	const blacksmith = data.blacksmith;
	const menus = new Map<string, CrowniclesNestedMenu>();

	if (!blacksmith) {
		return menus;
	}

	menus.set(BlacksmithMenuIds.BLACKSMITH_MENU, getBlacksmithMenu(params));

	registerSubMenus(
		menus,
		blacksmith.upgradeableItems,
		BlacksmithMenuIds.UPGRADE_MENU,
		getBlacksmithUpgradeMenu(params),
		i => getBlacksmithUpgradeDetailMenu(params, i)
	);

	registerSubMenus(
		menus,
		blacksmith.disenchantableItems,
		BlacksmithMenuIds.DISENCHANT_MENU,
		getBlacksmithDisenchantMenu(params),
		i => getBlacksmithDisenchantDetailMenu(params, i)
	);

	return menus;
}
