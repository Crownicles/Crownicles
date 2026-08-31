import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS, GENERIC_REACTION_KINDS,
	CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CitySnapshotSummary} from "@/src/collectors/CitySnapshotSummary";
import {citySnapshotNote} from "@/src/collectors/CitySnapshotNote";
import {gardenPlotItems, homeChestItems, homeCookingItems, homeFeatureItems, homeIconPath} from "@/src/collectors/CityHomeItems";
import {enchantmentCatalogItems, guildFeatureItems} from "@/src/collectors/CityGuildItems";
import {
	cityRowEnd as renderCityRowEnd,
	cityRowSubtitle as renderCityRowSubtitle,
	compactCityDescription
} from "@/src/collectors/CityRowDetails";
import {cityReactionAvailable, cityRowIcon, cityRowTitle, iconForPath} from "@/src/collectors/CityRowPresentation";
import {CitySection} from "@/src/collectors/CityRows";
import {submenuSections as buildSubmenuSections} from "@/src/collectors/CitySubmenuSections";
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

export type CityEntry = {reaction: ReactionCollectorReaction; index: number};

export type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

type CityNavigationItem = {
	kind: "navigation";
	key: string;
	view: CitySubmenu;
	innId?: string;
	iconPath: string;
	title: string;
	subtitle?: string;
};

type CityInfoItem = {
	kind: "info";
	key: string;
	iconPath: string;
	title: string;
	subtitle: string;
};

type CityReactionItem = {kind: "reaction"; entry: CityEntry};
export type CityListItem = CityNavigationItem | CityInfoItem | CityReactionItem;

type CityMenuModel = {
	groups: Record<CityGroup, CityListItem[]>;
	submenus: Record<CitySubmenu, CityEntry[]>;
};

// Kept local for the navigation catalogue; row-specific details live in CityRowDetails.
type CityGroup = "housing" | "services" | "shops" | "guild" | "elsewhere" | "quit";

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

export type CitySubmenuSection = {title: string; items: CityListItem[]};

type CityNavigationDefinition = {
	iconPath: string;
	titleKey: string;
	subtitleKey: string;
};

const CITY_NAVIGATION_META: Record<Exclude<CitySubmenu, "inn">, CityNavigationDefinition> = {
	home: {
		iconPath: "city.home.5",
		titleKey: "app:city.labels.home",
		subtitleKey: "app:city.subtitles.homeScreen"
	},
	homeBed: {
		iconPath: "city.homeUpgrades.bed",
		titleKey: "app:city.labels.bed",
		subtitleKey: "app:city.subtitles.bed"
	},
	homeChest: {
		iconPath: "city.homeUpgrades.chest",
		titleKey: "app:city.labels.chest",
		subtitleKey: "app:city.subtitles.chest"
	},
	homeGarden: {
		iconPath: "city.homeUpgrades.garden",
		titleKey: "app:city.labels.garden",
		subtitleKey: "app:city.subtitles.garden"
	},
	homeCooking: {
		iconPath: "city.homeUpgrades.cooking",
		titleKey: "app:city.labels.cooking",
		subtitleKey: "app:city.subtitles.cookingScreen"
	},
	homeUpgrade: {
		iconPath: "city.homeUpgrades.upgradeEquipment",
		titleKey: "app:city.labels.upgradeStation",
		subtitleKey: "app:city.subtitles.upgradeStation"
	},
	notary: {
		iconPath: "city.manageHome",
		titleKey: "app:city.actions.notary",
		subtitleKey: "app:city.subtitles.notary"
	},
	enchanter: {
		iconPath: "city.services.enchanter",
		titleKey: "app:city.labels.enchanter",
		subtitleKey: "commands:report.city.reactions.enchanter.description"
	},
	blacksmith: {
		iconPath: "city.services.blacksmith",
		titleKey: "app:city.labels.blacksmith",
		subtitleKey: "commands:report.city.blacksmith.menuDescription"
	},
	scrapDealer: {
		iconPath: "city.services.scrapDealer",
		titleKey: "app:city.labels.scrapDealer",
		subtitleKey: "commands:report.city.scrapDealer.menuDescription"
	},
	royalBlacksmith: {
		iconPath: "city.services.royalBlacksmith",
		titleKey: "app:city.labels.royalBlacksmith",
		subtitleKey: "commands:report.city.royalBlacksmith.menuDescription"
	},
	guild: {
		iconPath: "city.guildDomain.menu",
		titleKey: "app:city.labels.guildDomain",
		subtitleKey: "commands:report.city.guildDomain.description"
	}
};

