import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ContainerBuilder,
	MessageComponentInteraction,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { StringUtils } from "../../../../utils/StringUtils";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import {
	addCitySection, createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { RoyalBlacksmithMenuIds } from "./RoyalBlacksmithMenuConstants";
import { buildUpgradeDetailDescription } from "../blacksmith/BlacksmithUpgradeDetailHelper";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

export interface RoyalBlacksmithMenuParams {
	context: PacketContext;
	interaction: CrowniclesInteraction;
	packet: ReactionCollectorCreationPacket;
	collectorTime: number;
	pseudo: string;
}

type RoyalBlacksmithData = NonNullable<ReactionCollectorCityData["royalBlacksmith"]>;
type RoyalUpgradeableItem = RoyalBlacksmithData["upgradeableItems"][number];

function isRoyalBlacksmithUpgradeReaction(reaction: {
	type: string; data: unknown;
}): reaction is {
	type: string; data: ReactionCollectorRoyalBlacksmithUpgradeReaction;
} {
	if (reaction.type !== ReactionCollectorRoyalBlacksmithUpgradeReaction.name) {
		return false;
	}
	const data = reaction.data as Record<string, unknown>;
	return typeof data.slot === "number" && typeof data.itemCategory === "number" && typeof data.buyMaterials === "boolean";
}

function getDescriptionKey(status: RoyalBlacksmithData["status"]): string {
	switch (status) {
		case "not_worthy":
			return "commands:report.city.royalBlacksmith.descriptionNotWorthy";
		case "items_too_low":
			return "commands:report.city.royalBlacksmith.descriptionItemsTooLow";
		case "all_maxed":
			return "commands:report.city.royalBlacksmith.descriptionAllMaxed";
		case "ready":
		default:
			return "commands:report.city.royalBlacksmith.descriptionReady";
	}
}

/**
 * Status screen — narrative + (when ready) a button to enter the item selection.
 */
export function getRoyalBlacksmithMenu(params: RoyalBlacksmithMenuParams): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const royal = data.royalBlacksmith!;

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.royalBlacksmith.title", {
				lng, pseudo
			}))
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t(getDescriptionKey(royal.status), {
				lng,
				playerLevel: royal.playerLevel,
				money: royal.playerMoney,
				gems: royal.playerGems
			})
		)
	);

	if (royal.status === "ready") {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.upgrade,
			title: i18n.t("commands:report.city.royalBlacksmith.upgradeLabel", { lng }),
			description: i18n.t("commands:report.city.royalBlacksmith.upgradeDescription", { lng }),
			customId: RoyalBlacksmithMenuIds.UPGRADE_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.upgrade", { lng })
		});
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(RoyalBlacksmithMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.royalBlacksmith.backToCity", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: collectorTime });

			collector.on("collect", async (componentInteraction: MessageComponentInteraction) => {
				if (componentInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				await componentInteraction.deferUpdate();
				const id = componentInteraction.customId;

				if (id === RoyalBlacksmithMenuIds.UPGRADE_MENU) {
					await nestedMenus.changeMenu(RoyalBlacksmithMenuIds.UPGRADE_MENU);
				}
				else if (id === RoyalBlacksmithMenuIds.BACK_TO_CITY) {
					await nestedMenus.changeToMainMenu();
				}
				else if (id === ReportCityMenuIds.STAY_IN_CITY) {
					handleStayInCityInteraction(packet, context, componentInteraction);
				}
			});

			return collector;
		}
	};
}

/**
 * Item selection menu (only built when status === "ready").
 */
export function getRoyalBlacksmithUpgradeMenu(params: RoyalBlacksmithMenuParams): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const royal = data.royalBlacksmith!;

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.royalBlacksmith.upgradeTitle", {
				lng, pseudo
			}))
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.royalBlacksmith.upgradeSelectDescription", {
				lng,
				money: royal.playerMoney,
				gems: royal.playerGems
			})
		)
	);

	for (let i = 0; i < royal.upgradeableItems.length; i++) {
		const item = royal.upgradeableItems[i];
		const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);

		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			text: `${itemDisplay}\n${i18n.t("commands:report.city.royalBlacksmith.itemUpgradePreview", {
				lng,
				currentLevel: item.details.itemLevel ?? 0,
				upgradeCost: item.upgradeCost,
				gemCost: item.gemCost
			})}`,
			customId: `${RoyalBlacksmithMenuIds.UPGRADE_ITEM_PREFIX}${i}`,
			buttonLabel: i18n.t("commands:report.city.buttons.upgrade", { lng }),
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(RoyalBlacksmithMenuIds.BACK_TO_ROYAL_BLACKSMITH)
				.setLabel(i18n.t("commands:report.city.royalBlacksmith.backToRoyalBlacksmith", { lng }))
				.setEmoji(CrowniclesIcons.city.back)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: collectorTime });

			collector.on("collect", async (componentInteraction: MessageComponentInteraction) => {
				if (componentInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				await componentInteraction.deferUpdate();
				const id = componentInteraction.customId;

				if (id === RoyalBlacksmithMenuIds.BACK_TO_ROYAL_BLACKSMITH) {
					await nestedMenus.changeMenu(RoyalBlacksmithMenuIds.ROYAL_BLACKSMITH_MENU);
				}
				else if (id === ReportCityMenuIds.STAY_IN_CITY) {
					handleStayInCityInteraction(packet, context, componentInteraction);
				}
				else if (id.startsWith(RoyalBlacksmithMenuIds.UPGRADE_ITEM_PREFIX)) {
					const itemIndex = Number.parseInt(id.slice(RoyalBlacksmithMenuIds.UPGRADE_ITEM_PREFIX.length), 10);
					if (!Number.isNaN(itemIndex)) {
						await nestedMenus.changeMenu(`${RoyalBlacksmithMenuIds.UPGRADE_MENU}_DETAIL_${itemIndex}`);
					}
				}
			});

			return collector;
		}
	};
}

