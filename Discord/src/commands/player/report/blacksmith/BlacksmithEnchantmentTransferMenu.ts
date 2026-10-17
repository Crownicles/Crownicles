import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenuCollectorFactory
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { StringUtils } from "../../../../utils/StringUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import {
	ReactionCollectorBlacksmithEnchantmentTransferReaction,
	ReactionCollectorCityData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	EnchantmentTransferSource, EnchantmentTransferTarget
} from "../../../../../../Lib/src/types/EnchantmentTransfer";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { Language } from "../../../../../../Lib/src/Language";
import { BlacksmithMenuIds } from "./BlacksmithMenuConstants";
import type { BlacksmithMenuParams } from "./BlacksmithMenu";
import {
	addCitySection, createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";

type TransferPage = {
	params: BlacksmithMenuParams;
	source: EnchantmentTransferSource;
};

type TransferConfirmPage = TransferPage & {
	target: EnchantmentTransferTarget;
};

function getEnchantmentTransferSourceMenuId(sourceIndex: number): string {
	return `${BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU}_SOURCE_${sourceIndex}`;
}

function getEnchantmentTransferConfirmMenuId(sourceIndex: number, targetIndex: number): string {
	return `${getEnchantmentTransferSourceMenuId(sourceIndex)}_TARGET_${targetIndex}`;
}

function getEnchantmentTransfers(params: BlacksmithMenuParams): EnchantmentTransferSource[] {
	return (params.packet.data.data as ReactionCollectorCityData).blacksmith!.enchantmentTransfers;
}

function getItemDisplay(details: EnchantmentTransferTarget["details"], lng: Language): string {
	return DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(details, lng);
}

/**
 * Whether a collector reaction is the transfer of the given source onto the given target
 */
function isMatchingTransferReaction(
	reaction: {
		type: string; data: unknown;
	},
	source: EnchantmentTransferSource,
	target: EnchantmentTransferTarget
): boolean {
	if (reaction.type !== ReactionCollectorBlacksmithEnchantmentTransferReaction.name) {
		return false;
	}
	const data = reaction.data as ReactionCollectorBlacksmithEnchantmentTransferReaction;
	return data.itemCategory === source.category && data.sourceSlot === source.slot && data.targetSlot === target.slot;
}

/**
 * Collector shared by every transfer page: each navigation button carries the id of the menu it opens
 * (restricted to the ones the page offers), and the confirm button sends the matching transfer reaction
 */
function createEnchantmentTransferCollector(
	params: BlacksmithMenuParams,
	reachableMenuIds: string[],
	transfer?: Omit<TransferConfirmPage, "params">
): CrowniclesNestedMenuCollectorFactory {
	const {
		context, interaction, packet, collectorTime
	} = params;
	const lng = interaction.userLanguage;
	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			if (transfer && buttonInteraction.customId === BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER) {
				await buttonInteraction.deferReply();
				const reactionIndex = packet.reactions.findIndex(reaction => isMatchingTransferReaction(reaction, transfer.source, transfer.target));
				if (reactionIndex === -1) {
					CrowniclesLogger.error(`Blacksmith enchantment transfer reaction not found from slot ${transfer.source.slot} to slot ${transfer.target.slot}, category ${transfer.source.category}`);
					await buttonInteraction.deleteReply();
					return;
				}
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
				return;
			}

			await buttonInteraction.deferUpdate();
			if (buttonInteraction.customId === ReportCityMenuIds.STAY_IN_CITY) {
				handleStayInCityInteraction(packet, context, buttonInteraction);
			}
			else if (reachableMenuIds.includes(buttonInteraction.customId)) {
				await nestedMenus.changeMenu(buttonInteraction.customId);
			}
		});

		return collector;
	};
}

function buildTransferContainer(params: BlacksmithMenuParams, description: string): ContainerBuilder {
	const lng = params.interaction.userLanguage;
	return new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(i18n.t("commands:report.city.blacksmith.enchantmentTransferTitle", {
				lng,
				pseudo: params.pseudo
			}))),
			new TextDisplayBuilder().setContent(description)
		);
}

function addNavigationRow(container: ContainerBuilder, lng: Language, buttons: ButtonBuilder[]): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons, createStayInCityButton(lng))
	);
}

function createBackButton(menuId: string, label: string): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(menuId)
		.setLabel(label)
		.setEmoji(CrowniclesIcons.city.back)
		.setStyle(ButtonStyle.Secondary);
}

/**
 * First page: the enchanted equipments whose enchantment can be moved
 */
