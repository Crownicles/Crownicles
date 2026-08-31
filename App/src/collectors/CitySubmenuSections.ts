import {CityMobileSnapshot, CITY_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {i18n} from "@/src/translations/i18n";
import type {CityEntry, CityListItem, CitySubmenu, CitySubmenuSection} from "@/src/collectors/CityCollector";

type SubmenuDependencies = {
	homeFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	gardenPlotItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	homeChestItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	homeCookingItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	guildFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	enchantmentCatalogItems: () => CityListItem[];
};

const reactionItems = (entries: CityEntry[]): CityListItem[] => entries.map(entry => ({kind: "reaction" as const, entry}));

export function submenuSections(view: CitySubmenu, entries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] {
	if (view === "inn") {
		return [
			{title: i18n.t("app:city.titles.meals"), items: reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_MEAL))},
			{title: i18n.t("app:city.titles.rooms"), items: reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_ROOM))}
		];
	}
	if (view === "home") {
		return [{title: i18n.t("app:city.titles.homeServices"), items: [...reactionItems(entries), ...deps.homeFeatureItems(snapshot)]}];
	}
	if (view === "homeBed") return [{title: i18n.t("app:city.titles.actions"), items: reactionItems(entries)}];
	if (view === "homeChest") return [{title: i18n.t("app:city.titles.storage"), items: deps.homeChestItems(snapshot)}];
	if (view === "homeCooking") return [{title: i18n.t("app:city.titles.cooking"), items: deps.homeCookingItems(snapshot)}];
	if (view === "guild") return [{title: i18n.t("app:city.titles.actions"), items: [...deps.guildFeatureItems(snapshot), ...reactionItems(entries)]}];
	if (view === "enchanter") return [
		{title: i18n.t("app:city.titles.eligibleEquipment"), items: reactionItems(entries)},
		{title: i18n.t("app:city.enchantmentCatalog.title"), items: deps.enchantmentCatalogItems()}
	];
	if (view === "homeGarden") return [{title: i18n.t("app:city.titles.garden"), items: [...deps.gardenPlotItems(snapshot), ...reactionItems(entries)]}];
	if (view === "homeUpgrade") return [{title: i18n.t("app:city.titles.equipment"), items: reactionItems(entries)}];

	const groups: Record<string, CityEntry[]> = {};
	const add = (titleKey: string, entry: CityEntry): void => {
		(groups[titleKey] ??= []).push(entry);
	};
	for (const entry of entries) {
		const type = entry.reaction.type;
		const titleKey = view === "notary"
			? type === CITY_REACTION_KINDS.APARTMENT_BUY || type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT
				? "app:city.titles.apartments" : type === CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY ? "app:city.labels.guildDomain" : "app:city.titles.yourHome"
			: view === "blacksmith"
				? type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT ? "app:city.titles.disenchant" : "app:city.titles.equipment"
				: view === "scrapDealer" ? "app:city.titles.recycling" : "app:city.titles.actions";
		add(titleKey, entry);
	}
	return Object.entries(groups).map(([titleKey, groupedEntries]) => ({title: i18n.t(titleKey), items: reactionItems(groupedEntries)}));
}
