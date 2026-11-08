import {
	MARKET_TRENDS, MarketTrendKind, PlantForecast, ShopOutcome
} from "ws-packets/src/fromServer/shop/ShopRes";
import { missionDescription } from "@/src/display/Missions";
import { i18n } from "@/src/translations/i18n";
import {
	joinLines, joinParagraphs
} from "@/src/display/Paragraphs";

/** The three moments a forecast speaks about, in the order the server sends them. */
const TIME_HORIZONS = [
	"tomorrow",
	"threeDays",
	"oneWeek"
] as const;

function plantHeader(plantId: number, bold: boolean): string {
	return i18n.t("commands:shop.shopItems.marketAnalysis.plantHeader", {
		plantId, ...bold ? { context: "bold" } : {}
	});
}

/** One thing the advisor forecasts, and what it says at each horizon it can see. */
export type MarketForecast = {
	id: string; heading: string; lines: string[];
};

export type MarketReport = {
	intro: string;
	kingsMoneyTitle: string;
	kingsMoney: string[];
	plantsTitle: string;
	plants: MarketForecast[];
	rotation?: {
		notice: string; plants: MarketForecast[];
	};
	outro: string;
};

function forecastLines(forecast: PlantForecast, prefix: string, stopAtUnknown: boolean): string[] {
	const lines: string[] = [];
	for (let i = 0; i < TIME_HORIZONS.length; i++) {
		if (forecast.trends[i] === MARKET_TRENDS.NON_APPLICABLE) {
			if (stopAtUnknown) {
				break;
			}
			continue;
		}
		lines.push(i18n.t(`commands:shop.shopItems.marketAnalysis.${prefix}.${TIME_HORIZONS[i]}.${forecast.trends[i]}`, { plantId: forecast.plantId }));
	}
	return lines;
}

function plantForecasts(forecasts: PlantForecast[], prefix: string, stopAtUnknown: boolean): MarketForecast[] {
	return forecasts
		.filter(forecast => !forecast.trends.every(trend => trend === MARKET_TRENDS.NON_APPLICABLE))
		.map(forecast => ({
			id: `${prefix}-${forecast.plantId}`,
			heading: plantHeader(forecast.plantId, false),
			lines: forecastLines(forecast, prefix, stopAtUnknown)
		}));
}

function rotationReport(rotation: {
	daysUntilRotation: number; newPlantIds: number[]; newPlantForecasts: PlantForecast[];
}): MarketReport["rotation"] {
	return {
		notice: i18n.t("commands:shop.shopItems.marketAnalysis.rotation", {
			horizon: i18n.t("commands:shop.shopItems.marketAnalysis.rotationHorizon", { count: rotation.daysUntilRotation }),
			newPlants: rotation.newPlantIds.map(plantId => plantHeader(plantId, false)).join(", ")
		}),
		plants: plantForecasts(rotation.newPlantForecasts, "newPlants", false)
	};
}

/** The advisor's report kept in pieces, because a wall of prose is unreadable on a phone. */
export function marketReport(outcome: Extract<ShopOutcome, { kind: "marketAnalysis" }>): MarketReport {
	return {
		intro: i18n.t("commands:shop.shopItems.marketAnalysis.intro"),
		kingsMoneyTitle: i18n.t("commands:shop.shopItems.marketAnalysis.kingsMoneyTitle"),
		kingsMoney: TIME_HORIZONS.map((horizon, index) => {
			const trend: MarketTrendKind = outcome.kingsMoneyTrends[index] ?? MARKET_TRENDS.STABLE;
			return i18n.t(`commands:shop.shopItems.marketAnalysis.kingsMoney.${horizon}.${trend === MARKET_TRENDS.NON_APPLICABLE ? MARKET_TRENDS.STABLE : trend}`);
		}),
		plantsTitle: i18n.t("commands:shop.shopItems.marketAnalysis.plantsTitle"),
		plants: plantForecasts(outcome.plantTrends, "plants", true),
		...outcome.plantRotation ? { rotation: rotationReport(outcome.plantRotation) } : {},
		outro: i18n.t("commands:shop.shopItems.marketAnalysis.outro")
	};
}


