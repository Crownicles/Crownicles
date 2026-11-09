import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { groupCityEntries } from "@/src/collectors/CityMenuModel";
import { submenuSections } from "@/src/collectors/CitySubmenuSections";
import {
	cityRowEnd, cityRowSubtitle
} from "@/src/collectors/CityRowDetails";
import { cityRowTitle } from "@/src/collectors/CityRowTitle";
import type { CityEntry } from "@/src/collectors/CityCollector";

const WEAPON = 0;
const ARMOR = 1;

function entry(type: string, index: number, data: object = {}): CityEntry {
	return {
		reaction: {
			type, data
		} as ReactionCollectorReaction,
		index
	};
}

const enchanter: CityMobileSnapshot = { enchanter: {
	enchantmentId: "pveAttack1",
	enchantmentType: "defense",
	enchantmentSlot: ARMOR,
	enchantmentCost: {
		money: 100, gems: 2
	},
	mageReduction: false,
	playerMoney: 0,
	playerGems: 0,
	enchantableItems: [
		{
			slot: 0, itemId: 3, itemCategory: ARMOR, itemLevel: 1
		}
	],
	disenchantableItems: [
		{
			slot: 0, itemId: 12, itemCategory: WEAPON, itemLevel: 2, enchantmentId: "pvpAttack1", enchantmentType: "damage"
		}
	]
} };

const disenchant = entry(CITY_REACTION_KINDS.ENCHANTER_DISENCHANT, 1, {
	slot: 0, itemCategory: WEAPON
});

describe("Mernil's free disenchanting", () => {
	it("lists the enchanted equipment under the enchanter, apart from what he can enchant", () => {
		const model = groupCityEntries([
			entry(CITY_REACTION_KINDS.ENCHANT, 0, {
				slot: 0, itemCategory: ARMOR
			}),
			disenchant
		], { availableServices: ["enchanter"] });

		expect(model.submenus.enchanter.map(item => item.index)).toEqual([0, 1]);
		const sections = submenuSections("enchanter", model.submenus.enchanter, enchanter, {
			homeFeatureItems: () => [], gardenPlotItems: () => [], enchantmentCatalogItems: () => []
		});
		expect(sections.map(section => [section.title, section.items.length])).toEqual([
			["Vos équipements éligibles", 1],
			["Désenchanter gratuitement", 1],
			["Catalogue des enchantements", 0]
		]);
	});

	it("names the item and the enchantment it loses, and says it costs nothing", () => {
		const reaction = disenchant.reaction;

		expect(cityRowTitle(reaction, {
			type: "city", data: {
				mapTypeId: "ci", mapLocationId: 1, availableServices: [], snapshot: enchanter
			}
		}, enchanter)).toBe("Seringue infectée");
		expect(cityRowSubtitle(reaction, enchanter)).toMatch(/Attaque PvP I · retirer l.enchantement$/u);
		expect(cityRowEnd(reaction, enchanter)).toBe("Gratuit");
	});

	it("never shows the chest close Discord uses to rebuild the city", () => {
		const model = groupCityEntries([entry(CITY_REACTION_KINDS.HOME_CHEST_CLOSE, 0), entry(CITY_REACTION_KINDS.EXIT, 1)]);

		expect(Object.values(model.groups).flat()
			.map(item => item.kind === "reaction" ? item.entry.reaction.type : item.kind)).toEqual([CITY_REACTION_KINDS.EXIT]);
		expect(Object.values(model.submenus).flat()).toEqual([]);
	});
});

describe("leaving the city", () => {
	it("says on the way out how many points the stay already guarantees", () => {
		const exit = entry(CITY_REACTION_KINDS.EXIT, 0).reaction;

		expect(cityRowSubtitle(exit, { minimumCityStayScore: 42 })).toBe("Au moins 42 points garantis à votre départ");
		expect(cityRowSubtitle(exit, {})).toBe("Sortez de la ville pour continuer votre aventure.");
	});
});
