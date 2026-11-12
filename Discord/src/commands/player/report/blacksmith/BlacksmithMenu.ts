import { CrowniclesNestedMenu } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import {
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorCityData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { BlacksmithMenuIds } from "./BlacksmithMenuConstants";
import { CityMenuParams } from "../ReportCityMenuTypes";
import {
	addCityNavigationRow, addSeparatedCitySection, buildCityMenuContainer, createCityBackButton
} from "../CityMenuLayout";
import { createCityMenuCollector } from "../CityMenuCollector";
import { buildUpgradeDetailDescription } from "./BlacksmithUpgradeDetailHelper";
import {
	BlacksmithUpgradeFlow, registerBlacksmithUpgradeMenus
} from "./BlacksmithUpgradeMenus";
import { registerEnchantmentTransferMenus } from "./BlacksmithEnchantmentTransferMenu";

type BlacksmithData = NonNullable<ReactionCollectorCityData["blacksmith"]>;

type BlacksmithUpgradeableItem = BlacksmithData["upgradeableItems"][number];

/**
 * Get the translation key for the blacksmith menu description based on available services
 */
function getDescriptionKeyBlacksmithMenu(blacksmith: BlacksmithData): string {
	const hasUpgrades = blacksmith.upgradeableItems.length > 0;
	const hasTransfers = blacksmith.enchantmentTransfers.length > 0;

	if (hasUpgrades && hasTransfers) {
		return "commands:report.city.blacksmith.descriptionBoth";
	}
	if (hasUpgrades) {
		return "commands:report.city.blacksmith.descriptionUpgradeOnly";
	}
	if (hasTransfers) {
		return "commands:report.city.blacksmith.descriptionEnchantmentTransferOnly";
	}
	return "commands:report.city.blacksmith.descriptionNoItems";
}

/**
 * Get the main blacksmith menu, leading to the upgrade and enchantment transfer menus
 */
function getBlacksmithMenu(params: CityMenuParams, blacksmith: BlacksmithData): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const container = buildCityMenuContainer(params, {
		titleKey: "commands:report.city.blacksmith.title",
		description: i18n.t(getDescriptionKeyBlacksmithMenu(blacksmith), { lng })
	});

	if (blacksmith.upgradeableItems.length > 0) {
		addSeparatedCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.upgrade,
			title: i18n.t("commands:report.city.blacksmith.upgradeLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.upgradeDescription", { lng }),
			customId: BlacksmithMenuIds.UPGRADE_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.upgrade", { lng })
		});
	}

	if (blacksmith.enchantmentTransfers.length > 0) {
		addSeparatedCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.enchantmentTransfer,
			title: i18n.t("commands:report.city.blacksmith.enchantmentTransferLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.enchantmentTransferDescription", { lng }),
			customId: BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.transfer", { lng })
		});
	}

	addCityNavigationRow(container, lng, [createCityBackButton(BlacksmithMenuIds.BACK_TO_CITY, i18n.t("commands:report.city.blacksmith.backToCity", { lng }), CrowniclesIcons.city.exit)]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, {
			menuIds: new Map([
				[BlacksmithMenuIds.UPGRADE_MENU, BlacksmithMenuIds.UPGRADE_MENU],
				[BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU, BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU]
			]),
			backToCityId: BlacksmithMenuIds.BACK_TO_CITY
		})
	};
}

/**
 * Build description for upgrade item details
 */
function buildUpgradeDetailDescriptionForStandard(item: BlacksmithUpgradeableItem, lng: Language): string {
	return buildUpgradeDetailDescription({
		item,
		lng,
		titleKey: "commands:report.city.blacksmith.upgradeItemDetailsBase",
		titleParams: {
			currentLevel: item.details.itemLevel ?? 0,
			nextLevel: item.nextLevel,
			upgradeCost: item.upgradeCost
		},
		missingOfferKey: "commands:report.city.blacksmith.missingMaterialsOffer"
	});
}

const BLACKSMITH_UPGRADE_FLOW: BlacksmithUpgradeFlow<BlacksmithUpgradeableItem> = {
	ids: BlacksmithMenuIds,
	translationKeys: {
		upgradeTitle: "commands:report.city.blacksmith.upgradeTitle",
		confirmUpgrade: "commands:report.city.blacksmith.confirmUpgrade",
		buyMaterialsAndUpgrade: "commands:report.city.blacksmith.buyMaterialsAndUpgrade",
		backToItems: "commands:report.city.blacksmith.backToItems"
	},
	backToBlacksmith: {
		customId: BlacksmithMenuIds.BACK_TO_BLACKSMITH,
		labelKey: "commands:report.city.blacksmith.backToBlacksmith",
		menuId: BlacksmithMenuIds.BLACKSMITH_MENU
	},
	upgradeReaction: ReactionCollectorBlacksmithUpgradeReaction,
	logName: "Blacksmith",
	describeOffer: (item, lng) => i18n.t("commands:report.city.blacksmith.itemUpgradePreview", {
		lng,
		currentLevel: item.details.itemLevel ?? 0,
		nextLevel: item.nextLevel,
		cost: item.upgradeCost
	}),
	describeUpgrade: buildUpgradeDetailDescriptionForStandard
};

/**
 * Get all blacksmith menus (main + sub-menus) for registration
 */
export function getBlacksmithMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	const blacksmith = (params.packet.data.data as ReactionCollectorCityData).blacksmith;
	const menus = new Map<string, CrowniclesNestedMenu>();

	if (!blacksmith) {
		return menus;
	}

	menus.set(BlacksmithMenuIds.BLACKSMITH_MENU, getBlacksmithMenu(params, blacksmith));

	if (blacksmith.upgradeableItems.length > 0) {
		registerBlacksmithUpgradeMenus(menus, params, {
			flow: BLACKSMITH_UPGRADE_FLOW,
			description: i18n.t("commands:report.city.blacksmith.upgradeSelectDescription", {
				lng: params.interaction.userLanguage,
				money: blacksmith.playerMoney
			}),
			offers: blacksmith.upgradeableItems
		});
	}

	registerEnchantmentTransferMenus(params, menus);

	return menus;
}
