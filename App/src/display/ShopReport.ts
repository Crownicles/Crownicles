import {MARKET_TRENDS, MarketTrendKind, PlantForecast, ShopOutcome} from "ws-packets/src/fromServer/shop/ShopRes";
import {missionDescription} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

/** The three moments a forecast speaks about, in the order the server sends them. */
const TIME_HORIZONS = ["tomorrow", "threeDays", "oneWeek"] as const;

function plantHeader(plantId: number, bold: boolean): string {
	return i18n.t("commands:shop.shopItems.marketAnalysis.plantHeader", {
		plantId, ...bold ? {context: "bold"} : {}
	});
}

function plantForecast(forecast: PlantForecast, prefix: string, stopAtUnknown: boolean): string {
	let text = `\n\n${plantHeader(forecast.plantId, true)}`;
	for (let i = 0; i < TIME_HORIZONS.length; i++) {
		if (forecast.trends[i] === MARKET_TRENDS.NON_APPLICABLE) {
			if (stopAtUnknown) {
				break;
			}
			continue;
		}
		text += `\n${i18n.t(`commands:shop.shopItems.marketAnalysis.${prefix}.${TIME_HORIZONS[i]}.${forecast.trends[i]}`, {plantId: forecast.plantId})}`;
	}
	return text;
}

function rotationSection(rotation: {daysUntilRotation: number; newPlantIds: number[]; newPlantForecasts: PlantForecast[]} | undefined): string {
	if (!rotation) {
		return "";
	}
	let text = `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.rotation", {
		horizon: i18n.t("commands:shop.shopItems.marketAnalysis.rotationHorizon", {count: rotation.daysUntilRotation}),
		newPlants: rotation.newPlantIds.map(plantId => plantHeader(plantId, false)).join(", ")
	})}`;
	for (const forecast of rotation.newPlantForecasts) {
		text += plantForecast(forecast, "newPlants", false);
	}
	return text;
}

function marketAnalysisReport(outcome: Extract<ShopOutcome, {kind: "marketAnalysis"}>): string {
	let text = i18n.t("commands:shop.shopItems.marketAnalysis.intro");

	text += `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.kingsMoneyTitle")}`;
	for (let i = 0; i < TIME_HORIZONS.length; i++) {
		const trend: MarketTrendKind = outcome.kingsMoneyTrends[i] ?? MARKET_TRENDS.STABLE;
		text += `\n${i18n.t(`commands:shop.shopItems.marketAnalysis.kingsMoney.${TIME_HORIZONS[i]}.${trend === MARKET_TRENDS.NON_APPLICABLE ? MARKET_TRENDS.STABLE : trend}`)}`;
	}

	text += `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.plantsTitle")}`;
	for (const forecast of outcome.plantTrends) {
		if (forecast.trends.every(trend => trend === MARKET_TRENDS.NON_APPLICABLE)) {
			continue;
		}
		text += plantForecast(forecast, "plants", true);
	}

	return `${text}${rotationSection(outcome.plantRotation)}\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.outro")}`;
}

function purchaseReport(outcome: Extract<ShopOutcome, {kind: "purchase"}>): string {
	let text = i18n.t("commands:shop.genericPurchase", {
		item: i18n.t(`commands:shop.shopItems.${outcome.shopItemId}.name`, {...outcome.translationParams}),
		count: outcome.amount
	});
	if (outcome.materials) {
		const lines = Object.entries(outcome.materials)
			.map(([materialId, quantity]) => i18n.t("commands:shop.materialLine", {
				materialId, quantity
			}));
		text += `\n\n${lines.join("\n")}`;
	}
	return text;
}

/** Tells, word for word like Discord does, what the commerce just answered. */
export function shopOutcomeReport(outcome: ShopOutcome, now: number): string {
	switch (outcome.kind) {
		case "purchase":
			return purchaseReport(outcome);
		case "notEnoughCurrency":
			return i18n.t("commands:shop.notEnoughMoney", {
				missingCurrency: outcome.missingCurrency, currency: outcome.currency
			});
		case "money":
			return i18n.t("commands:shop.shopItems.money.giveDescription", {amount: outcome.amount});
		case "kingsFavor":
			return i18n.t("commands:shop.shopItems.kingsFavor.giveDescription", {thousandPoints: outcome.thousandPoints});
		case "missionSkipped":
			return `${i18n.t("commands:shop.shopItems.skipMission.successDescription", {mission: missionDescription(outcome.oldMission, now)})}\n${
				i18n.t("commands:shop.shopItems.skipMission.getNewMission", {mission: missionDescription(outcome.newMission, now)})}`;
		case "marketAnalysis":
			return marketAnalysisReport(outcome);
		case "badge":
			return i18n.t("commands:shop.badgeBought", {badgeName: outcome.badgeId});
		case "slotBought":
			return i18n.t("commands:shop.buyCategorySlotSuccess");
		case "tooManyDailyPotions":
			return i18n.t("commands:shop.boughtTooMuchDailyPotions");
		case "noPlantSlot":
			return i18n.t("commands:shop.noPlantSlotAvailable");
		case "noGardenForTalisman":
			return i18n.t("commands:shop.noGardenForRemoteHarvestTalisman");
		case "alreadyHasBadge":
			return i18n.t("commands:shop.alreadyHaveBadge");
		case "alreadyBoughtPointsThisWeek":
			return i18n.t("commands:missionsshop.alreadyBoughtPointsThisWeek");
		case "noMissionToSkip":
			return i18n.t("commands:missionsshop.noMissionToSkip");
		default:
			return "";
	}
}

/** Whether the answer is a refusal, which the screen says in a colder tone. */
export function isShopRefusal(outcome: ShopOutcome): boolean {
	return [
		"notEnoughCurrency",
		"tooManyDailyPotions",
		"noPlantSlot",
		"noGardenForTalisman",
		"alreadyHasBadge",
		"alreadyBoughtPointsThisWeek",
		"noMissionToSkip"
	].includes(outcome.kind);
}
