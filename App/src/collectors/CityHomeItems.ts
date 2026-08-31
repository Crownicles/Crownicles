import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import type {CityListItem} from "@/src/collectors/CityCollector";
import {i18n} from "@/src/translations/i18n";

export function homeIconPath(level: number | undefined): string {
	const safeLevel = Math.max(1, Math.min(8, level ?? 5));
	return `city.home.${safeLevel}`;
}

type OwnedHome = NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>;

function bedItem(home: OwnedHome): CityListItem {
	return {kind: "navigation", key: "home-bed", view: "homeBed", iconPath: "city.homeUpgrades.bed", title: i18n.t("app:city.labels.bed"), subtitle: i18n.t("commands:report.city.homes.bed.menuDescription", {health: home.bedHealthRegeneration})};
}

function chestItem(home: OwnedHome): CityListItem {
	const stored = home.chestItemCount === undefined ? "" : ` · ${i18n.t("items:object", {count: home.chestItemCount})}`;
	return {kind: "navigation", key: "home-chest", view: "homeChest", iconPath: "city.homeUpgrades.chest", title: i18n.t("commands:report.city.homes.chest.menuLabel"), subtitle: `${i18n.t("commands:report.city.homes.chest.menuDescription")}${stored}`};
}

function gardenItem(home: OwnedHome): CityListItem {
	return {kind: "navigation", key: "home-garden", view: "homeGarden", iconPath: "city.homeUpgrades.garden", title: i18n.t("app:city.labels.garden"), subtitle: i18n.t("commands:report.city.homes.garden.menuDescription", {ready: home.gardenReadyPlots ?? 0, total: home.gardenTotalPlots ?? home.gardenPlots})};
}

function cookingItem(home: OwnedHome): CityListItem {
	return {kind: "navigation", key: "home-cooking", view: "homeCooking", iconPath: "city.homeUpgrades.cooking", title: i18n.t("app:city.labels.cooking"), subtitle: i18n.t("app:city.subtitles.cooking", {level: home.cookingLevel ?? 0})};
}

function upgradeStationItem(): CityListItem {
	return {kind: "navigation", key: "home-upgrade-station", view: "homeUpgrade", iconPath: "city.homeUpgrades.upgradeEquipment", title: i18n.t("commands:report.city.homes.upgradeStation.menuLabel"), subtitle: i18n.t("commands:report.city.homes.upgradeStation.menuDescription")};
}

function notaryItem(): CityListItem {
	return {kind: "navigation", key: "home-notary", view: "notary", iconPath: "city.manageHome", title: i18n.t("app:city.labels.manageHome"), subtitle: i18n.t("app:city.subtitles.notary")};
}

type HomeFeatureBuilder = (home: OwnedHome, snapshot: CityMobileSnapshot) => CityListItem | undefined;

const HOME_FEATURE_BUILDERS: HomeFeatureBuilder[] = [
	(home => home.hasBed ? bedItem(home) : undefined),
	(home => home.hasChest ? chestItem(home) : undefined),
	(home => home.hasGarden ? gardenItem(home) : undefined),
	(home => home.hasCooking ? cookingItem(home) : undefined),
	(home => home.hasUpgradeStation ? upgradeStationItem() : undefined),
	((_, snapshot) => snapshot.home?.manage ? notaryItem() : undefined)
];

export function homeFeatureItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const home = snapshot?.home?.owned;
	if (!home) return [];
	return HOME_FEATURE_BUILDERS.map(builder => builder(home, snapshot)).filter((item): item is CityListItem => item !== undefined);
}

export function gardenPlotItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const garden = snapshot?.home?.owned?.garden;
	if (!garden) return [];
	return garden.plots.map(plot => plot.plantId === 0
		? {kind: "info" as const, key: `garden-plot-${plot.slot}`, iconPath: "city.gardenStatus.empty", title: i18n.t("app:city.garden.plot", {slot: plot.slot + 1}), subtitle: i18n.t("app:city.garden.empty")}
		: {kind: "info" as const, key: `garden-plot-${plot.slot}`, iconPath: `plants.${plot.plantId}`, title: i18n.t("app:city.garden.plotPlant", {slot: plot.slot + 1, plant: i18n.t(`models:plants.${plot.plantId}`)}), subtitle: plot.isReady ? i18n.t("app:city.garden.ready") : i18n.t("app:city.garden.growing", {progress: Math.round(plot.growthProgress * 100)})});
}

export function homeChestItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const home = snapshot?.home?.owned;
	if (!home) return [];
	return [
		{kind: "info", key: "home-chest-stored", iconPath: "city.homeUpgrades.chest", title: i18n.t("app:city.chest.stored"), subtitle: i18n.t("app:city.chest.storedDetails", {count: home.chestItemCount ?? 0})},
		{kind: "info", key: "home-chest-depositable", iconPath: "city.chestActions.inventory", title: i18n.t("app:city.chest.depositable"), subtitle: i18n.t("app:city.chest.depositableDetails", {count: home.depositableItemCount ?? 0})}
	];
}

export function homeCookingItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const home = snapshot?.home?.owned;
	if (!home) return [];
	return [
		{kind: "info", key: "home-cooking-level", iconPath: "city.homeUpgrades.cooking", title: i18n.t("app:city.labels.cooking"), subtitle: i18n.t("app:city.subtitles.cooking", {level: home.cookingLevel ?? 0})},
		{kind: "info", key: "home-cooking-slots", iconPath: "city.homeUpgrades.cooking", title: i18n.t("app:city.summary.cookingSlots"), subtitle: i18n.t("app:city.summary.cookingSlotsDetails", {count: home.cookingSlots ?? 0})}
	];
}
