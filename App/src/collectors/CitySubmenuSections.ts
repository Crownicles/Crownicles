import {CITY_REACTION_KINDS, CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import {i18n} from "@/src/translations/i18n";
import type {CityEntry, CityListItem, CitySubmenu, CitySubmenuSection} from "@/src/collectors/CityCollector";

export type SubmenuDependencies = {
	homeFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	gardenPlotItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
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
		guild: () => [section("app:city.titles.actions", reactions)],
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

function groupedSections(view: CitySubmenu, entries: CityEntry[], pinned: Record<string, CityListItem[]> = {}): CitySubmenuSection[] {
	const groups: Record<string, CityListItem[]> = Object.fromEntries(Object.entries(pinned).map(([titleKey, items]) => [titleKey, [...items]]));
	for (const entry of entries) {
		const titleKey = groupedTitleKey(view, entry.reaction.type);
		(groups[titleKey] ??= []).push({kind: "reaction", entry});
	}
	return Object.entries(groups).map(([titleKey, items]) => section(titleKey, items));
}

/** The upgrade Core does not offer yet, or no longer: said on a greyed row rather than silently left out. */
function homeUpgradeLimit(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const manage = snapshot?.home?.manage;
	const level = snapshot?.home?.owned?.level;
	const reason = manage?.requiredPlayerLevelForUpgrade === undefined
		? manage?.isMaxLevel ? i18n.t("app:city.locks.homeMaxLevel") : undefined
		: i18n.t("app:city.locks.playerLevel", {level: manage.requiredPlayerLevelForUpgrade});
	if (!reason) return [];
	const nextLevel = level === undefined || manage?.isMaxLevel ? level : level + 1;
	return [{
		kind: "info",
		key: "home-upgrade-limit",
		iconPath: nextLevel === undefined ? "city.manageHome" : `city.home.${nextLevel}`,
		title: i18n.t("app:city.reactions.upgradeHome"),
		subtitle: i18n.t("app:city.subtitles.upgradeHome"),
		lock: {reason}
	}];
}

export function submenuSections(view: CitySubmenu, entries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] {
	if (view === "notary") return groupedSections(view, entries, {"app:city.titles.yourHome": homeUpgradeLimit(snapshot)}).filter(notarySection => notarySection.items.length > 0);
	return simpleSections(view, entries, snapshot, deps) ?? groupedSections(view, entries);
}
