import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import type {CityListItem} from "@/src/collectors/CityCollector";
import {i18n} from "@/src/translations/i18n";

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
export function guildFeatureItems(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const guild = snapshot?.guildDomain;
	if (!guild) return [];
	const building = (key: "shop" | "shelter" | "pantry" | "trainingGround", level: number, subtitle: string): CityListItem => ({kind: "info", key: `guild-${key}`, iconPath: `city.guildDomain.${key === "trainingGround" ? "trainingGround" : key}`, title: i18n.t("app:city.summary.buildingLevel", {building: i18n.t(`commands:report.city.guildDomain.buildings.${key}`), level}), subtitle});
	return [
		building("shop", guild.shopLevel, guild.shopLevel > 0 ? i18n.t("commands:report.city.guildDomain.buildingSummary.shop.built") : i18n.t("commands:report.city.guildDomain.buildingSummary.shop.locked")),
		building("shelter", guild.shelterLevel, i18n.t("commands:report.city.guildDomain.buildingSummary.shelter", {slots: guild.shelterMaxCount})),
		building("pantry", guild.pantryLevel, i18n.t("commands:report.city.guildDomain.buildingSummary.pantry")),
		building("trainingGround", guild.trainingGroundLevel, i18n.t(guild.trainingGroundLevel > 0 ? "commands:report.city.guildDomain.buildingSummary.trainingGround.active" : "commands:report.city.guildDomain.buildingSummary.trainingGround.inactive", {love: 1}))
	];
}

const ENCHANTMENT_CATALOG = [
	{key: "attack", iconPath: "enchantmentTypes.damage", titleKey: "app:city.enchantmentCatalog.attack", subtitleKey: "app:city.enchantmentCatalog.attackDetails"},
	{key: "pvp-pve-attack", iconPath: "enchantmentTypes.damage", titleKey: "app:city.enchantmentCatalog.pvpPveAttack", subtitleKey: "app:city.enchantmentCatalog.pvpPveAttackDetails"},
	{key: "defense", iconPath: "enchantmentTypes.defense", titleKey: "app:city.enchantmentCatalog.defense", subtitleKey: "app:city.enchantmentCatalog.defenseDetails"},
	{key: "speed", iconPath: "enchantmentTypes.speed", titleKey: "app:city.enchantmentCatalog.speed", subtitleKey: "app:city.enchantmentCatalog.speedDetails"},
	{key: "energy", iconPath: "enchantmentTypes.health", titleKey: "app:city.enchantmentCatalog.energy", subtitleKey: "app:city.enchantmentCatalog.energyDetails"},
	{key: "breath", iconPath: "enchantmentTypes.other", titleKey: "app:city.enchantmentCatalog.breath", subtitleKey: "app:city.enchantmentCatalog.breathDetails"},
	{key: "elemental", iconPath: "enchantmentTypes.magic", titleKey: "app:city.enchantmentCatalog.elemental", subtitleKey: "app:city.enchantmentCatalog.elementalDetails"}
];

export function enchantmentCatalogItems(): CityListItem[] {
	return ENCHANTMENT_CATALOG.map(entry => ({kind: "info" as const, key: `enchantment-${entry.key}`, iconPath: entry.iconPath, title: i18n.t(entry.titleKey), subtitle: i18n.t(entry.subtitleKey)}));
}
