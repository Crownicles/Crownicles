import { createElement } from "react";
import {
	CITY_STATION_LIMITS, CityMobileSnapshot, CityMobileStationBeyondReachItem
} from "ws-packets/src/fromServer/collectors";
import type { CityListItem } from "@/src/collectors/CityCollector";
import {
	cityItemIconPath, cityItemName
} from "@/src/collectors/CityItemPresentation";
import { StationLimitStory } from "@/src/collectors/CityItemStories";
import {
	Gem, House, Trophy
} from "@/src/design/FightIcons";
import { i18n } from "@/src/translations/i18n";

type Station = NonNullable<NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>["upgradeStation"]>;

const LIMIT_ICONS = {
	[CITY_STATION_LIMITS.HOME_LEVEL]: House,
	[CITY_STATION_LIMITS.RARITY]: Gem,
	[CITY_STATION_LIMITS.MAXED]: Trophy
} as const;

function limitReason(item: CityMobileStationBeyondReachItem, station: Station): string {
	return item.limit === CITY_STATION_LIMITS.MAXED
		? i18n.t("app:city.anvil.maxed")
		: i18n.t(`app:city.station.${item.limit}`, { max: station.maxItemLevel });
}

function beyondReachRow(item: CityMobileStationBeyondReachItem, station: Station): CityListItem {
	return {
		kind: "info",
		key: `station-beyond-reach-${item.itemCategory}-${item.slot}`,
		iconPath: cityItemIconPath(item),
		title: cityItemName(item),
		subtitle: i18n.t("app:city.anvil.itemLevel", { level: item.itemLevel }),
		lock: {
			reason: limitReason(item, station), icon: LIMIT_ICONS[item.limit]
		},
		details: createElement(StationLimitStory, {
			item, station
		})
	};
}

/** What the home's station hands back, each with why, or a bench left empty; older servers do not say. */
export function stationRefusals(snapshot: CityMobileSnapshot | undefined): CityListItem[] {
	const station = snapshot?.home?.owned?.upgradeStation;
	if (!station) {
		return [];
	}
	const refused = station.beyondReachItems.map(item => beyondReachRow(item, station));
	if (refused.length > 0 || station.upgradeableItems.length > 0) {
		return refused;
	}
	return [
		{
			kind: "info",
			key: "station-empty",
			iconPath: "city.homeUpgrades.upgradeEquipment",
			title: i18n.t("app:city.station.empty"),
			subtitle: i18n.t("app:city.anvil.nothingHeld"),
			lock: { reason: i18n.t("app:city.station.nothingHeld") }
		}
	];
}
