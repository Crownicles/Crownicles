import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS, GENERIC_REACTION_KINDS,
	CityMobileItem, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {isChoosable, reactionLabel} from "@/src/collectors/CollectorLabels";
import {CitySnapshotSummary} from "@/src/collectors/CitySnapshotSummary";
import {citySnapshotNote} from "@/src/collectors/CitySnapshotNote";
import {
	cityRowEnd as renderCityRowEnd,
	cityRowSubtitle as renderCityRowSubtitle,
	compactCityDescription
} from "@/src/collectors/CityRowDetails";
import {Button, ButtonRow, Hero, Note, Panel, Row, Screen, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type CityEntry = {reaction: ReactionCollectorReaction; index: number};

type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";

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
type CityListItem = CityNavigationItem | CityInfoItem | CityReactionItem;

type CityMenuModel = {
	groups: Record<CityGroup, CityListItem[]>;
	submenus: Record<CitySubmenu, CityEntry[]>;
};

const CITY_ICON_PATHS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[CITY_REACTION_KINDS.EXIT]: "city.exit",
	[CITY_REACTION_KINDS.INN_MEAL]: "city.inn",
	[CITY_REACTION_KINDS.INN_ROOM]: "city.inn",
	[CITY_REACTION_KINDS.ENCHANT]: "city.services.enchanter",
	[CITY_REACTION_KINDS.BUY_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.MOVE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.HOME_MENU]: "city.home.5",
	[CITY_REACTION_KINDS.HOME_BED]: "city.homeUpgrades.bed",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "city.homeUpgrades.upgradeEquipment",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "city.blacksmith.disenchant",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_WATER]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "city.guildDomain.menu",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "city.guildDomainNotary",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "city.apartmentNotary.menu",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "city.apartmentNotary.menu"
};

function cityIconPath(reaction: ReactionCollectorReaction): string | undefined {
	if (reaction.type === CITY_REACTION_KINDS.SHOP) {
		return `city.shops.${reaction.data.shopId}`;
	}
	return CITY_ICON_PATHS[reaction.type];
}

function iconForPath(iconPath: string): ReactNode | undefined {
	const emoji = AppIcons.getIconOrNull(iconPath);
	return emoji
		? <TwemojiIcon emoji={emoji} size={Theme.fontSize.rowTitle} />
		: undefined;
}

function cityItemName(item: {itemId: number; itemCategory: number}): string {
	const itemType = ["weapon", "armor", "potion", "object"][item.itemCategory] ?? "object";
	return i18n.t(`models:${itemType}s.${item.itemId}`);
}

// @codescene(disable:"Complex Method")
function cityItem(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	if (!snapshot) {
		return undefined;
	}
	const data = reaction.data as {slot?: number; itemCategory?: number};
	const category = data.itemCategory;
	const slot = data.slot;
	if (category === undefined || slot === undefined) {
		return undefined;
	}
	const candidates = [
		...(snapshot.enchanter?.enchantableItems ?? []),
		...(snapshot.blacksmith?.upgradeableItems ?? []),
		...(snapshot.blacksmith?.disenchantableItems ?? []),
		...(snapshot.scrapDealer?.recyclableItems ?? []),
		...(snapshot.royalBlacksmith?.upgradeableItems ?? [])
	];
	return candidates.find(item => item.itemCategory === category && item.itemId !== undefined && item.slot === slot);
}

function itemSnapshotForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	return cityItem(snapshot, reaction);
}

function cityItemIconPath(item: CityMobileItem): string {
	const itemType = ["weapons", "armors", "potions", "objects"][item.itemCategory] ?? "objects";
	return `${itemType}.${item.itemId}`;
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional", disable:"Bumpy Road Ahead")
function cityRowIcon(reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot): ReactNode | undefined {
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		const disenchant = item && snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
		const enchantmentIcon = disenchant && iconForPath(`enchantmentTypes.${disenchant.enchantmentType}`);
		if (enchantmentIcon) {
			return enchantmentIcon;
		}
	}
	if (reaction.type === CITY_REACTION_KINDS.ENCHANT
		|| reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE
		|| reaction.type === CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE
		|| reaction.type === CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		if (item) {
			return iconForPath(cityItemIconPath(item));
		}
	}
	const iconPath = cityIconPath(reaction);
	return iconPath ? iconForPath(iconPath) : undefined;
}

