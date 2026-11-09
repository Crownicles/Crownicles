import { createElement } from "react";
import {
	CITY_BLACKSMITH_LIMITS, CITY_REACTION_KINDS, CityMobileBeyondReachItem, CityMobileSnapshot
} from "ws-packets/src/fromServer/collectors";
import { i18n } from "@/src/translations/i18n";
import {
	cityItemIconPath, cityItemName
} from "@/src/collectors/CityItemPresentation";
import { isShownUpgradeVariant } from "@/src/collectors/CityUpgrades";
import { stationRefusals } from "@/src/collectors/CityStationItems";
import {
	BeyondReachStory, EnchantedStory
} from "@/src/collectors/CityItemStories";
import {
	Castle, Sparkles, Trophy
} from "@/src/design/FightIcons";
import type {
	CityEntry, CityListItem, CitySubmenu, CitySubmenuSection
} from "@/src/collectors/CityCollector";

export type SubmenuDependencies = {
	homeFeatureItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	gardenPlotItems: (snapshot: CityMobileSnapshot | undefined) => CityListItem[];
	enchantmentCatalogItems: () => CityListItem[];
};

const reactionItems = (entries: CityEntry[]): CityListItem[] => entries.map(entry => ({
	kind: "reaction" as const, entry
}));
const section = (titleKey: string, items: CityListItem[]): CitySubmenuSection => ({
	title: i18n.t(titleKey), items
});

function innSections(entries: CityEntry[]): CitySubmenuSection[] {
	return [
		section("app:city.titles.meals", reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_MEAL))),
		section("app:city.titles.rooms", reactionItems(entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_ROOM)))
	];
}

function beyondReachItem(item: CityMobileBeyondReachItem): CityListItem {
	return {
		kind: "info",
		key: `blacksmith-beyond-reach-${item.itemCategory}-${item.slot}`,
		iconPath: cityItemIconPath(item),
		title: cityItemName(item),
		subtitle: i18n.t("app:city.anvil.itemLevel", { level: item.itemLevel }),
		lock: {
			reason: i18n.t(`app:city.anvil.${item.limit}`, { level: item.itemLevel }),
			icon: item.limit === CITY_BLACKSMITH_LIMITS.ROYAL_ONLY ? Castle : Trophy
		},
		details: createElement(BeyondReachStory, { item })
	};
}

/** A player holding no weapon nor armor learns why the anvil stays cold; older servers do not say. */
function emptyAnvil(blacksmith: NonNullable<CityMobileSnapshot["blacksmith"]>): CityListItem[] {
	const holdsEquipment = blacksmith.upgradeableItems.length + blacksmith.enchantmentTransfers.length + (blacksmith.beyondReachItems?.length ?? 0) > 0;
	return blacksmith.beyondReachItems === undefined || holdsEquipment
		? []
		: [
			{
				kind: "info",
				key: "blacksmith-empty-anvil",
				iconPath: "city.services.blacksmith",
				title: i18n.t("app:city.anvil.empty"),
				subtitle: i18n.t("app:city.anvil.nothingHeld"),
				lock: { reason: i18n.t("app:city.anvil.nothingHeld") }
			}
		];
}

/** Every weapon and armor the player holds lies on the anvil: what the blacksmith can upgrade, then what is beyond them and why. */
function blacksmithSections(entries: CityEntry[], snapshot: CityMobileSnapshot | undefined): CitySubmenuSection[] {
	const transfers = (entry: CityEntry): boolean => entry.reaction.type === CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER;
	const blacksmith = snapshot?.blacksmith;
	return [
		section("app:city.titles.anvil", [
			...reactionItems(entries.filter(entry => !transfers(entry))),
			...(blacksmith?.beyondReachItems ?? []).map(beyondReachItem),
			...blacksmith ? emptyAnvil(blacksmith) : []
		]),
		section("app:city.titles.enchantmentTransfer", reactionItems(entries.filter(transfers)))
	];
}

/** Mernil enchants what is still bare, and strips for free what already carries an enchantment, before his catalogue. */
function enchanterSections(entries: CityEntry[], deps: SubmenuDependencies): CitySubmenuSection[] {
	const disenchants = (entry: CityEntry): boolean => entry.reaction.type === CITY_REACTION_KINDS.ENCHANTER_DISENCHANT;
	return [
		section("app:city.titles.eligibleEquipment", reactionItems(entries.filter(entry => !disenchants(entry)))),
		section("app:city.titles.freeDisenchant", reactionItems(entries.filter(disenchants))),
		section("app:city.enchantmentCatalog.title", deps.enchantmentCatalogItems())
	];
}

/** What the scrap dealer will not take: an enchanted item, with why and what to do, or a bench left empty. */
function scrapDealerRefusals(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const scrapDealer = snapshot?.scrapDealer;
	if (!scrapDealer) {
		return [];
	}
	const enchanted: CityListItem[] = (scrapDealer.enchantedItems ?? []).map(item => ({
		kind: "info",
		key: `scrap-dealer-enchanted-${item.itemCategory}-${item.slot}`,
		iconPath: cityItemIconPath(item),
		title: cityItemName(item),
		subtitle: i18n.t("app:city.anvil.itemLevel", { level: item.itemLevel }),
		lock: {
			reason: i18n.t("app:city.scrap.enchanted"), icon: Sparkles
		},
		details: createElement(EnchantedStory, { item })
	}));
	if (enchanted.length > 0 || scrapDealer.recyclableItems.length > 0) {
		return enchanted;
	}
	return [
		{
			kind: "info",
			key: "scrap-dealer-empty",
			iconPath: "city.services.scrapDealer",
			title: i18n.t("app:city.scrap.empty"),
			subtitle: i18n.t("app:city.scrap.nothingRecyclable"),
			lock: { reason: i18n.t("app:city.scrap.nothingRecyclable") }
		}
	];
}