function purchaseReport(outcome: Extract<ShopOutcome, { kind: "purchase" }>): string {
	const materialLines = Object.entries(outcome.materials ?? {})
		.map(([materialId, quantity]) => i18n.t("commands:shop.materialLine", {
			materialId, quantity
		}));
	return joinParagraphs([
		i18n.t("commands:shop.genericPurchase", {
			item: i18n.t(`commands:shop.shopItems.${outcome.shopItemId}.name`, { ...outcome.translationParams }),
			count: outcome.amount
		}),
		joinLines(materialLines),
		outcome.plantsSentToHomeStorage ? i18n.t("commands:shop.plantsSentToHomeStorage", { count: outcome.plantsSentToHomeStorage }) : null
	]);
}

type ReportedOutcome = Exclude<ShopOutcome, { kind: "marketAnalysis" }>;

/** The answers that are a sentence and nothing more. */
const FIXED_REPORTS = {
	slotBought: "commands:shop.buyCategorySlotSuccess",
	tooManyDailyPotions: "commands:shop.boughtTooMuchDailyPotions",
	noGardenForTalisman: "commands:shop.noGardenForRemoteHarvestTalisman",
	alreadyHasBadge: "commands:shop.alreadyHaveBadge",
	alreadyBoughtPointsThisWeek: "commands:missionsshop.error.alreadyBoughtPointsThisWeek",
	noMissionToSkip: "commands:missionsshop.error.noMissionToSkip"
} as const satisfies Partial<Record<ReportedOutcome["kind"], string>>;

function isFixedReport(outcome: ReportedOutcome): outcome is Extract<ReportedOutcome, { kind: keyof typeof FIXED_REPORTS }> {
	return outcome.kind in FIXED_REPORTS;
}

type DetailedReportKind = Exclude<ReportedOutcome["kind"], keyof typeof FIXED_REPORTS>;
type OutcomeOf<Kind extends ReportedOutcome["kind"]> = Extract<ReportedOutcome, { kind: Kind }>;

/** The answers whose sentence carries what the server granted or refused. */
const DETAILED_REPORTS: { [Kind in DetailedReportKind]: (outcome: OutcomeOf<Kind>, now: number) => string } = {
	purchase: purchaseReport,
	noPlantSlot: outcome => i18n.t(outcome.reason ? `commands:shop.noPlantSpace.${outcome.reason}` : "commands:shop.noPlantSlotAvailable"),
	notEnoughCurrency: outcome => i18n.t("commands:shop.notEnoughMoney", {
		missingCurrency: outcome.missingCurrency, currency: outcome.currency
	}),
	money: outcome => i18n.t("commands:shop.shopItems.money.giveDescription", { amount: outcome.amount }),
	kingsFavor: outcome => i18n.t("commands:shop.shopItems.kingsFavor.giveDescription", { thousandPoints: outcome.thousandPoints }),
	missionSkipped: (outcome, now) => joinLines([
		i18n.t("commands:shop.shopItems.skipMission.successDescription", { mission: missionDescription(outcome.oldMission, now) }),
		i18n.t("commands:shop.shopItems.skipMission.getNewMission", { mission: missionDescription(outcome.newMission, now) })
	]),
	badge: outcome => i18n.t("commands:shop.badgeBought", { badgeName: outcome.badgeId })
};

/** Tells, word for word like Discord does, what the commerce just answered. The market report has its own screen. */
export function shopOutcomeReport(outcome: ReportedOutcome, now: number): string {
	if (isFixedReport(outcome)) {
		return i18n.t(FIXED_REPORTS[outcome.kind]);
	}

	/*
	 * TypeScript cannot tie the handler picked by the kind to that same member of the union, which the map guarantees.
	 * A kind added by a newer server has no handler in an installed app: it tells nothing rather than breaking the screen.
	 */
	const report = DETAILED_REPORTS[outcome.kind] as ((detailed: typeof outcome, at: number) => string) | undefined;
	return report?.(outcome, now) ?? "";
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
