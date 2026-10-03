import {ReactNode} from "react";
import {View} from "react-native";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {MainItem} from "ws-packets/src/objects/MainItem";
import {givenStats, isMainItem, itemEmoji, MAIN_ITEM_STATS, MainItemStatName, statValue, uncappedStatValue} from "@/src/components/InventoryItemRow";
import {StatColumns, StatDelta, StatLine} from "@/src/components/StatLine";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

/** The figures shown: those the item gives, and those the compared item gives, so a loss is not hidden. */
function shownStats(item: MainItem, reference?: MainItem): MainItemStatName[] {
	const given = givenStats(item);
	const compared = reference ? givenStats(reference) : [];
	return MAIN_ITEM_STATS.filter(stat => given.includes(stat) || compared.includes(stat));
}

function isCapped(item: MainItem): boolean {
	return MAIN_ITEM_STATS.some(stat => uncappedStatValue(item[stat]) > statValue(item[stat]));
}

function comparable(reference?: ItemWithDetails): MainItem | undefined {
	return reference && isMainItem(reference) ? reference : undefined;
}

function ItemStatLine({item, compared, stat, last}: {item: MainItem; compared?: MainItem; stat: MainItemStatName; last: boolean}): ReactNode {
	const value = statValue(item[stat]);
	const full = uncappedStatValue(item[stat]);
	return <StatLine
		unit={stat}
		label={i18n.t(`app:equipment.stats.${stat}`)}
		value={formatNumber(value)}
		{...full > value ? {capped: formatNumber(full)} : {}}
		{...compared ? {compared: formatNumber(statValue(compared[stat]))} : {}}
		last={last}
	>{compared ? <StatDelta value={value} reference={statValue(compared[stat])} /> : null}</StatLine>;
}

/**
 * What the one-line caption of an item cannot say: what a swap wins or loses on each figure, and the
 * full value the player's level holds back. Anything else is already in the caption, so nothing is drawn.
 */
export function ItemDetails({item, reference}: {item: ItemWithDetails; reference?: ItemWithDetails}): ReactNode {
	if (!isMainItem(item)) return null;
	const compared = comparable(reference);
	if (!compared && !isCapped(item)) return null;
	const stats = shownStats(item, compared);
	return <View testID="item-details">
		{compared ? <StatColumns
			compared={{emoji: itemEmoji(compared), name: itemDisplayName(compared)}}
			shown={{emoji: itemEmoji(item), name: itemDisplayName(item)}}
		/> : null}
		{stats.map((stat, index) => <ItemStatLine key={stat} item={item} compared={compared} stat={stat} last={index === stats.length - 1} />)}
	</View>;
}