function simpleSections(view: CitySubmenu, entries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] | undefined {
	const reactions = reactionItems(entries);
	const factories: Partial<Record<CitySubmenu, () => CitySubmenuSection[]>> = {
		inn: () => innSections(entries),
		blacksmith: () => blacksmithSections(entries, snapshot),
		scrapDealer: () => [section("app:city.titles.recycling", [...reactions, ...scrapDealerRefusals(snapshot)])],
		home: () => [section("app:city.titles.homeServices", [...reactions, ...deps.homeFeatureItems(snapshot)])],
		homeBed: () => [section("app:city.titles.actions", reactions)],
		guild: () => [section("app:city.titles.actions", reactions)],
		enchanter: () => enchanterSections(entries, deps),
		homeGarden: () => [section("app:city.titles.garden", [...deps.gardenPlotItems(snapshot), ...reactions])],
		homeUpgrade: () => [section("app:city.titles.station", [...reactions, ...stationRefusals(snapshot)])]
	};
	return factories[view]?.();
}

const NOTARY_TITLE_KEYS: Partial<Record<string, string>> = {
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "app:city.titles.apartments",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "app:city.titles.apartments",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "app:city.labels.guildDomain"
};

const GROUPED_TITLE_KEYS: Partial<Record<CitySubmenu, (type: string) => string>> = {
	notary: type => NOTARY_TITLE_KEYS[type] ?? "app:city.titles.yourHome"
};

function groupedTitleKey(view: CitySubmenu, type: string): string {
	return GROUPED_TITLE_KEYS[view]?.(type) ?? "app:city.titles.actions";
}

function groupedSections(view: CitySubmenu, entries: CityEntry[], pinned: Record<string, CityListItem[]> = {}): CitySubmenuSection[] {
	const groups: Record<string, CityListItem[]> = Object.fromEntries(Object.entries(pinned).map(([titleKey, items]) => [titleKey, [...items]]));
	for (const entry of entries) {
		const titleKey = groupedTitleKey(view, entry.reaction.type);
		(groups[titleKey] ??= []).push({
			kind: "reaction", entry
		});
	}
	return Object.entries(groups).map(([titleKey, items]) => section(titleKey, items));
}

type HomeManage = NonNullable<NonNullable<CityMobileSnapshot["home"]>["manage"]>;

function homeUpgradeLimitReason(manage: HomeManage | undefined): string | undefined {
	if (manage?.requiredPlayerLevelForUpgrade !== undefined) {
		return i18n.t("app:city.locks.playerLevel", { level: manage.requiredPlayerLevelForUpgrade });
	}
	return manage?.isMaxLevel ? i18n.t("app:city.locks.homeMaxLevel") : undefined;
}

/** The home the upgrade would give, or the current one once it is at its highest level. */
function homeUpgradeIcon(level: number | undefined, isMaxLevel: boolean | undefined): string {
	if (level === undefined) {
		return "city.manageHome";
	}
	return `city.home.${isMaxLevel ? level : level + 1}`;
}

/** The upgrade Core does not offer yet, or no longer: said on a greyed row rather than silently left out. */
function homeUpgradeLimit(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const manage = snapshot?.home?.manage;
	const reason = homeUpgradeLimitReason(manage);
	if (!reason) {
		return [];
	}
	return [
		{
			kind: "info",
			key: "home-upgrade-limit",
			iconPath: homeUpgradeIcon(snapshot?.home?.owned?.level, manage?.isMaxLevel),
			title: i18n.t("app:city.reactions.upgradeHome"),
			subtitle: i18n.t("app:city.subtitles.upgradeHome"),
			lock: { reason }
		}
	];
}

/** An apartment a beginner cannot buy yet: shown with its reason, so the notary teaches it exists. */
function apartmentRequiringHome(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	if (snapshot?.apartmentNotary?.requiresHomePrice === undefined) {
		return [];
	}
	return [
		{
			kind: "info",
			key: "apartment-requires-home",
			iconPath: "city.apartmentNotary.buy",
			title: i18n.t("commands:report.city.homes.apartmentNotary.buyButtonLabel"),
			subtitle: i18n.t("app:city.subtitles.buyApartmentFoothold"),
			lock: { reason: i18n.t("app:city.locks.apartmentRequiresHome") }
		}
	];
}

export function submenuSections(view: CitySubmenu, allEntries: CityEntry[], snapshot: CityMobileSnapshot | undefined, deps: SubmenuDependencies): CitySubmenuSection[] {
	const entries = allEntries.filter(entry => isShownUpgradeVariant(entry.reaction, snapshot));
	if (view === "notary") {
		return groupedSections(view, entries, {
			"app:city.titles.yourHome": homeUpgradeLimit(snapshot),
			"app:city.titles.apartments": apartmentRequiringHome(snapshot)
		}).filter(notarySection => notarySection.items.length > 0);
	}
	return simpleSections(view, entries, snapshot, deps) ?? groupedSections(view, entries);
}
