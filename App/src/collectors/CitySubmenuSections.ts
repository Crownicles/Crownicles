import {CITY_REACTION_KINDS, CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {i18n} from "@/src/translations/i18n";
import type {CityEntry, CityListItem, CitySubmenu, CitySubmenuSection} from "@/src/collectors/CityCollector";

export type SubmenuDependencies = {
	homeFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	gardenPlotItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	homeChestItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	homeCookingItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	guildFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	enchantmentCatalogItems: () => CityListItem[];
};

const reactionItems = (entries: CityEntry[]): CityListItem[] => entries.map(entry => ({kind: "reaction" as const, entry}));
const section = (titleKey: string, items: CityListItem[]): CitySubmenuSection => ({title: i18n.t(titleKey), items});

function innSections(entries: CityEntry[]): CitySubmenuSection[] {
	return [
		section("app:city.titles.meals", reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_MEAL))),
		section("app:city.titles.rooms", reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_ROOM)) )
	];
}

function simpleSections(view: CitySubmenu, entries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] | undefined {
	const reactions = reactionItems(entries);
	const factories: Partial<Record<CitySubmenu, () => CitySubmenuSection[]>> = {
		inn: () => innSections(entries),
		home: () => [section("app:city.titles.homeServices", [...reactions, ...deps.homeFeatureItems(snapshot)])],
		homeBed: () => [section("app:city.titles.actions", reactions)],
		homeChest: () => [section("app:city.titles.storage", deps.homeChestItems(snapshot))],
		homeCooking: () => [section("app:city.titles.cooking", deps.homeCookingItems(snapshot))],
		guild: () => [section("app:city.titles.actions", [...deps.guildFeatureItems(snapshot), ...reactions])],
		enchanter: () => [section("app:city.titles.eligibleEquipment", reactions), section("app:city.enchantmentCatalog.title", deps.enchantmentCatalogItems())],
		homeGarden: () => [section("app:city.titles.garden", [...deps.gardenPlotItems(snapshot), ...reactions])],
		homeUpgrade: () => [section("app:city.titles.equipment", reactions)]
	};
	return factories[view]?.();
}

function groupedTitleKey(view: CitySubmenu, type: string): string {
	if (view === "notary") {
		return type === CITY_REACTION_KINDS.APARTMENT_BUY || type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT
			? "app:city.titles.apartments"
			: type === CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY ? "app:city.labels.guildDomain" : "app:city.titles.yourHome";
	}
	if (view === "blacksmith") return type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT ? "app:city.titles.disenchant" : "app:city.titles.equipment";
	if (view === "scrapDealer") return "app:city.titles.recycling";
	return "app:city.titles.actions";
}

function groupedSections(view: CitySubmenu, entries: CityEntry[]): CitySubmenuSection[] {
	const groups: Record<string, CityEntry[]> = {};
	for (const entry of entries) {
		const titleKey = groupedTitleKey(view, entry.reaction.type);
		(groups[titleKey] ??= []).push(entry);
	}
	return Object.entries(groups).map(([titleKey, groupedEntries]) => section(titleKey, reactionItems(groupedEntries)));
}

export function submenuSections(view: CitySubmenu, entries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] {
	return simpleSections(view, entries, snapshot, deps) ?? groupedSections(view, entries);
}