// @codescene(disable:"Complex Method")
function cityReactionAvailable(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	if (reaction.type === CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY) {
		return snapshot?.guildDomainNotary?.canAfford ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_BUY) {
		return snapshot?.apartmentNotary?.forSale?.canAfford ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.BUY_HOME) {
		return snapshot?.home?.manage?.canBuy ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.UPGRADE_HOME) {
		return snapshot?.home?.manage?.canUpgrade ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.MOVE_HOME) {
		return snapshot?.home?.manage?.canMove ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
		return snapshot?.apartmentNotary?.ownedApartments.find(apartment => apartment.apartmentId === apartmentId)?.canClaim ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_HARVEST) {
		return snapshot?.home?.owned?.garden?.eligibility.canHarvest ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_WATER) {
		return snapshot?.home?.owned?.garden?.eligibility.canWaterGarden ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_COMPOST) {
		return snapshot?.home?.owned?.garden?.eligibility.canCompost ?? true;
	}
	const item = itemSnapshotForReaction(snapshot, reaction);
	if (!item) {
		return true;
	}
	switch (reaction.type) {
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE: {
			const upgrade = snapshot?.blacksmith?.upgradeableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
			return reaction.data.buyMaterials ? upgrade?.canBuyAndUpgrade ?? true : upgrade?.canUpgrade ?? true;
		}
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
			return snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory)?.canDisenchant ?? true;
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
			const upgrade = snapshot?.royalBlacksmith?.upgradeableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
			return reaction.data.buyMaterials ? upgrade?.canBuyAndUpgrade ?? true : upgrade?.canUpgrade ?? true;
		}
		default:
			return true;
	}
}

function cityRowTitle(reaction: ReactionCollectorReaction, collectorData: ReactionCollectorCreation["data"], snapshot?: CityMobileSnapshot): string {
	if (collectorData.type !== CITY_DATA_KINDS.CITY) {
		return reactionLabel(reaction, collectorData);
	}

	switch (reaction.type) {
		case CITY_REACTION_KINDS.HOME_MENU:
			return i18n.t("app:city.actions.home");
		case CITY_REACTION_KINDS.HOME_BED:
			return i18n.t("commands:report.city.homes.bed.buttonLabel");
		case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY:
			return snapshot?.guildDomainNotary?.hasDomain
				? i18n.t("commands:report.city.guildDomain.confirmRelocate")
				: i18n.t("commands:report.city.guildDomain.confirmPurchase");
		case CITY_REACTION_KINDS.APARTMENT_BUY:
			return i18n.t("commands:report.city.homes.apartmentNotary.buyButtonLabel");
		case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT: {
			const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
			const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
			return apartment
				? i18n.t(`models:map_locations.${apartment.mapLocationId}.name`)
				: reactionLabel(reaction, collectorData);
		}
		case CITY_REACTION_KINDS.GARDEN_HARVEST:
			return i18n.t("commands:report.city.homes.garden.harvestButton");
		case CITY_REACTION_KINDS.GARDEN_WATER:
			return i18n.t("commands:report.city.homes.garden.waterButton");
		case CITY_REACTION_KINDS.INN_MEAL:
			return i18n.t(`commands:report.city.inns.meals.${reaction.data.mealId}`);
		case CITY_REACTION_KINDS.INN_ROOM:
			return i18n.t(`commands:report.city.inns.rooms.${reaction.data.roomId}`);
		case CITY_REACTION_KINDS.SHOP:
			// The row already renders the shop icon through `cityRowIcon`.
			// Keep the title text-only to avoid announcing/rendering the icon twice.
			return i18n.t(`commands:report.city.shops.${reaction.data.shopId}.label`);
		case CITY_REACTION_KINDS.EXIT:
			// Same rule for the exit row: its walking icon is supplied separately.
			return i18n.t("commands:report.city.reactions.exit.label");
		case CITY_REACTION_KINDS.ENCHANT:
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
			const item = itemSnapshotForReaction(snapshot, reaction);
			return item ? cityItemName(item) : reactionLabel(reaction, collectorData);
		}
		default:
			return reactionLabel(reaction, collectorData);
	}
}

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

type CitySubmenuSection = {title: string; items: CityListItem[]};

function homeIconPath(level: number | undefined): string {
	const safeLevel = Math.max(1, Math.min(8, level ?? 5));
	return `city.home.${safeLevel}`;
}

