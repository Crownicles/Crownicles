import {ReactNode} from "react";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {MainItemStat} from "ws-packets/src/objects/MainItemStat";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {itemDisplayName, itemIconPath} from "@/src/collectors/CollectorLabels";
import {consumableEffect} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {joinFacts} from "@/src/display/Facts";
import {EntryRow} from "@/src/design/Sections";
import {formatNumber} from "@/src/display/Amounts";

export const MAIN_ITEM_STATS = ["attack", "defense", "speed"] as const;
export type MainItemStatName = typeof MAIN_ITEM_STATS[number];

/** What the stat is worth once the player's level caps it. */
export function statValue(stat: MainItemStat): number {
	return Math.min(stat.baseValue + stat.upgradeValue, stat.maxValue);
}

/** The full value, upgrades included, before the player's level caps it. */
export function uncappedStatValue(stat: MainItemStat): number {
	return stat.baseValue + stat.upgradeValue;
}

/** Like Discord, an item only shows the figures it gives. */
export function givenStats(item: MainItem): MainItemStatName[] {
	return MAIN_ITEM_STATS.filter(stat => item[stat].baseValue !== 0);
}

export function isMainItem(item: ItemWithDetails): item is MainItem {
	return !("nature" in item);
}

function mainItemStats(item: MainItem): string {
	return givenStats(item).map(stat => i18n.t("app:inventory.stat", {
		emoji: AppIcons.getIcon(`unitValues.${stat}`), value: formatNumber(statValue(item[stat]))
	})).join(" ");
}

/** Potions with several sips tell how many are left. */
function remainingUsages(item: SupportItem): string | null {
	if (!item.maxUsages || item.maxUsages <= 1) return null;
	return i18n.t("app:inventory.usages", {usages: item.usages ?? item.maxUsages, max: item.maxUsages});
}

/** One line saying what an item is, in the order Discord writes it, the same wherever an item is listed. */
export function inventoryItemDetails(item: ItemWithDetails): string {
	const rarity = i18n.t(`items:rarities.${item.rarity}`);
	if (!isMainItem(item)) return joinFacts([rarity, consumableEffect(item), remainingUsages(item)]);
	return joinFacts([
		rarity,
		item.itemLevel > 0 ? i18n.t("app:inventory.level", {level: item.itemLevel}) : null,
		mainItemStats(item),
		item.itemEnchantmentId ? i18n.t(`items:enchantments.${item.itemEnchantmentId}`) : null
	]);
}

export function inventoryItemEmblem(item: ItemWithDetails): ReactNode {
	const path = itemIconPath(item);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : undefined;
}

export function InventoryItemRow({item, location, onPress, disabled}: {item: ItemWithDetails; location?: string; onPress?: () => void; disabled?: boolean}): ReactNode {
	if (item.id === 0) return <EntryRow title={i18n.t("app:profile.inventory.emptySlot")} {...location === undefined ? {} : {end: location}} />;
	return <EntryRow
		emblem={inventoryItemEmblem(item)}
		title={itemDisplayName(item)}
		subtitle={inventoryItemDetails(item)}
		end={location}
		onPress={onPress}
		disabled={disabled}
	/>;
}
