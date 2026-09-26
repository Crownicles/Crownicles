import {ReactNode} from "react";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {MainItemStat} from "ws-packets/src/objects/MainItemStat";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {itemDisplayName, itemIconPath} from "@/src/collectors/CollectorLabels";
import {consumableDescription} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {EntryRow} from "@/src/design/Sections";

export function statValue(stat: MainItemStat): number {
	return Math.min(stat.baseValue + stat.upgradeValue, stat.maxValue);
}

export function isMainItem(item: ItemWithDetails): item is MainItem {
	return !("nature" in item);
}

function mainItemStats(item: MainItem): string {
	return [
		i18n.t("items:attack", {value: statValue(item.attack)}),
		i18n.t("items:defense", {value: statValue(item.defense)}),
		i18n.t("items:speed", {value: statValue(item.speed)})
	].join(" · ");
}

export function inventoryItemDetails(item: ItemWithDetails): string {
	const rarity = i18n.t(`items:raritiesWithoutEmote.${item.rarity}`);
	if ("nature" in item) return i18n.t("app:inventory.itemSummary", {rarity, details: consumableDescription(item)});
	const level = i18n.t("app:inventory.level", {level: item.itemLevel});
	const enchantment = item.itemEnchantmentId ? i18n.t(`items:enchantments.${item.itemEnchantmentId}`) : "";
	return i18n.t("app:inventory.itemSummary", {rarity, details: [level, mainItemStats(item), enchantment].filter(Boolean).join(" · ")});
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
