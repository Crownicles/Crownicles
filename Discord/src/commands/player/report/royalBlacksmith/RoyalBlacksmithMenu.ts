import { CrowniclesNestedMenu } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import {
	ReactionCollectorCityData,
	ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { CityMenuParams } from "../ReportCityMenuTypes";
import {
	addCityNavigationRow, addSeparatedCitySection, buildCityMenuContainer, createCityBackButton
} from "../CityMenuLayout";
import { createCityMenuCollector } from "../CityMenuCollector";
import { RoyalBlacksmithMenuIds } from "./RoyalBlacksmithMenuConstants";
import { buildUpgradeDetailDescription } from "../blacksmith/BlacksmithUpgradeDetailHelper";
import {
	BlacksmithUpgradeFlow, registerBlacksmithUpgradeMenus
} from "../blacksmith/BlacksmithUpgradeMenus";

type RoyalBlacksmithData = NonNullable<ReactionCollectorCityData["royalBlacksmith"]>;
type RoyalUpgradeableItem = RoyalBlacksmithData["upgradeableItems"][number];

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
function getRoyalBlacksmithMenu(params: CityMenuParams, royal: RoyalBlacksmithData): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const container = buildCityMenuContainer(params, {
		titleKey: "commands:report.city.royalBlacksmith.title",
		description: i18n.t(getDescriptionKey(royal.status), {
			lng,
			playerLevel: royal.playerLevel,
			money: royal.playerMoney,
			gems: royal.playerGems
		})
	});

	if (royal.status === "ready") {
		addSeparatedCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.upgrade,
			title: i18n.t("commands:report.city.royalBlacksmith.upgradeLabel", { lng }),
			description: i18n.t("commands:report.city.royalBlacksmith.upgradeDescription", { lng }),
			customId: RoyalBlacksmithMenuIds.UPGRADE_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.upgrade", { lng })
		});
	}

	addCityNavigationRow(container, lng, [createCityBackButton(RoyalBlacksmithMenuIds.BACK_TO_CITY, i18n.t("commands:report.city.royalBlacksmith.backToCity", { lng }), CrowniclesIcons.city.exit)]);

	return {
		containers: [container],
		createCollector: createCityMenuCollector(params, {
			menuIds: new Map([[RoyalBlacksmithMenuIds.UPGRADE_MENU, RoyalBlacksmithMenuIds.UPGRADE_MENU]]),
			backToCityId: RoyalBlacksmithMenuIds.BACK_TO_CITY
		})
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

const ROYAL_BLACKSMITH_UPGRADE_FLOW: BlacksmithUpgradeFlow<RoyalUpgradeableItem> = {
	ids: RoyalBlacksmithMenuIds,
	translationKeys: {
		upgradeTitle: "commands:report.city.royalBlacksmith.upgradeTitle",
		confirmUpgrade: "commands:report.city.royalBlacksmith.confirmUpgrade",
		buyMaterialsAndUpgrade: "commands:report.city.royalBlacksmith.buyMaterialsAndUpgrade",
		backToItems: "commands:report.city.royalBlacksmith.backToItems"
	},
	backToBlacksmith: {
		customId: RoyalBlacksmithMenuIds.BACK_TO_ROYAL_BLACKSMITH,
		labelKey: "commands:report.city.royalBlacksmith.backToRoyalBlacksmith",
		menuId: RoyalBlacksmithMenuIds.ROYAL_BLACKSMITH_MENU
	},
	upgradeReaction: ReactionCollectorRoyalBlacksmithUpgradeReaction,
	logName: "Royal blacksmith",
	describeOffer: (item, lng) => i18n.t("commands:report.city.royalBlacksmith.itemUpgradePreview", {
		lng,
		currentLevel: item.details.itemLevel ?? 0,
		upgradeCost: item.upgradeCost,
		gemCost: item.gemCost
	}),
	describeUpgrade: buildRoyalUpgradeDetailDescription
};

/**
 * Get all Royal Blacksmith menus: status screen, item selection, and per-item detail screens.
 */
export function getRoyalBlacksmithMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	const royal = (params.packet.data.data as ReactionCollectorCityData).royalBlacksmith;
	const menus = new Map<string, CrowniclesNestedMenu>();
	if (!royal) {
		return menus;
	}
	menus.set(RoyalBlacksmithMenuIds.ROYAL_BLACKSMITH_MENU, getRoyalBlacksmithMenu(params, royal));

	if (royal.status === "ready") {
		registerBlacksmithUpgradeMenus(menus, params, {
			flow: ROYAL_BLACKSMITH_UPGRADE_FLOW,
			description: i18n.t("commands:report.city.royalBlacksmith.upgradeSelectDescription", {
				lng: params.interaction.userLanguage,
				money: royal.playerMoney,
				gems: royal.playerGems
			}),
			offers: royal.upgradeableItems
		});
	}
	return menus;
}
