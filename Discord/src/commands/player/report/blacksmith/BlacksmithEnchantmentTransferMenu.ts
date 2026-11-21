import {
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder
} from "discord.js";
import { CrowniclesNestedMenu } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import {
	ReactionCollectorBlacksmithEnchantmentTransferReaction,
	ReactionCollectorCityData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	EnchantmentTransferSource, EnchantmentTransferTarget
} from "../../../../../../Lib/src/types/EnchantmentTransfer";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { BlacksmithMenuIds } from "./BlacksmithMenuConstants";
import { CityMenuParams } from "../ReportCityMenuTypes";
import {
	addCityNavigationRow, addSeparatedCitySection, buildCityMenuContainer, createCityBackButton
} from "../CityMenuLayout";
import {
	CityMenuAction, createCityMenuCollector, createCityReactionAction
} from "../CityMenuCollector";

type TransferPage = {
	params: CityMenuParams;
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

function getEnchantmentTransfers(params: CityMenuParams): EnchantmentTransferSource[] {
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
 * Send the transfer of the enchantment of the source onto the target
 */
function createTransferAction(page: TransferConfirmPage): CityMenuAction {
	const {
		params, source, target
	} = page;
	return createCityReactionAction(params, {
		isMatching: reaction => isMatchingTransferReaction(reaction, source, target),
		notFoundError: `Blacksmith enchantment transfer reaction not found from slot ${source.slot} to slot ${target.slot}, category ${source.category}`
	});
}

/**
 * Navigation buttons carrying the id of the menu they open: a transfer page only reaches the menus it offers
 */
function navigateToMenus(menuIds: string[]): ReadonlyMap<string, string> {
	return new Map(menuIds.map(menuId => [menuId, menuId]));
}

function buildTransferContainer(params: CityMenuParams, description: string): ContainerBuilder {
	return buildCityMenuContainer(params, {
		titleKey: "commands:report.city.blacksmith.enchantmentTransferTitle",
		description
	});
}

/**
 * First page: the enchanted equipments whose enchantment can be moved
 */
function getEnchantmentTransferSourcesMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const blacksmith = (params.packet.data.data as ReactionCollectorCityData).blacksmith!;
	const container = buildTransferContainer(params, i18n.t("commands:report.city.blacksmith.enchantmentTransferSourceSelectDescription", {
		lng,
		money: blacksmith.playerMoney
	}));

	const sourceMenuIds = blacksmith.enchantmentTransfers.map((source, sourceIndex) => {
		const menuId = getEnchantmentTransferSourceMenuId(sourceIndex);
		addSeparatedCitySection({
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

	addCityNavigationRow(container, lng, [createCityBackButton(BlacksmithMenuIds.BLACKSMITH_MENU, i18n.t("commands:report.city.blacksmith.backToBlacksmith", { lng }))]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, { menuIds: navigateToMenus([BlacksmithMenuIds.BLACKSMITH_MENU, ...sourceMenuIds]) })
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
		addSeparatedCitySection({
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

	addCityNavigationRow(container, lng, [createCityBackButton(BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, i18n.t("commands:report.city.blacksmith.backToItems", { lng }))]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, { menuIds: navigateToMenus([BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, ...confirmMenuIds]) })
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

	addCityNavigationRow(container, lng, [
		new ButtonBuilder()
			.setCustomId(BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER)
			.setLabel(i18n.t("commands:report.city.blacksmith.confirmEnchantmentTransfer", {
				lng,
				cost: target.cost
			}))
			.setStyle(target.canAfford ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!target.canAfford)
			.setEmoji(CrowniclesIcons.city.blacksmith.enchantmentTransfer),
		createCityBackButton(sourceMenuId, i18n.t("commands:report.city.blacksmith.backToItems", { lng }))
	]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, {
			menuIds: navigateToMenus([sourceMenuId]),
			actions: new Map([[BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER, createTransferAction(page)]])
		})
	};
}

/**
 * Register every enchantment transfer page (sources, targets of each source, confirmation of each pair)
 */
export function registerEnchantmentTransferMenus(params: CityMenuParams, menus: Map<string, CrowniclesNestedMenu>): void {
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