// @codescene(disable:"Complex Method")
function homeFeatureItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const home = snapshot?.home?.owned;
	if (!home) {
		return [];
	}
	const items: CityListItem[] = [];
	if (home.hasBed) {
		items.push({
			kind: "navigation",
			key: "home-bed",
			view: "homeBed",
			iconPath: "city.homeUpgrades.bed",
			title: i18n.t("app:city.labels.bed"),
			subtitle: i18n.t("commands:report.city.homes.bed.menuDescription", {health: home.bedHealthRegeneration})
		});
	}
	if (home.hasChest) {
		const stored = home.chestItemCount === undefined
			? ""
			: ` · ${i18n.t("items:object", {count: home.chestItemCount})}`;
		items.push({
			kind: "navigation",
			key: "home-chest",
			view: "homeChest",
			iconPath: "city.homeUpgrades.chest",
			title: i18n.t("commands:report.city.homes.chest.menuLabel"),
			subtitle: `${i18n.t("commands:report.city.homes.chest.menuDescription")}${stored}`
		});
	}
	if (home.hasGarden) {
		const ready = home.gardenReadyPlots ?? 0;
		const total = home.gardenTotalPlots ?? home.gardenPlots;
		items.push({
			kind: "navigation",
			key: "home-garden",
			view: "homeGarden",
			iconPath: "city.homeUpgrades.garden",
			title: i18n.t("app:city.labels.garden"),
			subtitle: i18n.t("commands:report.city.homes.garden.menuDescription", {ready, total})
		});
	}
	if (home.hasCooking) {
		items.push({
			kind: "navigation",
			key: "home-cooking",
			view: "homeCooking",
			iconPath: "city.homeUpgrades.cooking",
			title: i18n.t("app:city.labels.cooking"),
			subtitle: i18n.t("app:city.subtitles.cooking", {level: home.cookingLevel ?? 0})
		});
	}
	if (home.hasUpgradeStation) {
		items.push({
			kind: "navigation",
			key: "home-upgrade-station",
			view: "homeUpgrade",
			iconPath: "city.homeUpgrades.upgradeEquipment",
			title: i18n.t("commands:report.city.homes.upgradeStation.menuLabel"),
			subtitle: i18n.t("commands:report.city.homes.upgradeStation.menuDescription")
		});
	}
	if (snapshot?.home?.manage) {
		items.push({
			kind: "navigation",
			key: "home-notary",
			view: "notary",
			iconPath: "city.manageHome",
			title: i18n.t("app:city.labels.manageHome"),
			subtitle: i18n.t("app:city.subtitles.notary")
		});
	}
	return items;
}

function gardenPlotItems(snapshot: CityMobileSnapshot | undefined): CityInfoItem[] {
	const garden = snapshot?.home?.owned?.garden;
	if (!garden) {
		return [];
	}
	return garden.plots.map(plot => {
		if (plot.plantId === 0) {
			return {
				kind: "info",
				key: `garden-plot-${plot.slot}`,
				iconPath: "city.gardenStatus.empty",
				title: i18n.t("app:city.garden.plot", {slot: plot.slot + 1}),
				subtitle: i18n.t("app:city.garden.empty")
			};
		}
		return {
			kind: "info",
			key: `garden-plot-${plot.slot}`,
			iconPath: `plants.${plot.plantId}`,
			title: i18n.t("app:city.garden.plotPlant", {
				slot: plot.slot + 1,
				plant: i18n.t(`models:plants.${plot.plantId}`)
			}),
			subtitle: plot.isReady
				? i18n.t("app:city.garden.ready")
				: i18n.t("app:city.garden.growing", {progress: Math.round(plot.growthProgress * 100)})
		};
	});
}

function homeChestItems(snapshot: CityMobileSnapshot | undefined): CityInfoItem[] {
	const home = snapshot?.home?.owned;
	if (!home) {
		return [];
	}
	return [
		{
			kind: "info",
			key: "home-chest-stored",
			iconPath: "city.homeUpgrades.chest",
			title: i18n.t("app:city.chest.stored"),
			subtitle: i18n.t("app:city.chest.storedDetails", {count: home.chestItemCount ?? 0})
		},
		{
			kind: "info",
			key: "home-chest-depositable",
			iconPath: "city.chestActions.inventory",
			title: i18n.t("app:city.chest.depositable"),
			subtitle: i18n.t("app:city.chest.depositableDetails", {count: home.depositableItemCount ?? 0})
		}
	];
}

