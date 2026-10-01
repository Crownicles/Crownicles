import {ReactNode} from "react";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {isMainItem, MAIN_ITEM_STATS, statValue} from "@/src/components/InventoryItemRow";
import {consumableDescription} from "@/src/display/ItemEffects";
import {formatNumber} from "@/src/display/Amounts";
import {Fact, Figures} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

export function ItemDetails({item}: {item: ItemWithDetails}): ReactNode {
	if (isMainItem(item)) return <>
		<Figures items={MAIN_ITEM_STATS.map(stat => ({
			caption: i18n.t(`app:equipment.stats.${stat}`),
			value: formatNumber(statValue(item[stat])),
			unit: stat
		}))} />
		{item.itemEnchantmentId ? <Fact label={i18n.t("app:inventory.enchantment")} value={i18n.t(`items:enchantments.${item.itemEnchantmentId}`)} /> : null}
	</>;
	return <>
		<Fact label={i18n.t("app:equipment.stats.effect")} value={consumableDescription(item)} />
		{item.maxUsages && item.maxUsages > 1 ? <Fact
			label={i18n.t("app:inventory.remainingUsages")}
			value={i18n.t("app:inventory.usages", {usages: item.usages ?? item.maxUsages, max: item.maxUsages})}
		/> : null}
	</>;
}