type CityNavigationConfig = {
	group: Exclude<CityGroup, "elsewhere">;
	view: Exclude<CitySubmenu, "inn">;
	key: string;
};

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

function cityNavigationMeta(view: Exclude<CitySubmenu, "inn">): Omit<CityNavigationItem, "kind" | "key" | "view"> {
	const definition = CITY_NAVIGATION_META[view];
	return {
		iconPath: definition.iconPath,
		title: i18n.t(definition.titleKey),
		subtitle: i18n.t(definition.subtitleKey)
	};
}

function navigationItem(view: Exclude<CitySubmenu, "inn">, key: string): CityNavigationItem {
	return {kind: "navigation", key, view, ...cityNavigationMeta(view)};
}

function homeNavigationItem(homeOwned: NonNullable<CityMobileSnapshot["home"]>["owned"]): CityNavigationItem {
	const apartment = homeOwned?.isApartment === true;
	return {
		kind: "navigation",
		key: "home",
		view: "home",
		iconPath: homeIconPath(homeOwned?.level),
		title: i18n.t(apartment ? "app:city.labels.apartment" : "app:city.labels.home"),
		subtitle: i18n.t(apartment
		? "commands:report.city.homes.goToOwnedApartmentDescription"
		: "commands:report.city.homes.goToOwnedHomeDescription")
	};
}

function innNavigationItem(innId: string): CityNavigationItem {
	return {
		kind: "navigation",
		key: `inn-${innId}`,
		view: "inn",
		innId,
		iconPath: "city.inn",
		title: i18n.t("app:city.labels.inn", {
			name: i18n.t(`commands:report.city.inns.names.${innId}`)
		}),
		subtitle: i18n.t("commands:report.city.reactions.inn.description")
	};
}

function sortCityItems(left: CityListItem, right: CityListItem): number {
	const leftOrder = left.kind === "navigation"
		? CITY_SUBMENU_ORDER[left.view]
		: left.kind === "info" ? Number.MAX_SAFE_INTEGER : CITY_REACTION_ORDER[left.entry.reaction.type] ?? Number.MAX_SAFE_INTEGER;
	const rightOrder = right.kind === "navigation"
		? CITY_SUBMENU_ORDER[right.view]
		: right.kind === "info" ? Number.MAX_SAFE_INTEGER : CITY_REACTION_ORDER[right.entry.reaction.type] ?? Number.MAX_SAFE_INTEGER;
	return leftOrder - rightOrder;
}

function emptyCityGroups(): Record<CityGroup, CityListItem[]> {
	return {housing: [], services: [], shops: [], guild: [], elsewhere: [], quit: []};
}

function emptyCitySubmenus(): Record<CitySubmenu, CityEntry[]> {
	return {home: [], homeBed: [], homeChest: [], homeGarden: [], homeCooking: [], homeUpgrade: [], notary: [], inn: [], enchanter: [], blacksmith: [], scrapDealer: [], royalBlacksmith: [], guild: []};
}

type CityGroupingOptions = {
	availableServices?: string[];
	innIds?: string[];
	homeOwned?: NonNullable<CityMobileSnapshot["home"]>["owned"];
	homeManage?: NonNullable<CityMobileSnapshot["home"]>["manage"];
	shops?: CityMobileSnapshot["shops"];
	guildFoodShop?: CityMobileSnapshot["guildFoodShop"];
	otherCityServices?: CityMobileSnapshot["otherCityServices"];
	};

