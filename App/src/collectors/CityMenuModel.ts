import {
	CITY_REACTION_KINDS,
	GENERIC_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import type {
	CityEntry,
	CityGroup,
	CityGroupingOptions,
	CityGroupingState,
	CityListItem,
	CityMenuModel,
	CityNavigationItem,
	CitySubmenu
} from "@/src/collectors/CityCollector";
import {compactCityDescription} from "@/src/collectors/CityRowDetails";
import {homeIconPath} from "@/src/collectors/CityHomeItems";
import {i18n} from "@/src/translations/i18n";

export type {CityGroupingOptions, CityNavigationItem};

const CITY_REACTION_ORDER: Partial<Record<ReactionCollectorReaction["type"], number>> = {
	[CITY_REACTION_KINDS.HOME_MENU]: 0,
	[CITY_REACTION_KINDS.BUY_HOME]: 1,
	[CITY_REACTION_KINDS.UPGRADE_HOME]: 2,
	[CITY_REACTION_KINDS.MOVE_HOME]: 3,
	[CITY_REACTION_KINDS.APARTMENT_BUY]: 4,
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: 5,
	[CITY_REACTION_KINDS.HOME_BED]: 6,
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: 7,
	[CITY_REACTION_KINDS.INN_MEAL]: 0,
	[CITY_REACTION_KINDS.INN_ROOM]: 1,
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: 0,
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: 1,
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: 0,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: 0,
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: 0,
	[CITY_REACTION_KINDS.GARDEN_WATER]: 1,
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: 2,
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: 0,
	[CITY_REACTION_KINDS.SHOP]: 0,
	[CITY_REACTION_KINDS.EXIT]: 0
};

const CITY_SUBMENU_ORDER: Record<CitySubmenu, number> = {
	home: 0,
	homeBed: 1,
	homeChest: 2,
	homeGarden: 3,
	homeCooking: 4,
	homeUpgrade: 5,
	notary: 6,
	inn: 0,
	enchanter: 7,
	blacksmith: 8,
	scrapDealer: 9,
	royalBlacksmith: 10,
	guild: 0
};

type CityNavigationDefinition = {iconPath: string; titleKey: string; subtitleKey: string};

const CITY_NAVIGATION_META: Record<Exclude<CitySubmenu, "inn">, CityNavigationDefinition> = {
	home: {iconPath: "city.home.5", titleKey: "app:city.labels.home", subtitleKey: "app:city.subtitles.homeScreen"},
	homeBed: {iconPath: "city.homeUpgrades.bed", titleKey: "app:city.labels.bed", subtitleKey: "app:city.subtitles.bed"},
	homeChest: {iconPath: "city.homeUpgrades.chest", titleKey: "app:city.labels.chest", subtitleKey: "app:city.subtitles.chest"},
	homeGarden: {iconPath: "city.homeUpgrades.garden", titleKey: "app:city.labels.garden", subtitleKey: "app:city.subtitles.garden"},
	homeCooking: {iconPath: "city.homeUpgrades.cooking", titleKey: "app:city.labels.cooking", subtitleKey: "app:city.subtitles.cookingScreen"},
	homeUpgrade: {iconPath: "city.homeUpgrades.upgradeEquipment", titleKey: "app:city.labels.upgradeStation", subtitleKey: "app:city.subtitles.upgradeStation"},
	notary: {iconPath: "city.manageHome", titleKey: "app:city.actions.notary", subtitleKey: "app:city.subtitles.notary"},
	enchanter: {iconPath: "city.services.enchanter", titleKey: "app:city.labels.enchanter", subtitleKey: "commands:report.city.reactions.enchanter.description"},
	blacksmith: {iconPath: "city.services.blacksmith", titleKey: "app:city.labels.blacksmith", subtitleKey: "commands:report.city.blacksmith.menuDescription"},
	scrapDealer: {iconPath: "city.services.scrapDealer", titleKey: "app:city.labels.scrapDealer", subtitleKey: "commands:report.city.scrapDealer.menuDescription"},
	royalBlacksmith: {iconPath: "city.services.royalBlacksmith", titleKey: "app:city.labels.royalBlacksmith", subtitleKey: "commands:report.city.royalBlacksmith.menuDescription"},
	guild: {iconPath: "city.guildDomain.menu", titleKey: "app:city.labels.guildDomain", subtitleKey: "commands:report.city.guildDomain.description"}
};

type CityNavigationConfig = {group: Exclude<CityGroup, "elsewhere">; view: Exclude<CitySubmenu, "inn">; key: string};

const CITY_NAVIGATION_REACTIONS: Partial<Record<ReactionCollectorReaction["type"], CityNavigationConfig>> = {
	[CITY_REACTION_KINDS.HOME_MENU]: {group: "housing", view: "home", key: "home"},
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: {group: "services", view: "blacksmith", key: "blacksmith"},
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: {group: "services", view: "scrapDealer", key: "scrap-dealer"},
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: {group: "services", view: "royalBlacksmith", key: "royal-blacksmith"},
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: {group: "guild", view: "guild", key: "guild-domain"}
};

const CITY_SUBMENU_REACTIONS: Partial<Record<ReactionCollectorReaction["type"], CitySubmenu>> = {
	[CITY_REACTION_KINDS.BUY_HOME]: "notary",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "notary",
	[CITY_REACTION_KINDS.MOVE_HOME]: "notary",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "notary",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "notary",
	[CITY_REACTION_KINDS.HOME_BED]: "homeBed",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "homeUpgrade",
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: "homeGarden",
	[CITY_REACTION_KINDS.GARDEN_WATER]: "homeGarden",
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: "homeGarden",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "blacksmith",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "scrapDealer",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "royalBlacksmith",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "notary"
};

export function cityNavigationMeta(view: Exclude<CitySubmenu, "inn">): Omit<CityNavigationItem, "kind" | "key" | "view"> {
	const definition = CITY_NAVIGATION_META[view];
	return {iconPath: definition.iconPath, title: i18n.t(definition.titleKey), subtitle: i18n.t(definition.subtitleKey)};
}

function navigationItem(view: Exclude<CitySubmenu, "inn">, key: string): CityNavigationItem {
	return {kind: "navigation", key, view, ...cityNavigationMeta(view)};
}

function homeNavigationItem(homeOwned: NonNullable<CityMobileSnapshot["home"]>["owned"]): CityNavigationItem {
	const apartment = homeOwned?.isApartment === true;
	return {kind: "navigation", key: "home", view: "home", iconPath: homeIconPath(homeOwned?.level), title: i18n.t(apartment ? "app:city.labels.apartment" : "app:city.labels.home"), subtitle: i18n.t(apartment ? "commands:report.city.homes.goToOwnedApartmentDescription" : "commands:report.city.homes.goToOwnedHomeDescription")};
}

function innNavigationItem(innId: string): CityNavigationItem {
	return {kind: "navigation", key: `inn-${innId}`, view: "inn", innId, iconPath: "city.inn", title: i18n.t("app:city.labels.inn", {name: i18n.t(`commands:report.city.inns.names.${innId}`)}), subtitle: i18n.t("commands:report.city.reactions.inn.description")};
}

function sortCityItems(left: CityListItem, right: CityListItem): number {
	const order = (item: CityListItem) => item.kind === "navigation" ? CITY_SUBMENU_ORDER[item.view] : item.kind === "info" ? Number.MAX_SAFE_INTEGER : CITY_REACTION_ORDER[item.entry.reaction.type] ?? Number.MAX_SAFE_INTEGER;
	return order(left) - order(right);
}

function emptyCityGroups(): Record<CityGroup, CityListItem[]> {
	return {housing: [], services: [], shops: [], guild: [], elsewhere: [], quit: []};
}

function emptyCitySubmenus(): Record<CitySubmenu, CityEntry[]> {
	return {home: [], homeBed: [], homeChest: [], homeGarden: [], homeCooking: [], homeUpgrade: [], notary: [], inn: [], enchanter: [], blacksmith: [], scrapDealer: [], royalBlacksmith: [], guild: []};
}

function addNavigationEntry(state: CityGroupingState, entry: CityEntry, options: CityGroupingOptions): boolean {
	const navigation = CITY_NAVIGATION_REACTIONS[entry.reaction.type];
	if (!navigation) return false;
	state.groups[navigation.group].push(navigation.view === "home" ? homeNavigationItem(options.homeOwned) : navigationItem(navigation.view, navigation.key));
	return true;
}

function addTerminalEntry(state: CityGroupingState, entry: CityEntry): boolean {
	if (entry.reaction.type === CITY_REACTION_KINDS.EXIT) {
		state.groups.quit.push({kind: "reaction", entry});
		return true;
	}
	if (entry.reaction.type === CITY_REACTION_KINDS.SHOP) {
		state.groups.shops.push({kind: "reaction", entry});
		return true;
	}
	return false;
}

function addInnEntry(state: CityGroupingState, entry: CityEntry): boolean {
	if (entry.reaction.type !== CITY_REACTION_KINDS.INN_MEAL && entry.reaction.type !== CITY_REACTION_KINDS.INN_ROOM) return false;
	const innId = (entry.reaction.data as {innId: string}).innId;
	state.inns.set(innId, [...(state.inns.get(innId) ?? []), entry]);
	return true;
}

function addSubmenuEntry(state: CityGroupingState, entry: CityEntry): boolean {
	if (entry.reaction.type === CITY_REACTION_KINDS.ENCHANT) {
		state.submenus.enchanter.push(entry);
		return true;
	}
	const submenu = CITY_SUBMENU_REACTIONS[entry.reaction.type];
	if (!submenu) return false;
	state.submenus[submenu].push(entry);
	state.hasNotary ||= submenu === "notary";
	state.hasGuildActions ||= submenu === "guild";
	return true;
}

type CityEntryHandler = (state: CityGroupingState, entry: CityEntry, options: CityGroupingOptions) => boolean;

const CITY_ENTRY_HANDLERS: CityEntryHandler[] = [
	addNavigationEntry,
	(state, entry) => addTerminalEntry(state, entry),
	(state, entry) => addInnEntry(state, entry),
	(state, entry) => addSubmenuEntry(state, entry)
];

function addCityEntry(state: CityGroupingState, entry: CityEntry, options: CityGroupingOptions): void {
	if (entry.reaction.type === GENERIC_REACTION_KINDS.REFUSE) return;
	for (const handler of CITY_ENTRY_HANDLERS) {
		if (handler(state, entry, options)) return;
	}
	state.groups.services.push({kind: "reaction", entry});
}

function addInnServices(state: CityGroupingState, innIds: string[] | undefined): void {
	for (const [innId, innEntries] of state.inns) {
		state.submenus.inn.push(...innEntries);
		state.groups.services.push(innNavigationItem(innId));
	}
	for (const innId of innIds ?? []) {
		if (!state.groups.services.some(item => item.kind === "navigation" && item.view === "inn" && item.innId === innId)) state.groups.services.push(innNavigationItem(innId));
	}
}

function addNotaryService(state: CityGroupingState): void {
	if (state.hasNotary) state.groups.housing.push(navigationItem("notary", "notary"));
}

function addGuildService(state: CityGroupingState): void {
	if (state.hasGuildActions && !state.groups.guild.some(item => item.kind === "navigation" && item.view === "guild")) state.groups.guild.push(navigationItem("guild", "guild-domain"));
}

function addEnchanterService(state: CityGroupingState, availableServices: string[] | undefined): void {
	if (state.submenus.enchanter.length > 0 || availableServices?.includes("enchanter")) state.groups.services.push(navigationItem("enchanter", "enchanter"));
}

function addBossArchivistService(state: CityGroupingState, availableServices: string[] | undefined): void {
	if (availableServices?.includes("bossArchivist")) state.groups.services.push({kind: "info", key: "boss-archivist", iconPath: "city.services.bossArchivist", title: i18n.t("commands:report.city.bossArchivist.serviceTitle"), subtitle: compactCityDescription(i18n.t("commands:report.city.bossArchivist.serviceDescription"))});
}

function addAvailableServices(state: CityGroupingState, options: CityGroupingOptions): void {
	addNotaryService(state);
	addGuildService(state);
	addEnchanterService(state, options.availableServices);
	addBossArchivistService(state, options.availableServices);
}

function addEmptyShops(state: CityGroupingState, shops: CityGroupingOptions["shops"]): void {
	for (const shop of shops ?? []) {
		if (!shop.isEmpty) continue;
		state.groups.shops.push({kind: "info", key: `empty-shop-${shop.shopId}`, iconPath: `city.shops.${shop.shopId}`, title: i18n.t(`commands:report.city.shops.${shop.shopId}.label`), subtitle: compactCityDescription(i18n.t("commands:report.city.shopEmptyDescription"))});
	}
}

function addGuildFoodShop(state: CityGroupingState, foodShop: CityGroupingOptions["guildFoodShop"]): void {
	if (!foodShop) return;
	state.groups.guild.push({kind: "info", key: "guild-food-shop", iconPath: "expedition.food", title: i18n.t("commands:report.city.guildFoodShop.label"), subtitle: i18n.t("commands:report.city.guildFoodShop.description", {guildName: foodShop.guildName})});
}

function addOtherCityServices(state: CityGroupingState, services: CityGroupingOptions["otherCityServices"]): void {
	for (const service of services ?? []) {
		const locationName = (service.mapLocationIds ?? [service.mapLocationId]).map(mapLocationId => i18n.t(`models:map_locations.${mapLocationId}.name`)).join(" · ");
		const titleKey = service.kind === "shop" ? `commands:report.city.shops.${service.serviceKey}.label` : service.serviceKey === "bossArchivist" ? "commands:report.city.bossArchivist.serviceTitle" : `commands:report.city.${service.serviceKey}.menuLabel`;
		const descriptionKey = service.kind === "shop" ? `commands:report.city.shops.${service.serviceKey}.description` : service.serviceKey === "bossArchivist" ? "commands:report.city.bossArchivist.serviceDescription" : `commands:report.city.${service.serviceKey}.menuDescription`;
		state.groups.elsewhere.push({kind: "info", key: `${service.kind}-${service.mapLocationId}-${service.serviceKey}`, iconPath: service.kind === "shop" ? `city.shops.${service.serviceKey}` : `city.services.${service.serviceKey}`, title: i18n.t(titleKey), subtitle: `${locationName} · ${compactCityDescription(i18n.t(descriptionKey))}`});
	}
}

function decorateHomeNavigation(state: CityGroupingState, home: CityGroupingOptions["homeOwned"]): void {
	if (!home) return;
	state.groups.housing = state.groups.housing.map(item => item.kind === "navigation" && item.view === "home" ? {...item, iconPath: homeIconPath(home.level), subtitle: i18n.t("app:city.subtitles.homeDetails", {level: home.level, services: [home.hasBed ? i18n.t("app:city.summary.bed") : null, home.hasChest ? i18n.t("app:city.summary.chest") : null, home.hasGarden ? i18n.t("app:city.summary.garden") : null, home.hasCooking ? i18n.t("app:city.summary.cooking") : null, home.hasUpgradeStation ? i18n.t("app:city.summary.forge") : null].filter(Boolean).join(", ")})} : item);
}

function sortCityModel(state: CityGroupingState): CityMenuModel {
	for (const group of Object.values(state.groups)) group.sort(sortCityItems);
	for (const submenu of Object.values(state.submenus)) submenu.sort((left, right) => (CITY_REACTION_ORDER[left.reaction.type] ?? Number.MAX_SAFE_INTEGER) - (CITY_REACTION_ORDER[right.reaction.type] ?? Number.MAX_SAFE_INTEGER));
	return {groups: state.groups, submenus: state.submenus};
}

export function groupCityEntries(entries: CityEntry[], options: CityGroupingOptions = {}): CityMenuModel {
	const state: CityGroupingState = {groups: emptyCityGroups(), submenus: emptyCitySubmenus(), inns: new Map(), hasNotary: Boolean(options.homeManage), hasGuildActions: false};
	entries.forEach(entry => addCityEntry(state, entry, options));
	addAvailableServices(state, options);
	addInnServices(state, options.innIds);
	addEmptyShops(state, options.shops);
	addGuildFoodShop(state, options.guildFoodShop);
	addOtherCityServices(state, options.otherCityServices);
	decorateHomeNavigation(state, options.homeOwned);
	return sortCityModel(state);
}

export function submenuTitle(view: CitySubmenu, innId?: string): {eyebrow: string; title: string; subtitle?: string} {
	if (view === "inn" && innId) {
		const name = i18n.t(`commands:report.city.inns.names.${innId}`);
		return {eyebrow: i18n.t("app:city.titles.eyebrow"), title: i18n.t("app:city.labels.inn", {name}), subtitle: compactCityDescription(i18n.t("commands:report.city.reactions.inn.description"))};
	}
	const meta = cityNavigationMeta(view as Exclude<CitySubmenu, "inn">);
	return {eyebrow: i18n.t("app:city.titles.eyebrow"), title: meta.title, subtitle: meta.subtitle};
}
