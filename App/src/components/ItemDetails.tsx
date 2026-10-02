import {ReactNode} from "react";
import {View} from "react-native";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {givenStats, isMainItem, MAIN_ITEM_STATS, statValue, uncappedStatValue} from "@/src/components/InventoryItemRow";
import {StatDelta, StatLine} from "@/src/components/StatLine";
import {consumableDescription, natureUnit} from "@/src/display/ItemEffects";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type Line = {key: string; node: (last: boolean) => ReactNode};

/** The figures shown: those the item gives, and those the compared item gives, so a loss is not hidden. */
function shownStats(item: ItemWithDetails, reference?: ItemWithDetails): typeof MAIN_ITEM_STATS[number][] {
	if (!isMainItem(item)) return [];
	const compared = reference && isMainItem(reference) ? givenStats(reference) : [];
	const given = givenStats(item);
	return MAIN_ITEM_STATS.filter(stat => given.includes(stat) || compared.includes(stat));
}

function mainItemLines(item: ItemWithDetails, reference?: ItemWithDetails): Line[] {
	if (!isMainItem(item)) return [];
	const compared = reference && isMainItem(reference) ? reference : undefined;
	const lines: Line[] = shownStats(item, reference).map(stat => {
		const value = statValue(item[stat]);
		const full = uncappedStatValue(item[stat]);
		return {key: stat, node: (last): ReactNode => <StatLine
			unit={stat}
			label={i18n.t(`app:equipment.stats.${stat}`)}
			value={formatNumber(value)}
			{...full > value ? {capped: formatNumber(full)} : {}}
			last={last}
		>{compared ? <StatDelta value={value} reference={statValue(compared[stat])} /> : null}</StatLine>};
	});
	if (item.itemEnchantmentId) {
		lines.push({key: "enchantment", node: (last): ReactNode => <StatLine label={i18n.t("app:inventory.enchantment")} value={i18n.t(`items:enchantments.${item.itemEnchantmentId}`)} last={last} />});
	}
	return lines;
}

function supportItemLines(item: ItemWithDetails): Line[] {
	if (isMainItem(item)) return [];
	const unit = natureUnit(item.nature);
	const lines: Line[] = [{key: "effect", node: (last): ReactNode => <StatLine
		{...unit ? {unit} : {}}
		label={i18n.t("app:equipment.stats.effect")}
		value={consumableDescription(item)}
		last={last}
	/>}];
	if (item.maxUsages && item.maxUsages > 1) {
		const {maxUsages} = item;
		lines.push({key: "usages", node: (last): ReactNode => <StatLine
			label={i18n.t("app:inventory.remainingUsages")}
			value={i18n.t("app:inventory.usages", {usages: item.usages ?? maxUsages, max: maxUsages})}
			last={last}
		/>});
	}
	return lines;
}

/**
 * What an item gives, one line per figure, the same wherever an item is detailed. Given the item it
 * would replace, each figure also says what the swap wins or loses.
 */
export function ItemDetails({item, reference}: {item: ItemWithDetails; reference?: ItemWithDetails}): ReactNode {
	const lines = [...mainItemLines(item, reference), ...supportItemLines(item)];
	return <View testID="item-details">{lines.map((line, index) => <View key={line.key}>{line.node(index === lines.length - 1)}</View>)}</View>;
}