type CityGroupingState = {
	groups: Record<CityGroup, CityListItem[]>;
	submenus: Record<CitySubmenu, CityEntry[]>;
	inns: Map<string, CityEntry[]>;
	hasNotary: boolean;
	hasGuildActions: boolean;
};

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addCityEntry(state: CityGroupingState, entry: CityEntry, options: CityGroupingOptions): void {
	const {reaction} = entry;
	if (reaction.type === GENERIC_REACTION_KINDS.REFUSE) return;
	const navigation = CITY_NAVIGATION_REACTIONS[reaction.type];
	if (navigation) {
		state.groups[navigation.group].push(navigation.view === "home" ? homeNavigationItem(options.homeOwned) : navigationItem(navigation.view, navigation.key));
		return;
	}
	if (reaction.type === CITY_REACTION_KINDS.EXIT) {
		state.groups.quit.push({kind: "reaction", entry});
		return;
	}
	if (reaction.type === CITY_REACTION_KINDS.SHOP) {
		state.groups.shops.push({kind: "reaction", entry});
		return;
	}
	if (reaction.type === CITY_REACTION_KINDS.INN_MEAL || reaction.type === CITY_REACTION_KINDS.INN_ROOM) {
		const innId = (reaction.data as {innId: string}).innId;
		state.inns.set(innId, [...(state.inns.get(innId) ?? []), entry]);
		return;
	}
	if (reaction.type === CITY_REACTION_KINDS.ENCHANT) {
		state.submenus.enchanter.push(entry);
		return;
	}
	const submenu = CITY_SUBMENU_REACTIONS[reaction.type];
	if (submenu) {
		state.submenus[submenu].push(entry);
		state.hasNotary ||= submenu === "notary";
		state.hasGuildActions ||= submenu === "guild";
		return;
	}
	state.groups.services.push({kind: "reaction", entry});
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addInnServices(state: CityGroupingState, innIds: string[] | undefined): void {
	for (const [innId, innEntries] of state.inns) {
		state.submenus.inn.push(...innEntries);
		state.groups.services.push(innNavigationItem(innId));
	}
	for (const innId of innIds ?? []) {
		if (!state.groups.services.some(item => item.kind === "navigation" && item.view === "inn" && item.innId === innId)) {
			state.groups.services.push(innNavigationItem(innId));
		}
	}
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addAvailableServices(state: CityGroupingState, options: CityGroupingOptions): void {
	if (state.hasNotary) state.groups.housing.push(navigationItem("notary", "notary"));
	if (state.hasGuildActions && !state.groups.guild.some(item => item.kind === "navigation" && item.view === "guild")) {
		state.groups.guild.push(navigationItem("guild", "guild-domain"));
	}
	if (state.submenus.enchanter.length > 0 || options.availableServices?.includes("enchanter")) {
		state.groups.services.push(navigationItem("enchanter", "enchanter"));
	}
	if (options.availableServices?.includes("bossArchivist")) {
		state.groups.services.push({kind: "info", key: "boss-archivist", iconPath: "city.services.bossArchivist", title: i18n.t("commands:report.city.bossArchivist.serviceTitle"), subtitle: compactCityDescription(i18n.t("commands:report.city.bossArchivist.serviceDescription"))});
	}
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addEmptyShops(state: CityGroupingState, shops: CityGroupingOptions["shops"]): void {
	for (const shop of shops ?? []) {
		if (!shop.isEmpty) continue;
		state.groups.shops.push({kind: "info", key: `empty-shop-${shop.shopId}`, iconPath: `city.shops.${shop.shopId}`, title: i18n.t(`commands:report.city.shops.${shop.shopId}.label`), subtitle: compactCityDescription(i18n.t("commands:report.city.shopEmptyDescription"))});
	}
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addGuildFoodShop(state: CityGroupingState, foodShop: CityGroupingOptions["guildFoodShop"]): void {
	if (!foodShop) return;
	state.groups.guild.push({kind: "info", key: "guild-food-shop", iconPath: "expedition.food", title: i18n.t("commands:report.city.guildFoodShop.label"), subtitle: i18n.t("commands:report.city.guildFoodShop.description", {guildName: foodShop.guildName})});
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function addOtherCityServices(state: CityGroupingState, services: CityGroupingOptions["otherCityServices"]): void {
	for (const service of services ?? []) {
		const locationName = (service.mapLocationIds ?? [service.mapLocationId]).map(mapLocationId => i18n.t(`models:map_locations.${mapLocationId}.name`)).join(" · ");
		const titleKey = service.kind === "shop" ? `commands:report.city.shops.${service.serviceKey}.label` : service.serviceKey === "bossArchivist" ? "commands:report.city.bossArchivist.serviceTitle" : `commands:report.city.${service.serviceKey}.menuLabel`;
		const descriptionKey = service.kind === "shop" ? `commands:report.city.shops.${service.serviceKey}.description` : service.serviceKey === "bossArchivist" ? "commands:report.city.bossArchivist.serviceDescription" : `commands:report.city.${service.serviceKey}.menuDescription`;
		state.groups.elsewhere.push({kind: "info", key: `${service.kind}-${service.mapLocationId}-${service.serviceKey}`, iconPath: service.kind === "shop" ? `city.shops.${service.serviceKey}` : `city.services.${service.serviceKey}`, title: i18n.t(titleKey), subtitle: `${locationName} · ${compactCityDescription(i18n.t(descriptionKey))}`});
	}
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function decorateHomeNavigation(state: CityGroupingState, home: CityGroupingOptions["homeOwned"]): void {
	if (!home) return;
	state.groups.housing = state.groups.housing.map(item => item.kind === "navigation" && item.view === "home" ? {
		...item,
		iconPath: homeIconPath(home.level),
		subtitle: i18n.t("app:city.subtitles.homeDetails", {
			level: home.level,
			services: [home.hasBed ? i18n.t("app:city.summary.bed") : null, home.hasChest ? i18n.t("app:city.summary.chest") : null, home.hasGarden ? i18n.t("app:city.summary.garden") : null, home.hasCooking ? i18n.t("app:city.summary.cooking") : null, home.hasUpgradeStation ? i18n.t("app:city.summary.forge") : null].filter(Boolean).join(", ")
		})
	} : item);
}

function sortCityModel(state: CityGroupingState): CityMenuModel {
	for (const group of Object.values(state.groups)) group.sort(sortCityItems);
	for (const submenu of Object.values(state.submenus)) submenu.sort((left, right) => (CITY_REACTION_ORDER[left.reaction.type] ?? Number.MAX_SAFE_INTEGER) - (CITY_REACTION_ORDER[right.reaction.type] ?? Number.MAX_SAFE_INTEGER));
	return {groups: state.groups, submenus: state.submenus};
}

function groupCityEntries(entries: CityEntry[], options: CityGroupingOptions = {}): CityMenuModel {
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

function submenuTitle(view: CitySubmenu, innId?: string): {eyebrow: string; title: string; subtitle?: string} {
	if (view === "inn" && innId) {
		const name = i18n.t(`commands:report.city.inns.names.${innId}`);
		return {
			eyebrow: i18n.t("app:city.titles.eyebrow"),
			title: i18n.t("app:city.labels.inn", {name}),
			subtitle: compactCityDescription(i18n.t("commands:report.city.reactions.inn.description"))
		};
	}
	const meta = cityNavigationMeta(view as Exclude<CitySubmenu, "inn">);
	return {
		eyebrow: i18n.t("app:city.titles.eyebrow"),
		title: meta.title,
		subtitle: meta.subtitle
	};
}

function CitySubmenuView({view, innId, entries, collector, snapshot, onChoose, onNavigate, onBack, locked, backLabel}: {
	view: CitySubmenu;
	innId?: string;
	entries: CityEntry[];
	collector: ReactionCollectorCreation;
	snapshot?: CityMobileSnapshot;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	onBack: () => void;
	locked: boolean;
	backLabel?: string;
}): ReactNode {
	const details = submenuTitle(view, innId);
	const iconPath = view === "inn"
		? "city.inn"
		: view === "home" ? homeIconPath(snapshot?.home?.owned?.level) : cityNavigationMeta(view as Exclude<CitySubmenu, "inn">).iconPath;
	const icon = AppIcons.getIconOrNull(iconPath);
	const sections = buildSubmenuSections(view, entries, snapshot, {
		homeFeatureItems,
		gardenPlotItems,
		homeChestItems,
		homeCookingItems,
		guildFeatureItems,
		enchantmentCatalogItems
	});
	const visibleSections = sections.filter(section => section.items.length > 0);

	return (
		<Screen>
			<Hero eyebrow={details.eyebrow} title={`${icon ? `${icon} ` : ""}${details.title}`} subtitle={details.subtitle} />
			<CitySnapshotSummary view={view} snapshot={snapshot} />
			{visibleSections.map((section, index) => (
				<CitySection
					key={section.title}
					title={section.title}
					items={section.items}
					collector={collector}
					onChoose={onChoose}
					onNavigate={onNavigate}
					locked={locked}
					first={index === 0}
					iconForPath={iconForPath}
					rowIcon={cityRowIcon}
					rowTitle={cityRowTitle}
					rowSubtitle={renderCityRowSubtitle}
					rowEnd={renderCityRowEnd}
					reactionAvailable={cityReactionAvailable}
				/>
			))}
			{citySnapshotNote(view, snapshot)}
			{visibleSections.length === 0 ? <Note>{i18n.t("app:city.subtitles.noActions")}</Note> : null}
			<ButtonRow><Button disabled={locked} onPress={locked ? undefined : onBack}>{backLabel ?? i18n.t("app:city.actions.back")}</Button></ButtonRow>
		</Screen>
	);
}

// @codescene(disable:"Complex Method")
// @codescene(disable:"Overall Code Complexity")
export function CityCollector({collector, onChoose, submitting}: CityCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	const [submenu, setSubmenu] = useState<CitySubmenu | null>(null);
	const [innId, setInnId] = useState<string>();
	if (collector.data.type !== CITY_DATA_KINDS.CITY) {
		return null;
	}
	// Expiration is owned by CollectorsStore. It removes this collector even when the app is in the
	// background, so this view does not need a visible countdown or a second ticking timer.
	const locked = answered || submitting;
	const entries = collector.reactions.map((reaction, index) => ({reaction, index}));
	const model = groupCityEntries(entries, {
		availableServices: collector.data.data.availableServices,
		innIds: collector.data.data.snapshot?.inns?.map(inn => inn.innId),
		homeOwned: collector.data.data.snapshot?.home?.owned,
		homeManage: collector.data.data.snapshot?.home?.manage,
		shops: collector.data.data.snapshot?.shops,
		guildFoodShop: collector.data.data.snapshot?.guildFoodShop,
		otherCityServices: collector.data.data.snapshot?.otherCityServices
	});
	const locationName = i18n.t(`models:map_locations.${collector.data.data.mapLocationId}.name`);
	const locationDescription = i18n.t(`models:map_locations.${collector.data.data.mapLocationId}.description`);
	const mapIcon = AppIcons.getIconOrNull(`mapTypes.${collector.data.data.mapTypeId}`);
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	const navigate = (item: CityNavigationItem): void => {
		setInnId(item.innId);
		setSubmenu(item.view);
	};
	const gardenOnly = collector.data.data.gardenOnly === true;
	const gardenCloseIndex = gardenOnly
		? collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE)
		: -1;

	if (gardenOnly) {
		return <CitySubmenuView
			view="homeGarden"
			entries={model.submenus.homeGarden}
			collector={collector}
			snapshot={collector.data.data.snapshot}
			onChoose={choose}
			onNavigate={() => undefined}
			onBack={() => {
				if (gardenCloseIndex >= 0) {
					choose(gardenCloseIndex);
				}
			}}
			backLabel={i18n.t("app:city.actions.close")}
			locked={locked}
		/>;
	}

	if (submenu) {
		const submenuEntries = submenu === "inn" && innId
			? model.submenus.inn.filter(entry => (entry.reaction.data as {innId: string}).innId === innId)
			: model.submenus[submenu];
		return <CitySubmenuView
			view={submenu}
			innId={innId}
			entries={submenuEntries}
			collector={collector}
			snapshot={collector.data.data.snapshot}
			onChoose={choose}
			onNavigate={navigate}
			onBack={() => setSubmenu(null)}
			locked={locked}
		/>;
	}

	const sectionDefinitions = [
		{key: "housing" as const, title: i18n.t("app:city.titles.housing")},
		{key: "services" as const, title: i18n.t("app:city.titles.services")},
		{key: "shops" as const, title: i18n.t("app:city.titles.shops")},
		{key: "guild" as const, title: i18n.t("app:city.titles.guild")},
		{key: "elsewhere" as const, title: i18n.t("app:city.titles.otherCities"), hint: i18n.t("app:city.subtitles.otherCities")},
		{key: "quit" as const, title: i18n.t("app:city.titles.quit")}
	].filter(section => model.groups[section.key].length > 0);

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:city.titles.eyebrow")}
				title={`${mapIcon ? `${mapIcon} ` : ""}${locationName}`}
				subtitle={locationDescription}
			/>
			{sectionDefinitions.map((section, index) => (
				<CitySection
					key={section.key}
					title={section.title}
					hint={section.hint}
					items={model.groups[section.key]}
					collector={collector}
					onChoose={choose}
					onNavigate={navigate}
					locked={locked}
					first={index === 0}
					iconForPath={iconForPath}
					rowIcon={cityRowIcon}
					rowTitle={cityRowTitle}
					rowSubtitle={renderCityRowSubtitle}
					rowEnd={renderCityRowEnd}
					reactionAvailable={cityReactionAvailable}
				/>
			))}
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
