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

export interface BlacksmithMenuParams {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
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
		.setCustomId("BLACKSMITH_MENU")
		.setPlaceholder(i18n.t("commands:report.city.blacksmith.placeholder", { lng }));

	// Add upgrade items option if there are upgradeable items
	if (blacksmith.upgradeableItems.length > 0) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.blacksmith.upgradeLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.upgradeDescription", { lng }),
			value: "BLACKSMITH_UPGRADE_MENU",
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	}

	// Add disenchant items option if there are disenchantable items
	if (blacksmith.disenchantableItems.length > 0) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.blacksmith.disenchantLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.disenchantDescription", { lng }),
			value: "BLACKSMITH_DISENCHANT_MENU",
			emoji: CrowniclesIcons.city.blacksmith.disenchant
		});
	}

	// Add back to city option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToCity", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToCityDescription", { lng }),
		value: "BACK_TO_CITY",
		emoji: CrowniclesIcons.city.back
	});

	// Build description based on available services
	const hasUpgrades = blacksmith.upgradeableItems.length > 0;
	const hasDisenchants = blacksmith.disenchantableItems.length > 0;

	let descriptionKey: string;
	if (hasUpgrades && hasDisenchants) {
		descriptionKey = "commands:report.city.blacksmith.descriptionBoth";
	}
	else if (hasUpgrades) {
		descriptionKey = "commands:report.city.blacksmith.descriptionUpgradeOnly";
	}
	else if (hasDisenchants) {
		descriptionKey = "commands:report.city.blacksmith.descriptionDisenchantOnly";
	}
	else {
		descriptionKey = "commands:report.city.blacksmith.descriptionNoItems";
	}

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

				if (selectedValue === "BLACKSMITH_UPGRADE_MENU") {
					await nestedMenus.changeMenu("BLACKSMITH_UPGRADE_MENU");
				}
				else if (selectedValue === "BLACKSMITH_DISENCHANT_MENU") {
					await nestedMenus.changeMenu("BLACKSMITH_DISENCHANT_MENU");
				}
				else if (selectedValue === "BACK_TO_CITY") {
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
		.setCustomId("BLACKSMITH_UPGRADE_SELECT")
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
			value: `UPGRADE_ITEM_${i}`,
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	}

	// Add back option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToBlacksmithDescription", { lng }),
		value: "BACK_TO_BLACKSMITH",
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

				if (selectedValue === "BACK_TO_BLACKSMITH") {
					await nestedMenus.changeMenu("BLACKSMITH_MENU");
				}
				else if (selectedValue.startsWith("UPGRADE_ITEM_")) {
					const itemIndex = parseInt(selectedValue.replace("UPGRADE_ITEM_", ""), 10);
					await nestedMenus.changeMenu(`BLACKSMITH_UPGRADE_DETAIL_${itemIndex}`);
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
	// Clone details to avoid mutating packet data
	const detailsForDisplay = {
		...item.details,
		attack: {
			...item.details.attack,
			maxValue: Infinity
		},
		defense: {
			...item.details.defense,
			maxValue: Infinity
		},
		speed: {
			...item.details.speed,
			maxValue: Infinity
		}
	};

	const itemDisplay = DisplayUtils.getItemDisplayWithStats(detailsForDisplay, lng);

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
			.setCustomId("CONFIRM_UPGRADE")
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
				.setCustomId("BUY_AND_UPGRADE")
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
			.setCustomId("BACK_TO_UPGRADE_LIST")
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

				if (buttonInteraction.customId === "BACK_TO_UPGRADE_LIST") {
					await buttonInteraction.deferUpdate();
					await nestedMenus.changeMenu("BLACKSMITH_UPGRADE_MENU");
					return;
				}

				if (buttonInteraction.customId === "CONFIRM_UPGRADE" || buttonInteraction.customId === "BUY_AND_UPGRADE") {
					await buttonInteraction.deferReply();
					const buyMaterials = buttonInteraction.customId === "BUY_AND_UPGRADE";

					// Find the reaction with matching slot, category, and buyMaterials flag
					const reactionIndex = packet.reactions.findIndex(
						r => r.type === ReactionCollectorBlacksmithUpgradeReaction.name
							&& (r.data as ReactionCollectorBlacksmithUpgradeReaction).slot === item.slot
							&& (r.data as ReactionCollectorBlacksmithUpgradeReaction).itemCategory === item.category
							&& (r.data as ReactionCollectorBlacksmithUpgradeReaction).buyMaterials === buyMaterials
					);

					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
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
		.setCustomId("BLACKSMITH_DISENCHANT_SELECT")
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
			value: `DISENCHANT_ITEM_${i}`,
			emoji: CrowniclesIcons.city.blacksmith.disenchant
		});
	}

	// Add back option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }),
		description: i18n.t("commands:report.city.blacksmith.backToBlacksmithDescription", { lng }),
		value: "BACK_TO_BLACKSMITH",
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

				if (selectedValue === "BACK_TO_BLACKSMITH") {
					await nestedMenus.changeMenu("BLACKSMITH_MENU");
				}
				else if (selectedValue.startsWith("DISENCHANT_ITEM_")) {
					const itemIndex = parseInt(selectedValue.replace("DISENCHANT_ITEM_", ""), 10);
					await nestedMenus.changeMenu(`BLACKSMITH_DISENCHANT_DETAIL_${itemIndex}`);
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

	// Clone details to avoid mutating packet data
	const detailsForDisplay = {
		...item.details,
		attack: {
			...item.details.attack,
			maxValue: Infinity
		},
		defense: {
			...item.details.defense,
			maxValue: Infinity
		},
		speed: {
			...item.details.speed,
			maxValue: Infinity
		}
	};

	const itemDisplay = DisplayUtils.getItemDisplayWithStats(detailsForDisplay, lng);
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
			.setCustomId("CONFIRM_DISENCHANT")
			.setLabel(i18n.t("commands:report.city.blacksmith.confirmDisenchant", {
				lng,
				cost: item.disenchantCost
			}))
			.setStyle(canDisenchant ? ButtonStyle.Danger : ButtonStyle.Secondary)
			.setDisabled(!canDisenchant),
		new ButtonBuilder()
			.setCustomId("BACK_TO_DISENCHANT_LIST")
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

				if (buttonInteraction.customId === "BACK_TO_DISENCHANT_LIST") {
					await buttonInteraction.deferUpdate();
					await nestedMenus.changeMenu("BLACKSMITH_DISENCHANT_MENU");
					return;
				}

				if (buttonInteraction.customId === "CONFIRM_DISENCHANT") {
					await buttonInteraction.deferReply();

					// Find the reaction and send it
					const reactionIndex = packet.reactions.findIndex(
						r => r.type === ReactionCollectorBlacksmithDisenchantReaction.name
							&& (r.data as ReactionCollectorBlacksmithDisenchantReaction).slot === item.slot
							&& (r.data as ReactionCollectorBlacksmithDisenchantReaction).itemCategory === item.category
					);

					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
					}
				}
			});

			return collector;
		}
	};
}

