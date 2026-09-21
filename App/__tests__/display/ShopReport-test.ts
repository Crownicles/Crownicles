import {ShopOutcome, MARKET_TRENDS} from "ws-packets/src/fromServer/shop/ShopRes";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {isShopRefusal, shopOutcomeReport} from "@/src/display/ShopReport";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => path}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {
	language: "fr",
	t: (key: string | string[], options?: Record<string, unknown>): string => {
		const resolved = Array.isArray(key) ? key[0] : key;
		return options && Object.keys(options).length > 0 ? `${resolved}(${JSON.stringify(options)})` : resolved;
	}
}}));

const NOW = 1_700_000_000_000;

describe("shop outcome report", () => {
	it("names the bought item and lists the materials it came with", () => {
		const report = shopOutcomeReport({
			kind: "purchase", shopItemId: "randomItem", amount: 2, materials: {iron: 3}
		}, NOW);
		expect(report).toContain("commands:shop.genericPurchase");
		expect(report).toContain("commands:shop.shopItems.randomItem.name");
		expect(report).toContain("commands:shop.materialLine");
		expect(report).toContain("\"quantity\":3");
	});

	it("says how much currency is missing", () => {
		const report = shopOutcomeReport({
			kind: "notEnoughCurrency", missingCurrency: 40, currency: "money"
		}, NOW);
		expect(report).toContain("commands:shop.notEnoughMoney");
		expect(report).toContain("\"missingCurrency\":40");
	});

	it("tells the forecast of every horizon a trend is known for", () => {
		const report = shopOutcomeReport({
			kind: "marketAnalysis",
			kingsMoneyTrends: [MARKET_TRENDS.RISE, MARKET_TRENDS.DROP, MARKET_TRENDS.STABLE],
			plantTrends: [
				{plantId: 1, trends: [MARKET_TRENDS.BIG_RISE, MARKET_TRENDS.NON_APPLICABLE, MARKET_TRENDS.DROP]},
				{plantId: 2, trends: [MARKET_TRENDS.NON_APPLICABLE, MARKET_TRENDS.NON_APPLICABLE, MARKET_TRENDS.NON_APPLICABLE]}
			]
		}, NOW);
		expect(report).toContain("marketAnalysis.kingsMoney.tomorrow.rise");
		expect(report).toContain("marketAnalysis.kingsMoney.threeDays.drop");
		expect(report).toContain("marketAnalysis.plants.tomorrow.bigRise");
		expect(report).not.toContain("marketAnalysis.plants.oneWeek.drop");
		expect(report).not.toContain("\"plantId\":2");
		expect(report).toContain("marketAnalysis.outro");
	});

	it("describes both the dropped mission and the one taking its place", () => {
		const mission = {
			missionId: "travel", missionObjective: 3, missionVariant: 0, numberDone: 0, missionType: MISSION_TYPES.NORMAL
		};
		const report = shopOutcomeReport({
			kind: "missionSkipped", oldMission: mission, newMission: {...mission, missionId: "fight"}
		}, NOW);
		expect(report).toContain("skipMission.successDescription");
		expect(report).toContain("skipMission.getNewMission");
	});

	it("keeps a refusal apart from a successful transaction", () => {
		const refusals: ShopOutcome[] = [
			{kind: "noPlantSlot"},
			{kind: "alreadyHasBadge"},
			{kind: "notEnoughCurrency", missingCurrency: 1, currency: "money"}
		];
		for (const refusal of refusals) {
			expect(isShopRefusal(refusal)).toBe(true);
		}
		expect(isShopRefusal({kind: "slotBought"})).toBe(false);
		expect(isShopRefusal({kind: "badge", badgeId: "rich"})).toBe(false);
	});
});