function homeCookingItems(snapshot: CityMobileSnapshot | undefined): CityInfoItem[] {
	const home = snapshot?.home?.owned;
	if (!home) {
		return [];
	}
	return [
		{
			kind: "info",
			key: "home-cooking-level",
			iconPath: "city.homeUpgrades.cooking",
			title: i18n.t("app:city.labels.cooking"),
			subtitle: i18n.t("app:city.subtitles.cooking", {level: home.cookingLevel ?? 0})
		},
		{
			kind: "info",
			key: "home-cooking-slots",
			iconPath: "city.homeUpgrades.cooking",
			title: i18n.t("app:city.summary.cookingSlots"),
			subtitle: i18n.t("app:city.summary.cookingSlotsDetails", {count: home.cookingSlots ?? 0})
		}
	];
}

function guildFeatureItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const guild = snapshot?.guildDomain;
	if (!guild) {
		return [];
	}
	const building = (key: "shop" | "shelter" | "pantry" | "trainingGround", level: number, subtitle: string): CityInfoItem => ({
		kind: "info",
		key: `guild-${key}`,
		iconPath: `city.guildDomain.${key === "trainingGround" ? "trainingGround" : key}`,
		title: i18n.t("app:city.summary.buildingLevel", {
			building: i18n.t(`commands:report.city.guildDomain.buildings.${key}`),
			level
		}),
		subtitle
	});
	return [
		building("shop", guild.shopLevel, guild.shopLevel > 0
			? i18n.t("commands:report.city.guildDomain.buildingSummary.shop.built")
			: i18n.t("commands:report.city.guildDomain.buildingSummary.shop.locked")),
		building("shelter", guild.shelterLevel, i18n.t("commands:report.city.guildDomain.buildingSummary.shelter", {slots: guild.shelterMaxCount})),
		building("pantry", guild.pantryLevel, i18n.t("commands:report.city.guildDomain.buildingSummary.pantry")),
		building("trainingGround", guild.trainingGroundLevel, i18n.t(guild.trainingGroundLevel > 0
			? "commands:report.city.guildDomain.buildingSummary.trainingGround.active"
			: "commands:report.city.guildDomain.buildingSummary.trainingGround.inactive", {love: 1}))
	];
}

const ENCHANTMENT_CATALOG: {key: string; iconPath: string; titleKey: string; subtitleKey: string}[] = [
	{key: "attack", iconPath: "enchantmentTypes.damage", titleKey: "app:city.enchantmentCatalog.attack", subtitleKey: "app:city.enchantmentCatalog.attackDetails"},
	{key: "pvp-pve-attack", iconPath: "enchantmentTypes.damage", titleKey: "app:city.enchantmentCatalog.pvpPveAttack", subtitleKey: "app:city.enchantmentCatalog.pvpPveAttackDetails"},
	{key: "defense", iconPath: "enchantmentTypes.defense", titleKey: "app:city.enchantmentCatalog.defense", subtitleKey: "app:city.enchantmentCatalog.defenseDetails"},
	{key: "speed", iconPath: "enchantmentTypes.speed", titleKey: "app:city.enchantmentCatalog.speed", subtitleKey: "app:city.enchantmentCatalog.speedDetails"},
	{key: "energy", iconPath: "enchantmentTypes.health", titleKey: "app:city.enchantmentCatalog.energy", subtitleKey: "app:city.enchantmentCatalog.energyDetails"},
	{key: "breath", iconPath: "enchantmentTypes.other", titleKey: "app:city.enchantmentCatalog.breath", subtitleKey: "app:city.enchantmentCatalog.breathDetails"},
	{key: "elemental", iconPath: "enchantmentTypes.magic", titleKey: "app:city.enchantmentCatalog.elemental", subtitleKey: "app:city.enchantmentCatalog.elementalDetails"}
];

function enchantmentCatalogItems(): CityInfoItem[] {
	return ENCHANTMENT_CATALOG.map(entry => ({
		kind: "info",
		key: `enchantment-${entry.key}`,
		iconPath: entry.iconPath,
		title: i18n.t(entry.titleKey),
		subtitle: i18n.t(entry.subtitleKey)
	}));
}

