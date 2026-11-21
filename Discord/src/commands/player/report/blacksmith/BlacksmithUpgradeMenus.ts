import {
	ButtonBuilder, ButtonStyle
} from "discord.js";
import { CrowniclesNestedMenu } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import {
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CityMenuParams } from "../ReportCityMenuTypes";
import {
	addCityNavigationRow, addSeparatedCitySection, buildCityMenuContainer, createCityBackButton
} from "../CityMenuLayout";
import {
	CityMenuAction, createCityMenuCollector, createCityReactionAction
} from "../CityMenuCollector";
import { UpgradeItemForDisplay } from "./BlacksmithUpgradeDetailHelper";

/**
 * Item that the blacksmith or the royal blacksmith offers to upgrade
 */
export type BlacksmithUpgradeOffer = UpgradeItemForDisplay & {
	slot: number;
	category: ItemCategory;
	canUpgrade: boolean;
	canBuyAndUpgrade: boolean;
};

type BlacksmithUpgradeReaction = typeof ReactionCollectorBlacksmithUpgradeReaction | typeof ReactionCollectorRoyalBlacksmithUpgradeReaction;

/**
 * What tells the upgrade menus of the blacksmith and of the royal blacksmith apart
 */
export type BlacksmithUpgradeFlow<Offer extends BlacksmithUpgradeOffer> = {

	/** Custom ids of the buttons and id of the upgrade list menu, named alike by both blacksmiths */
	ids: Readonly<Record<"UPGRADE_MENU" | "UPGRADE_ITEM_PREFIX" | "BACK_TO_UPGRADE_LIST" | "CONFIRM_UPGRADE" | "BUY_AND_UPGRADE", string>>;

	translationKeys: {
		upgradeTitle: string;
		confirmUpgrade: string;
		buyMaterialsAndUpgrade: string;
		backToItems: string;
	};

	/** Button of the upgrade list leading back to the menu of the blacksmith */
	backToBlacksmith: {
		customId: string;
		labelKey: string;
		menuId: string;
	};

	upgradeReaction: BlacksmithUpgradeReaction;

	/** Name of the blacksmith in the logs */
	logName: string;

	/** Line describing the upgrade of an item in the upgrade list */
	describeOffer: (offer: Offer, lng: Language) => string;

	/** Description of the upgrade detail menu of an item */
	describeUpgrade: (offer: Offer, lng: Language) => string;
};

/**
 * Upgrade list of a blacksmith: the items it can upgrade, below its description
 */
export type BlacksmithUpgradeList<Offer extends BlacksmithUpgradeOffer> = {
	flow: BlacksmithUpgradeFlow<Offer>;
	description: string;
	offers: Offer[];
};

type BlacksmithUpgrade<Offer extends BlacksmithUpgradeOffer> = {
	flow: BlacksmithUpgradeFlow<Offer>;
	offer: Offer;
};

function isBlacksmithUpgradeReaction(reaction: {
	type: string; data: unknown;
}, upgradeReaction: BlacksmithUpgradeReaction): reaction is {
	type: string; data: InstanceType<BlacksmithUpgradeReaction>;
} {
	if (reaction.type !== upgradeReaction.name) {
		return false;
	}
	const data = reaction.data as Record<string, unknown>;
	return typeof data.slot === "number" && typeof data.itemCategory === "number" && typeof data.buyMaterials === "boolean";
}

function getUpgradeDetailMenuId<Offer extends BlacksmithUpgradeOffer>(flow: BlacksmithUpgradeFlow<Offer>, itemIndex: number): string {
	return `${flow.ids.UPGRADE_MENU}_DETAIL_${itemIndex}`;
}

function getUpgradeListMenu<Offer extends BlacksmithUpgradeOffer>(params: CityMenuParams, list: BlacksmithUpgradeList<Offer>): CrowniclesNestedMenu {
	const {
		flow, description, offers
	} = list;
	const lng = params.interaction.userLanguage;
	const container = buildCityMenuContainer(params, {
		titleKey: flow.translationKeys.upgradeTitle,
		description
	});

	offers.forEach((offer, itemIndex) => {
		addSeparatedCitySection({
			container,
			text: `${DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(offer.details, lng)}\n${flow.describeOffer(offer, lng)}`,
			customId: `${flow.ids.UPGRADE_ITEM_PREFIX}${itemIndex}`,
			buttonLabel: i18n.t("commands:report.city.buttons.upgrade", { lng }),
			emoji: CrowniclesIcons.city.blacksmith.upgrade
		});
	});

	addCityNavigationRow(container, lng, [createCityBackButton(flow.backToBlacksmith.customId, i18n.t(flow.backToBlacksmith.labelKey, { lng }))]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, {
			menuIds: new Map([[flow.backToBlacksmith.customId, flow.backToBlacksmith.menuId]]),
			itemSelection: {
				customIdPrefix: flow.ids.UPGRADE_ITEM_PREFIX,
				getMenuId: itemIndex => getUpgradeDetailMenuId(flow, itemIndex)
			}
		})
	};
}

