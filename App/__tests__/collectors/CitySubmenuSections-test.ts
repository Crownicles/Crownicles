import {
	CITY_BLACKSMITH_LIMITS, CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { submenuSections } from "@/src/collectors/CitySubmenuSections";
import type {
	CityEntry, CityListItem
} from "@/src/collectors/CityCollector";

const deps = {
	homeFeatureItems: (): [] => [], gardenPlotItems: (): [] => [], enchantmentCatalogItems: (): [] => []
};

function entry(type: string, index: number): CityEntry {
	return {
		reaction: {
			type,
			data: {
				slot: 0, itemCategory: 0
			}
		} as ReactionCollectorReaction,
		index
	};
}

function blacksmith(overrides: Partial<NonNullable<CityMobileSnapshot["blacksmith"]>>): CityMobileSnapshot {
	return { blacksmith: {
		playerMoney: 0, upgradeableItems: [], disenchantableItems: [], ...overrides
	} };
}

function describeItem(item: CityListItem): string {
	return item.kind === "info" ? `${item.title} — ${item.lock?.reason ?? ""}` : item.kind;
}

describe("blacksmith anvil", () => {
	it("lays every held weapon and armor on the anvil, the ones beyond the blacksmith with their reason", () => {
		const snapshot = blacksmith({ beyondReachItems: [
			{
				slot: 0, itemId: 1, itemCategory: 1, itemLevel: 4, limit: CITY_BLACKSMITH_LIMITS.ROYAL_ONLY
			},
			{
				slot: 1, itemId: 1, itemCategory: 0, itemLevel: 5, limit: CITY_BLACKSMITH_LIMITS.MAXED
			}
		] });
		const sections = submenuSections("blacksmith", [entry(CITY_REACTION_KINDS.BLACKSMITH_UPGRADE, 1), entry(CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT, 2)], snapshot, deps);

		expect(sections.map(section => section.title)).toEqual(["Sur l'enclume", "Désenchanter"]);
		expect(sections[0].items.map(describeItem)).toEqual([
			"reaction",
			expect.stringMatching(/Niveau 4 : le forgeron ne peut aller plus loin, seul le forgeron royal le peut\.$/u),
			expect.stringMatching(/Niveau maximal$/u)
		]);
		expect(sections[1].items.map(describeItem)).toEqual(["reaction"]);
	});

	it("explains a cold anvil to a player holding no weapon nor armor", () => {
		const sections = submenuSections("blacksmith", [], blacksmith({ beyondReachItems: [] }), deps);

		expect(sections[0].items.map(describeItem)).toEqual(["L'enclume reste froide — Vous n'avez ni arme ni armure à confier au forgeron."]);
	});

	it("stays silent on an older server that does not say what lies beyond the blacksmith", () => {
		const sections = submenuSections("blacksmith", [], blacksmith({}), deps);

		expect(sections.every(section => section.items.length === 0)).toBe(true);
	});
});