function buildRoyalUpgradeDetailDescription(item: RoyalUpgradeableItem, lng: Language): string {
	return buildUpgradeDetailDescription({
		item,
		lng,
		titleKey: "commands:report.city.royalBlacksmith.upgradeItemDetailsBase",
		titleParams: {
			currentLevel: item.details.itemLevel ?? 0,
			upgradeCost: item.upgradeCost,
			gemCost: item.gemCost
		},
		missingOfferKey: "commands:report.city.royalBlacksmith.missingMaterialsOffer"
	});
}

/**
 * Detail screen for a single upgradeable item — mirrors the standard blacksmith pattern.
 */
export function getRoyalBlacksmithUpgradeDetailMenu(
	params: RoyalBlacksmithMenuParams,
	itemIndex: number
): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const royal = data.royalBlacksmith!;
	const item = royal.upgradeableItems[itemIndex];

	const description = buildRoyalUpgradeDetailDescription(item, lng);

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.royalBlacksmith.upgradeTitle", {
				lng, pseudo
			}))
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(description)
	);

	const buttons: ButtonBuilder[] = [];

	const {
		canUpgrade, canBuyAndUpgrade
	} = item;
	buttons.push(
		new ButtonBuilder()
			.setCustomId(RoyalBlacksmithMenuIds.CONFIRM_UPGRADE)
			.setLabel(i18n.t("commands:report.city.royalBlacksmith.confirmUpgrade", {
				lng,
				cost: item.upgradeCost
			}))
			.setStyle(canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!canUpgrade)
			.setEmoji(CrowniclesIcons.city.blacksmith.upgrade)
	);

	if (!item.hasAllMaterials) {
		const totalCost = item.upgradeCost + item.missingMaterialsCost;
		buttons.push(
			new ButtonBuilder()
				.setCustomId(RoyalBlacksmithMenuIds.BUY_AND_UPGRADE)
				.setLabel(i18n.t("commands:report.city.royalBlacksmith.buyMaterialsAndUpgrade", {
					lng,
					cost: totalCost
				}))
				.setStyle(canBuyAndUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
				.setDisabled(!canBuyAndUpgrade)
				.setEmoji(CrowniclesIcons.collectors.accept)
		);
	}

	buttons.push(
		new ButtonBuilder()
			.setCustomId(RoyalBlacksmithMenuIds.BACK_TO_UPGRADE_LIST)
			.setLabel(i18n.t("commands:report.city.royalBlacksmith.backToItems", { lng }))
			.setEmoji(CrowniclesIcons.city.back)
			.setStyle(ButtonStyle.Secondary),
		createStayInCityButton(lng)
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
	);

	return {
		containers: [container],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: collectorTime });

			collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
				if (buttonInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
					return;
				}

				if (buttonInteraction.customId === RoyalBlacksmithMenuIds.BACK_TO_UPGRADE_LIST) {
					await buttonInteraction.deferUpdate();
					await nestedMenus.changeMenu(RoyalBlacksmithMenuIds.UPGRADE_MENU);
					return;
				}
				if (buttonInteraction.customId === ReportCityMenuIds.STAY_IN_CITY) {
					await buttonInteraction.deferUpdate();
					handleStayInCityInteraction(packet, context, buttonInteraction);
					return;
				}

				if (
					buttonInteraction.customId === RoyalBlacksmithMenuIds.CONFIRM_UPGRADE
					|| buttonInteraction.customId === RoyalBlacksmithMenuIds.BUY_AND_UPGRADE
				) {
					await buttonInteraction.deferReply();
					const buyMaterials = buttonInteraction.customId === RoyalBlacksmithMenuIds.BUY_AND_UPGRADE;

					const reactionIndex = packet.reactions.findIndex(
						r => isRoyalBlacksmithUpgradeReaction(r)
							&& r.data.slot === item.slot
							&& r.data.itemCategory === item.category
							&& r.data.buyMaterials === buyMaterials
					);

					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
					}
					else {
						CrowniclesLogger.error(`Royal blacksmith upgrade reaction not found for slot ${item.slot}, category ${item.category}, buyMaterials ${buyMaterials}`);
						await buttonInteraction.deleteReply();
					}
				}
			});

			return collector;
		}
	};
}

/**
 * Get all Royal Blacksmith menus: status screen, item selection, and per-item detail screens.
 */
export function getRoyalBlacksmithMenus(params: RoyalBlacksmithMenuParams): Map<string, CrowniclesNestedMenu> {
	const data = params.packet.data.data as ReactionCollectorCityData;
	const menus = new Map<string, CrowniclesNestedMenu>();
	if (!data.royalBlacksmith) {
		return menus;
	}
	menus.set(RoyalBlacksmithMenuIds.ROYAL_BLACKSMITH_MENU, getRoyalBlacksmithMenu(params));

	if (data.royalBlacksmith.status === "ready") {
		menus.set(RoyalBlacksmithMenuIds.UPGRADE_MENU, getRoyalBlacksmithUpgradeMenu(params));
		for (let i = 0; i < data.royalBlacksmith.upgradeableItems.length; i++) {
			menus.set(
				`${RoyalBlacksmithMenuIds.UPGRADE_MENU}_DETAIL_${i}`,
				getRoyalBlacksmithUpgradeDetailMenu(params, i)
			);
		}
	}
	return menus;
}