/**
 * Upgrade the item, after buying its missing materials when `buyMaterials` is set
 */
function createUpgradeAction<Offer extends BlacksmithUpgradeOffer>(
	params: CityMenuParams,
	upgrade: BlacksmithUpgrade<Offer>,
	buyMaterials: boolean
): CityMenuAction {
	const {
		flow, offer
	} = upgrade;
	return createCityReactionAction(params, {
		isMatching: reaction => isBlacksmithUpgradeReaction(reaction, flow.upgradeReaction)
			&& reaction.data.slot === offer.slot
			&& reaction.data.itemCategory === offer.category
			&& reaction.data.buyMaterials === buyMaterials,
		notFoundError: `${flow.logName} upgrade reaction not found for slot ${offer.slot}, category ${offer.category}, buyMaterials ${buyMaterials}`
	});
}

/**
 * The upgrade button, and the one buying the missing materials first when some are missing
 */
function createUpgradeButtons<Offer extends BlacksmithUpgradeOffer>(upgrade: BlacksmithUpgrade<Offer>, lng: Language): ButtonBuilder[] {
	const {
		flow, offer
	} = upgrade;
	const buttons = [
		new ButtonBuilder()
			.setCustomId(flow.ids.CONFIRM_UPGRADE)
			.setLabel(i18n.t(flow.translationKeys.confirmUpgrade, {
				lng,
				cost: offer.upgradeCost
			}))
			.setStyle(offer.canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!offer.canUpgrade)
			.setEmoji(CrowniclesIcons.city.blacksmith.upgrade)
	];
	if (!offer.hasAllMaterials) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(flow.ids.BUY_AND_UPGRADE)
				.setLabel(i18n.t(flow.translationKeys.buyMaterialsAndUpgrade, {
					lng,
					cost: offer.upgradeCost + offer.missingMaterialsCost
				}))
				.setStyle(offer.canBuyAndUpgrade ? ButtonStyle.Primary : ButtonStyle.Secondary)
				.setDisabled(!offer.canBuyAndUpgrade)
				.setEmoji(CrowniclesIcons.collectors.accept)
		);
	}
	return buttons;
}

function getUpgradeDetailMenu<Offer extends BlacksmithUpgradeOffer>(params: CityMenuParams, upgrade: BlacksmithUpgrade<Offer>): CrowniclesNestedMenu {
	const {
		flow, offer
	} = upgrade;
	const lng = params.interaction.userLanguage;
	const container = buildCityMenuContainer(params, {
		titleKey: flow.translationKeys.upgradeTitle,
		description: flow.describeUpgrade(offer, lng)
	});

	addCityNavigationRow(container, lng, [
		...createUpgradeButtons(upgrade, lng),
		createCityBackButton(flow.ids.BACK_TO_UPGRADE_LIST, i18n.t(flow.translationKeys.backToItems, { lng }))
	]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, {
			menuIds: new Map([[flow.ids.BACK_TO_UPGRADE_LIST, flow.ids.UPGRADE_MENU]]),
			actions: new Map([
				[flow.ids.CONFIRM_UPGRADE, createUpgradeAction(params, upgrade, false)],
				[flow.ids.BUY_AND_UPGRADE, createUpgradeAction(params, upgrade, true)]
			]),
			ignoreOtherClicks: true
		})
	};
}

/**
 * Register the upgrade list of a blacksmith and the upgrade detail menu of each of its items
 */
export function registerBlacksmithUpgradeMenus<Offer extends BlacksmithUpgradeOffer>(
	menus: Map<string, CrowniclesNestedMenu>,
	params: CityMenuParams,
	list: BlacksmithUpgradeList<Offer>
): void {
	const { flow } = list;
	menus.set(flow.ids.UPGRADE_MENU, getUpgradeListMenu(params, list));
	list.offers.forEach((offer, itemIndex) => {
		menus.set(getUpgradeDetailMenuId(flow, itemIndex), getUpgradeDetailMenu(params, {
			flow, offer
		}));
	});
}
