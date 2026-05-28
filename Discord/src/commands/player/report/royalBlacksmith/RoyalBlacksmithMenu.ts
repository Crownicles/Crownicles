import {
	ActionRowBuilder,
	ButtonBuilder,
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
	createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { RoyalBlacksmithMenuIds } from "./RoyalBlacksmithMenuConstants";

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

function buildUpgradeItemBlock(item: RoyalUpgradeableItem, lng: Language): string {
	const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);
	const key = item.hasAllMaterials
		? "commands:report.city.royalBlacksmith.itemBlock"
		: "commands:report.city.royalBlacksmith.itemBlockWithMissingMaterials";
	return i18n.t(key, {
		lng,
		itemDisplay,
		upgradeCost: item.upgradeCost,
		gemCost: item.gemCost,
		missingMaterialsCost: item.missingMaterialsCost
	});
}

function addUpgradeableItemSections(
	container: ContainerBuilder,
	royal: RoyalBlacksmithData,
	lng: Language
): void {
	for (const item of royal.upgradeableItems) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(buildUpgradeItemBlock(item, lng))
		);

		const upgradeId = `${RoyalBlacksmithMenuIds.UPGRADE_PREFIX}${item.slot}_${item.category}`;
		const buyId = `${RoyalBlacksmithMenuIds.BUY_AND_UPGRADE_PREFIX}${item.slot}_${item.category}`;

		const row = new ActionRowBuilder<ButtonBuilder>();
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(upgradeId)
				.setLabel(i18n.t("commands:report.city.royalBlacksmith.upgradeButton", {
					lng, cost: item.upgradeCost
				}))
				.setStyle(item.canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
				.setDisabled(!item.canUpgrade)
				.setEmoji(CrowniclesIcons.city.blacksmith.upgrade)
		);
		if (!item.hasAllMaterials) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(buyId)
					.setLabel(i18n.t("commands:report.city.royalBlacksmith.buyAndUpgradeButton", {
						lng, cost: item.upgradeCost + item.missingMaterialsCost
					}))
					.setStyle(item.canBuyAndUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
					.setDisabled(!item.canBuyAndUpgrade)
			);
		}
		container.addActionRowComponents(row);
	}
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

function sendUpgradeReaction(params: {
	customId: string;
	packet: ReactionCollectorCreationPacket;
	context: PacketContext;
	interaction: MessageComponentInteraction;
	buyMaterials: boolean;
	prefix: string;
}): boolean {
	const {
		customId, packet, context, interaction, buyMaterials, prefix
	} = params;
	const rest = customId.slice(prefix.length);
	const [slotStr, categoryStr] = rest.split("_");
	const slot = Number.parseInt(slotStr, 10);
	const category = Number.parseInt(categoryStr, 10);
	if (Number.isNaN(slot) || Number.isNaN(category)) {
		return false;
	}
	const reactionIndex = packet.reactions.findIndex(
		r => isRoyalBlacksmithUpgradeReaction(r)
			&& r.data.slot === slot
			&& r.data.itemCategory === category
			&& r.data.buyMaterials === buyMaterials
	);
	if (reactionIndex === -1) {
		return false;
	}
	DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, interaction, reactionIndex);
	return true;
}

/**
 * Get the Royal Blacksmith menu — single screen branching on status.
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
			`### ${i18n.t("commands:report.city.royalBlacksmith.title", {
				lng, pseudo
			})}`
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
		addUpgradeableItemSections(container, royal, lng);
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

				const id = componentInteraction.customId;

				if (id === RoyalBlacksmithMenuIds.BACK_TO_CITY) {
					await componentInteraction.deferUpdate();
					await nestedMenus.changeToMainMenu();
					return;
				}
				if (id === ReportCityMenuIds.STAY_IN_CITY) {
					await componentInteraction.deferUpdate();
					handleStayInCityInteraction(packet, context, componentInteraction);
					return;
				}

				if (id.startsWith(RoyalBlacksmithMenuIds.BUY_AND_UPGRADE_PREFIX)) {
					await componentInteraction.deferReply();
					sendUpgradeReaction({
						customId: id,
						packet,
						context,
						interaction: componentInteraction,
						buyMaterials: true,
						prefix: RoyalBlacksmithMenuIds.BUY_AND_UPGRADE_PREFIX
					});
					return;
				}

				if (id.startsWith(RoyalBlacksmithMenuIds.UPGRADE_PREFIX)) {
					await componentInteraction.deferReply();
					sendUpgradeReaction({
						customId: id,
						packet,
						context,
						interaction: componentInteraction,
						buyMaterials: false,
						prefix: RoyalBlacksmithMenuIds.UPGRADE_PREFIX
					});
				}
			});

			return collector;
		}
	};
}

/**
 * Get all Royal Blacksmith menus (single entry).
 */
export function getRoyalBlacksmithMenus(params: RoyalBlacksmithMenuParams): Map<string, CrowniclesNestedMenu> {
	const data = params.packet.data.data as ReactionCollectorCityData;
	const menus = new Map<string, CrowniclesNestedMenu>();
	if (!data.royalBlacksmith) {
		return menus;
	}
	menus.set(RoyalBlacksmithMenuIds.ROYAL_BLACKSMITH_MENU, getRoyalBlacksmithMenu(params));
	return menus;
}
