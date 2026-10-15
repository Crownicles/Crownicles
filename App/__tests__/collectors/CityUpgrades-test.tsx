import {
	render, screen
} from "@testing-library/react-native";
import {
	CITY_REACTION_KINDS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { submenuSections } from "@/src/collectors/CitySubmenuSections";
import { cityReactionLock } from "@/src/collectors/CityReactionLocks";
import { cityRowSubtitle } from "@/src/collectors/CityRowSubtitle";
import { cityRowEnd } from "@/src/collectors/CityRowEnd";
import {
	cityUpgradeConfirm, cityUpgradeDetails
} from "@/src/collectors/CityUpgradeDetails";
import type { CityListItem } from "@/src/collectors/CityCollector";

const deps = {
	homeFeatureItems: (): [] => [], gardenPlotItems: (): [] => [], enchantmentCatalogItems: (): [] => []
};

function upgradeReaction(buyMaterials: boolean): ReactionCollectorReaction {
	return {
		type: CITY_REACTION_KINDS.BLACKSMITH_UPGRADE,
		data: {
			slot: 0, itemCategory: 0, buyMaterials
		}
	} as ReactionCollectorReaction;
}

function upgrade(overrides: Partial<CityMobileUpgradeItem> = {}): CityMobileUpgradeItem {
	return {
		slot: 0,
		itemId: 10,
		itemCategory: 0,
		itemLevel: 2,
		nextLevel: 3,
		upgradeCost: 1_000,
		missingMaterialsCost: 400,
		hasAllMaterials: false,
		canUpgrade: false,
		canBuyAndUpgrade: false,
		materials: [
			{
				materialId: 1, quantity: 3, playerQuantity: 1
			},
			{
				materialId: 2, quantity: 1, playerQuantity: 4
			}
		],
		...overrides
	};
}

function forge(item: CityMobileUpgradeItem, playerMoney = 0): CityMobileSnapshot {
	return { blacksmith: {
		playerMoney, upgradeableItems: [item], disenchantableItems: [], beyondReachItems: []
	} };
}

function shownVariants(snapshot: CityMobileSnapshot): (boolean | undefined)[] {
	const entries = [false, true].map((buyMaterials, index) => ({
		reaction: upgradeReaction(buyMaterials), index
	}));
	return submenuSections("blacksmith", entries, snapshot, deps)[0].items
		.flatMap((item: CityListItem) => item.kind === "reaction" ? [(item.entry.reaction.data as { buyMaterials: boolean }).buyMaterials] : []);
}

describe("blacksmith upgrade", () => {
	it("lays an item once on the anvil, offering to buy the materials only when some are missing", () => {
		expect(shownVariants(forge(upgrade()))).toEqual([true]);
		expect(shownVariants(forge(upgrade({ hasAllMaterials: true })))).toEqual([false]);
	});

	it("tells a player short of coins how much the whole bill lacks, materials included", () => {
		const lock = cityReactionLock(upgradeReaction(true), forge(upgrade(), 1_100), Date.UTC(2026, 9, 15));

		expect(lock?.reason).toMatch(/^Il vous manque 300/u);
	});

	it("sums the row up: levels, how many materials are missing, and the blacksmith's own fee", () => {
		const snapshot = forge(upgrade());

		expect(cityRowSubtitle(upgradeReaction(true), snapshot)).toBe("Niveau 2 → 3 · 2 matériaux manquants");
		expect(cityRowEnd(upgradeReaction(true), snapshot)).toMatch(/^1\s000/u);
	});

	it("lays out the work order: levels, the blacksmith's fee, each material and the offer to sell the missing ones", async () => {
		const snapshot = forge(upgrade(), 5_000);
		await render(<>{cityUpgradeDetails(upgradeReaction(true), snapshot)}</>);

		expect(screen.getByText("2 → 3")).toBeTruthy();
		expect(screen.getByText("1 000")).toBeTruthy();
		expect(screen.getByText("1 / 3")).toBeTruthy();
		expect(screen.getByText("4 / 1")).toBeTruthy();
		expect(screen.getByText(/Il vous manque 2 matériaux : rassemblez-les, ou laissez le forgeron vous les vendre pour 400/u)).toBeTruthy();
		expect(cityUpgradeConfirm(upgradeReaction(true), snapshot)?.label).toBe("Acheter les matériaux et améliorer");
	});

	it("names the plain upgrade after the level it reaches, without any offer", async () => {
		const snapshot = forge(upgrade({
			hasAllMaterials: true, missingMaterialsCost: 0
		}), 5_000);
		await render(<>{cityUpgradeDetails(upgradeReaction(false), snapshot)}</>);

		expect(screen.queryByText(/Il vous manque/u)).toBeNull();
		expect(cityUpgradeConfirm(upgradeReaction(false), snapshot)?.label).toBe("Améliorer au niveau 3");
	});
});
