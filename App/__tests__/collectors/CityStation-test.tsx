import {
	render, screen
} from "@testing-library/react-native";
import {
	CITY_REACTION_KINDS, CITY_STATION_LIMITS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { submenuSections } from "@/src/collectors/CitySubmenuSections";
import { cityReactionLock } from "@/src/collectors/CityReactionLocks";
import { cityRowSubtitle } from "@/src/collectors/CityRowSubtitle";
import { cityRowEnd } from "@/src/collectors/CityRowEnd";
import {
	cityUpgradeConfirm, cityUpgradeDetails
} from "@/src/collectors/CityUpgradeDetails";
import { StationLimitStory } from "@/src/collectors/CityItemStories";
import type { CityListItem } from "@/src/collectors/CityCollector";

const deps = {
	homeFeatureItems: (): [] => [], gardenPlotItems: (): [] => [], enchantmentCatalogItems: (): [] => []
};

const upgradeReaction = {
	type: CITY_REACTION_KINDS.UPGRADE_ITEM,
	data: {
		slot: 0, itemCategory: 0
	}
} as ReactionCollectorReaction;

function upgrade(overrides: Partial<CityMobileUpgradeItem> = {}): CityMobileUpgradeItem {
	return {
		slot: 0,
		itemId: 10,
		itemCategory: 0,
		itemLevel: 1,
		nextLevel: 2,
		upgradeCost: 0,
		missingMaterialsCost: 0,
		hasAllMaterials: false,
		canUpgrade: false,
		canBuyAndUpgrade: false,
		materials: [
			{
				materialId: 1, quantity: 3, playerQuantity: 1
			}
		],
		...overrides
	};
}

type Station = NonNullable<NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>["upgradeStation"]>;

function home(station: Partial<Station>): CityMobileSnapshot {
	return { home: { owned: {
		level: 2,
		bedHealthRegeneration: 1,
		gardenPlots: 0,
		hasBed: true,
		hasChest: true,
		hasGarden: false,
		hasCooking: false,
		hasUpgradeStation: true,
		upgradeableItemCount: 1,
		upgradeStation: {
			upgradeableItems: [upgrade()], beyondReachItems: [], maxItemLevel: 2, maxRarity: 3, ...station
		}
	} } };
}

function describeItem(item: CityListItem): string {
	return item.kind === "info" ? `${item.title} — ${item.lock?.reason ?? ""}` : item.kind;
}

describe("home upgrade station", () => {
	it("lays the items on the bench, those it refuses with their reason", () => {
		const sections = submenuSections("homeUpgrade", [
			{
				reaction: upgradeReaction, index: 4
			}
		], home({ beyondReachItems: [
			{
				slot: 0, itemId: 10, itemCategory: 1, itemLevel: 2, limit: CITY_STATION_LIMITS.HOME_LEVEL
			},
			{
				slot: 1, itemId: 10, itemCategory: 0, itemLevel: 1, limit: CITY_STATION_LIMITS.RARITY
			}
		] }), deps);

		expect(sections.map(section => section.title)).toEqual(["Sur l'établi"]);
		expect(sections[0].items.map(describeItem)).toEqual([
			"reaction",
			expect.stringMatching(/Votre établi s'arrête au niveau 2$/u),
			expect.stringMatching(/Trop précieux pour votre établi$/u)
		]);
	});

	it("sums the upgrade up by its materials, free of any fee", () => {
		const snapshot = home({});

		expect(cityRowSubtitle(upgradeReaction, snapshot)).toBe("Niveau 1 → 2 · 2 matériaux manquants");
		expect(cityRowEnd(upgradeReaction, snapshot)).toBeUndefined();
		expect(cityReactionLock(upgradeReaction, snapshot, Date.UTC(2026, 9, 15))?.reason).toBe("Il vous manque des matériaux pour cette amélioration.");
	});

	it("lays out the work order without a price nor an offer to buy", async () => {
		await render(<>{cityUpgradeDetails(upgradeReaction, home({}))}</>);

		expect(screen.getByText("1 → 2")).toBeTruthy();
		expect(screen.queryByText("Prix du forgeron")).toBeNull();
		expect(screen.getByText("Il vous manque 2 matériaux : rassemblez-les pour cette amélioration.")).toBeTruthy();
		expect(cityUpgradeConfirm(upgradeReaction, home({}))?.label).toBe("Améliorer au niveau 2");
	});

	it("explains that a bigger home or a city blacksmith goes further", async () => {
		await render(<StationLimitStory item={{
			slot: 0, itemId: 10, itemCategory: 1, itemLevel: 2, limit: CITY_STATION_LIMITS.HOME_LEVEL
		}} station={{
			maxItemLevel: 2, maxRarity: 3
		}} />);

		expect(screen.getByText("Au-delà de votre établi")).toBeTruthy();
		expect(screen.getByText(/ne travaille pas au-delà du niveau 2/u)).toBeTruthy();
	});
});