// @codescene(disable:"Complex Method")
function submenuSections(view: CitySubmenu, entries: CityEntry[], snapshot?: CityMobileSnapshot): CitySubmenuSection[] {
	if (view === "inn") {
		return [
			{title: i18n.t("app:city.titles.meals"), items: entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_MEAL).map(entry => ({kind: "reaction" as const, entry}))},
			{title: i18n.t("app:city.titles.rooms"), items: entries.filter(entry => entry.reaction.type === CITY_REACTION_KINDS.INN_ROOM).map(entry => ({kind: "reaction" as const, entry}))}
		];
	}
	if (view === "home") {
		return [{
			title: i18n.t("app:city.titles.homeServices"),
			items: [
				...entries.map(entry => ({kind: "reaction" as const, entry})),
				...homeFeatureItems(snapshot)
			]
		}];
	}
	if (view === "homeBed") {
		return [{
			title: i18n.t("app:city.titles.actions"),
			items: entries.map(entry => ({kind: "reaction" as const, entry}))
		}];
	}
	if (view === "homeChest") {
		return [{title: i18n.t("app:city.titles.storage"), items: homeChestItems(snapshot)}];
	}
	if (view === "homeCooking") {
		return [{title: i18n.t("app:city.titles.cooking"), items: homeCookingItems(snapshot)}];
	}
	if (view === "guild") {
		return [{
			title: i18n.t("app:city.titles.actions"),
			items: [...guildFeatureItems(snapshot), ...entries.map(entry => ({kind: "reaction" as const, entry}))]
		}];
	}
	if (view === "enchanter") {
		return [
			{title: i18n.t("app:city.titles.eligibleEquipment"), items: entries.map(entry => ({kind: "reaction" as const, entry}))},
			{title: i18n.t("app:city.enchantmentCatalog.title"), items: enchantmentCatalogItems()}
		];
	}
	if (view === "homeGarden") {
		return [{
			title: i18n.t("app:city.titles.garden"),
			items: [
				...gardenPlotItems(snapshot),
				...entries.map(entry => ({kind: "reaction" as const, entry}))
			]
		}];
	}
	if (view === "homeUpgrade") {
		return [{
			title: i18n.t("app:city.titles.equipment"),
			items: entries.map(entry => ({kind: "reaction" as const, entry}))
		}];
	}
	const groups: Record<string, CityEntry[]> = {};
	const add = (titleKey: string, entry: CityEntry): void => {
		(groups[titleKey] ??= []).push(entry);
	};
	for (const entry of entries) {
		const type = entry.reaction.type;
		if (view === "notary") {
			add(type === CITY_REACTION_KINDS.APARTMENT_BUY || type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT
				? "app:city.titles.apartments"
				: type === CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY
					? "app:city.labels.guildDomain"
					: "app:city.titles.yourHome", entry);
		}
		else if (view === "blacksmith") {
			add(type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT ? "app:city.titles.disenchant" : "app:city.titles.equipment", entry);
		}
		else if (view === "scrapDealer") {
			add("app:city.titles.recycling", entry);
		}
		else if (view === "royalBlacksmith") {
			add("app:city.titles.equipment", entry);
		}
		else if (view === "enchanter") {
			add("app:city.titles.eligibleEquipment", entry);
		}
		else {
			add("app:city.titles.actions", entry);
		}
	}
	return Object.entries(groups).map(([titleKey, groupedEntries]) => ({
		title: i18n.t(titleKey),
		items: groupedEntries.map(entry => ({kind: "reaction" as const, entry}))
	}));
}

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

