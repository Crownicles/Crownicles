import type {CityListItem} from "@/src/collectors/CityCollector";
import {i18n} from "@/src/translations/i18n";

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