function getEnchantmentTransferSourcesMenu(params: BlacksmithMenuParams): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const blacksmith = (params.packet.data.data as ReactionCollectorCityData).blacksmith!;
	const container = buildTransferContainer(params, i18n.t("commands:report.city.blacksmith.enchantmentTransferSourceSelectDescription", {
		lng,
		money: blacksmith.playerMoney
	}));

	const sourceMenuIds = blacksmith.enchantmentTransfers.map((source, sourceIndex) => {
		const menuId = getEnchantmentTransferSourceMenuId(sourceIndex);
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			text: i18n.t("commands:report.city.blacksmith.enchantmentTransferSourcePreview", {
				lng,
				item: getItemDisplay(source.details, lng),
				enchantmentId: source.enchantmentId,
				enchantmentType: source.enchantmentType
			}),
			customId: menuId,
			buttonLabel: i18n.t("commands:report.city.buttons.choose", { lng }),
			emoji: CrowniclesIcons.city.blacksmith.enchantmentTransfer
		});
		return menuId;
	});

	addNavigationRow(container, lng, [createBackButton(BlacksmithMenuIds.BLACKSMITH_MENU, i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }))]);

	return {
		containers: [container],
		createCollector: createEnchantmentTransferCollector(params, [BlacksmithMenuIds.BLACKSMITH_MENU, ...sourceMenuIds])
	};
}

/**
 * Second page: the equipments able to receive the enchantment of the chosen source, with the price of each transfer
 */
function getEnchantmentTransferTargetsMenu(page: TransferPage, sourceIndex: number): CrowniclesNestedMenu {
	const {
		params, source
	} = page;
	const lng = params.interaction.userLanguage;
	const container = buildTransferContainer(params, i18n.t("commands:report.city.blacksmith.enchantmentTransferTargetSelectDescription", {
		lng,
		item: getItemDisplay(source.details, lng),
		enchantmentId: source.enchantmentId,
		enchantmentType: source.enchantmentType
	}));

	const confirmMenuIds = source.targets.map((target, targetIndex) => {
		const menuId = getEnchantmentTransferConfirmMenuId(sourceIndex, targetIndex);
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			text: i18n.t("commands:report.city.blacksmith.enchantmentTransferTargetPreview", {
				lng,
				item: getItemDisplay(target.details, lng),
				cost: target.cost
			}),
			customId: menuId,
			buttonLabel: i18n.t("commands:report.city.buttons.choose", { lng }),
			emoji: CrowniclesIcons.city.blacksmith.enchantmentTransfer
		});
		return menuId;
	});

	addNavigationRow(container, lng, [createBackButton(BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, i18n.t("commands:report.city.blacksmith.backToItems", { lng }))]);

	return {
		containers: [container],
		createCollector: createEnchantmentTransferCollector(params, [BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, ...confirmMenuIds])
	};
}

/**
 * Last page: recap of the transfer and its price, with the confirm button
 */
function getEnchantmentTransferConfirmMenu(page: TransferConfirmPage, sourceIndex: number): CrowniclesNestedMenu {
	const {
		params, source, target
	} = page;
	const lng = params.interaction.userLanguage;
	const sourceMenuId = getEnchantmentTransferSourceMenuId(sourceIndex);
	const container = buildTransferContainer(params, i18n.t("commands:report.city.blacksmith.enchantmentTransferConfirmDescription", {
		lng,
		sourceItem: getItemDisplay(source.details, lng),
		targetItem: getItemDisplay(target.details, lng),
		enchantmentId: source.enchantmentId,
		enchantmentType: source.enchantmentType,
		cost: target.cost
	}));

	addNavigationRow(container, lng, [
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER)
			.setLabel(i18n.t("commands:report.city.blacksmith.confirmEnchantmentTransfer", {
				lng,
				cost: target.cost
			}))
			.setStyle(target.canAfford ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!target.canAfford)
			.setEmoji(CrowniclesIcons.city.blacksmith.enchantmentTransfer),
		createBackButton(sourceMenuId, i18n.t("commands:report.city.blacksmith.backToItems", { lng }))
	]);

	return {
		containers: [container],
		createCollector: createEnchantmentTransferCollector(params, [sourceMenuId], {
			source, target
		})
	};
}

/**
 * Register every enchantment transfer page (sources, targets of each source, confirmation of each pair)
 */
export function registerEnchantmentTransferMenus(params: BlacksmithMenuParams, menus: Map<string, CrowniclesNestedMenu>): void {
	const enchantmentTransfers = getEnchantmentTransfers(params);
	if (enchantmentTransfers.length === 0) {
		return;
	}

	menus.set(BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, getEnchantmentTransferSourcesMenu(params));
	enchantmentTransfers.forEach((source, sourceIndex) => {
		menus.set(getEnchantmentTransferSourceMenuId(sourceIndex), getEnchantmentTransferTargetsMenu({
			params, source
		}, sourceIndex));
		source.targets.forEach((target, targetIndex) => {
			menus.set(getEnchantmentTransferConfirmMenuId(sourceIndex, targetIndex), getEnchantmentTransferConfirmMenu({
				params, source, target
			}, sourceIndex));
		});
	});
}