function groupCityEntries(entries: CityEntry[], options: {
	availableServices?: string[];
	innIds?: string[];
	homeOwned?: NonNullable<CityMobileSnapshot["home"]>["owned"];
	homeManage?: NonNullable<CityMobileSnapshot["home"]>["manage"];
	shops?: CityMobileSnapshot["shops"];
	guildFoodShop?: CityMobileSnapshot["guildFoodShop"];
	otherCityServices?: CityMobileSnapshot["otherCityServices"];
} = {}): CityMenuModel {
	const groups = emptyCityGroups();
	const submenus = emptyCitySubmenus();
	const inns = new Map<string, CityEntry[]>();
	let hasNotary = Boolean(options.homeManage);
	let hasGuildActions = false;

	for (const entry of entries) {
		const {reaction} = entry;
		if (reaction.type === GENERIC_REACTION_KINDS.REFUSE) {
			// Staying in a city is the server default. The mobile app keeps this state in the
			// background instead of exposing Discord's explicit "Rester en ville" button.
			continue;
		}
		const navigation = CITY_NAVIGATION_REACTIONS[reaction.type];
		if (navigation) {
			groups[navigation.group].push(navigation.view === "home"
				? homeNavigationItem(options.homeOwned)
				: navigationItem(navigation.view, navigation.key));
			continue;
		}
		if (reaction.type === CITY_REACTION_KINDS.EXIT) {
			groups.quit.push({kind: "reaction", entry});
			continue;
		}
		if (reaction.type === CITY_REACTION_KINDS.SHOP) {
			groups.shops.push({kind: "reaction", entry});
			continue;
		}
		if (reaction.type === CITY_REACTION_KINDS.INN_MEAL || reaction.type === CITY_REACTION_KINDS.INN_ROOM) {
			const innId = (reaction.data as {innId: string}).innId;
			inns.set(innId, [...(inns.get(innId) ?? []), entry]);
			continue;
		}
		if (reaction.type === CITY_REACTION_KINDS.ENCHANT) {
			submenus.enchanter.push(entry);
			continue;
		}
		const submenu = CITY_SUBMENU_REACTIONS[reaction.type];
		if (submenu) {
			submenus[submenu].push(entry);
			if (submenu === "notary") {
				hasNotary = true;
			}
			if (submenu === "guild") {
				hasGuildActions = true;
			}
			continue;
		}
		groups.services.push({kind: "reaction", entry});
	}

	if (hasNotary) {
		groups.housing.push(navigationItem("notary", "notary"));
	}
	if (hasGuildActions && !groups.guild.some(item => item.kind === "navigation" && item.view === "guild")) {
		groups.guild.push(navigationItem("guild", "guild-domain"));
	}
	for (const [innId, innEntries] of inns) {
		submenus.inn.push(...innEntries);
		groups.services.push(innNavigationItem(innId));
	}
	for (const innId of options.innIds ?? []) {
		if (!groups.services.some(item => item.kind === "navigation" && item.view === "inn" && item.innId === innId)) {
			groups.services.push(innNavigationItem(innId));
		}
	}
	if (submenus.enchanter.length > 0 || options.availableServices?.includes("enchanter")) {
		groups.services.push(navigationItem("enchanter", "enchanter"));
	}
	if (options.availableServices?.includes("bossArchivist")) {
		groups.services.push({
			kind: "info",
			key: "boss-archivist",
			iconPath: "city.services.bossArchivist",
			title: i18n.t("commands:report.city.bossArchivist.serviceTitle"),
			subtitle: compactCityDescription(i18n.t("commands:report.city.bossArchivist.serviceDescription"))
		});
	}
	for (const shop of options.shops ?? []) {
		if (shop.isEmpty) {
			groups.shops.push({
				kind: "info",
				key: `empty-shop-${shop.shopId}`,
				iconPath: `city.shops.${shop.shopId}`,
				title: i18n.t(`commands:report.city.shops.${shop.shopId}.label`),
				subtitle: compactCityDescription(i18n.t("commands:report.city.shopEmptyDescription"))
			});
		}
	}
	if (options.guildFoodShop) {
		groups.guild.push({
			kind: "info",
			key: "guild-food-shop",
			iconPath: "expedition.food",
			title: i18n.t("commands:report.city.guildFoodShop.label"),
			subtitle: i18n.t("commands:report.city.guildFoodShop.description", {guildName: options.guildFoodShop.guildName})
		});
	}
	for (const service of options.otherCityServices ?? []) {
		const locationName = (service.mapLocationIds ?? [service.mapLocationId])
			.map(mapLocationId => i18n.t(`models:map_locations.${mapLocationId}.name`))
			.join(" · ");
		const titleKey = service.kind === "shop"
			? `commands:report.city.shops.${service.serviceKey}.label`
			: service.serviceKey === "bossArchivist"
				? "commands:report.city.bossArchivist.serviceTitle"
				: `commands:report.city.${service.serviceKey}.menuLabel`;
		const descriptionKey = service.kind === "shop"
			? `commands:report.city.shops.${service.serviceKey}.description`
			: service.serviceKey === "bossArchivist"
				? "commands:report.city.bossArchivist.serviceDescription"
				: `commands:report.city.${service.serviceKey}.menuDescription`;
		groups.elsewhere.push({
			kind: "info",
			key: `${service.kind}-${service.mapLocationId}-${service.serviceKey}`,
			iconPath: service.kind === "shop" ? `city.shops.${service.serviceKey}` : `city.services.${service.serviceKey}`,
			title: i18n.t(titleKey),
			subtitle: `${locationName} · ${compactCityDescription(i18n.t(descriptionKey))}`
		});
	}
	if (options.homeOwned) {
		groups.housing = groups.housing.map(item => item.kind === "navigation" && item.view === "home"
			? {
				...item,
				iconPath: homeIconPath(options.homeOwned!.level),
				subtitle: i18n.t("app:city.subtitles.homeDetails", {
					level: options.homeOwned!.level,
					services: [
						options.homeOwned!.hasBed ? i18n.t("app:city.summary.bed") : null,
						options.homeOwned!.hasChest ? i18n.t("app:city.summary.chest") : null,
						options.homeOwned!.hasGarden ? i18n.t("app:city.summary.garden") : null,
						options.homeOwned!.hasCooking ? i18n.t("app:city.summary.cooking") : null,
						options.homeOwned!.hasUpgradeStation ? i18n.t("app:city.summary.forge") : null
					].filter(Boolean).join(", ")
				})
			} : item);
	}

	for (const group of Object.values(groups)) {
		group.sort(sortCityItems);
	}
	for (const submenu of Object.values(submenus)) {
		submenu.sort((left, right) => (CITY_REACTION_ORDER[left.reaction.type] ?? Number.MAX_SAFE_INTEGER) - (CITY_REACTION_ORDER[right.reaction.type] ?? Number.MAX_SAFE_INTEGER));
	}
	return {groups, submenus};
}