/**
 * Get all blacksmith submenus for registration
 */
export function getBlacksmithSubMenus(params: BlacksmithMenuParams): Map<string, CrowniclesNestedMenu> {
	const data = params.packet.data.data as ReactionCollectorCityData;
	const blacksmith = data.blacksmith;
	const menus = new Map<string, CrowniclesNestedMenu>();

	if (!blacksmith) {
		return menus;
	}

	// Upgrade menu and detail menus
	if (blacksmith.upgradeableItems.length > 0) {
		menus.set("BLACKSMITH_UPGRADE_MENU", getBlacksmithUpgradeMenu(params));
		for (let i = 0; i < blacksmith.upgradeableItems.length; i++) {
			menus.set(`BLACKSMITH_UPGRADE_DETAIL_${i}`, getBlacksmithUpgradeDetailMenu(params, i));
		}
	}

	// Disenchant menu and detail menus
	if (blacksmith.disenchantableItems.length > 0) {
		menus.set("BLACKSMITH_DISENCHANT_MENU", getBlacksmithDisenchantMenu(params));
		for (let i = 0; i < blacksmith.disenchantableItems.length; i++) {
			menus.set(`BLACKSMITH_DISENCHANT_DETAIL_${i}`, getBlacksmithDisenchantDetailMenu(params, i));
		}
	}

	return menus;
}