// @codescene(disable:"Complex Method")
function CityRows({items, collector, onChoose, onNavigate, locked}: {
	items: CityListItem[];
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	locked: boolean;
}): ReactNode {
	return items.map(item => {
		if (item.kind === "navigation") {
			return (
				<Row
					key={`${collector.id}-${item.key}`}
					disabled={locked}
					onPress={locked ? undefined : (): void => onNavigate(item)}
					icon={iconForPath(item.iconPath)}
					title={item.title}
					subtitle={item.subtitle}
					chevron={!locked}
				/>
			);
		}
		if (item.kind === "info") {
			return (
				<Row
					key={`${collector.id}-${item.key}`}
					disabled
					icon={iconForPath(item.iconPath)}
					title={item.title}
					subtitle={item.subtitle}
				/>
			);
		}

		const {reaction, index} = item.entry;
		const snapshot = collector.data.type === CITY_DATA_KINDS.CITY ? collector.data.data.snapshot : undefined;
		const itemSnapshot = itemSnapshotForReaction(snapshot, reaction);
		const choosable = isChoosable(reaction, collector.data) && cityReactionAvailable(reaction, snapshot);
		const disabled = locked || !choosable;
		return (
			<Row
				key={`${collector.id}-${index}`}
				disabled={disabled}
				onPress={disabled ? undefined : (): void => onChoose(index)}
				icon={cityRowIcon(reaction, snapshot)}
				title={cityRowTitle(reaction, collector.data, snapshot)}
				subtitle={renderCityRowSubtitle(reaction, snapshot, itemSnapshot)}
				end={renderCityRowEnd(reaction, snapshot, itemSnapshot)}
				tone={reaction.type === CITY_REACTION_KINDS.EXIT ? "danger" : undefined}
				chevron={choosable && !locked}
			/>
		);
	});
}

function CitySection({title, hint, items, collector, onChoose, onNavigate, locked, first = false}: {
	title: string;
	hint?: string;
	items: CityListItem[];
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	locked: boolean;
	first?: boolean;
}): ReactNode {
	if (items.length === 0) {
		return null;
	}
	return (
		<>
			<SectionHeader first={first} action={hint ? {hint} : undefined}>{title}</SectionHeader>
			<Panel><CityRows items={items} collector={collector} onChoose={onChoose} onNavigate={onNavigate} locked={locked} /></Panel>
		</>
	);
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
	const sections = submenuSections(view, entries, snapshot);
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
				/>
			))}
			{citySnapshotNote(view, snapshot)}
			{visibleSections.length === 0 ? <Note>{i18n.t("app:city.subtitles.noActions")}</Note> : null}
			<ButtonRow><Button disabled={locked} onPress={locked ? undefined : onBack}>{backLabel ?? i18n.t("app:city.actions.back")}</Button></ButtonRow>
		</Screen>
	);
}

// @codescene(disable:"Complex Method")
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
				/>
			))}
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
