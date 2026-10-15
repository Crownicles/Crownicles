import { ReactNode } from "react";
import { Animated } from "react-native";
import {
	CITY_BLACKSMITH_LIMITS, CITY_STATION_LIMITS, CityMobileBeyondReachItem, CityMobileItem, CityMobileStationBeyondReachItem
} from "ws-packets/src/fromServer/collectors";
import { AppIcons } from "@/src/AppIcons";
import { cityItemIconPath } from "@/src/collectors/CityItemPresentation";
import {
	FarewellEmblem, FarewellPage, FarewellSparkles, useMotionLoop
} from "@/src/design/Farewell";
import { useColors } from "@/src/design/ThemeContext";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { i18n } from "@/src/translations/i18n";

const FLOAT_MOTION = {
	periodMs: 1800, rise: -6, item: 56
} as const;

/** The item hovers over a warm halo, sparkles around it: it is not refused for nothing, the craftsman says why. */
function FloatingItem({ item }: { item: CityMobileItem }): ReactNode {
	const colors = useColors();
	const float = useMotionLoop(FLOAT_MOTION.periodMs, true);
	const emoji = AppIcons.getIconOrNull(cityItemIconPath(item));
	return <FarewellEmblem pulse={float} haloColor={colors.goldWash}>
		<FarewellSparkles />
		<Animated.View style={{ transform: [
			{ translateY: float.interpolate({
				inputRange: [0, 1], outputRange: [0, FLOAT_MOTION.rise]
			}) }
		] }}>
			{emoji ? <TwemojiIcon emoji={emoji} size={FLOAT_MOTION.item} /> : null}
		</Animated.View>
	</FarewellEmblem>;
}

/** A craftsman handing an item back, told on a page: what stops them and what the player can do. */
function ItemStory({
	item, storyKey, params = {}
}: {
	item: CityMobileItem; storyKey: string; params?: Record<string, string | number>;
}): ReactNode {
	const colors = useColors();
	return <FarewellPage
		emblem={<FloatingItem item={item} />}
		eyebrow={i18n.t(`${storyKey}.eyebrow`, params)}
		eyebrowColor={colors.gold}
		title={i18n.t(`${storyKey}.title`)}
		description={i18n.t(`${storyKey}.description`, params)}
	/>;
}

/** Why the blacksmith hands an item back: the royal blacksmith alone can go further, or no one can. */
export function BeyondReachStory({ item }: { item: CityMobileBeyondReachItem }): ReactNode {
	const story = item.limit === CITY_BLACKSMITH_LIMITS.ROYAL_ONLY ? "royalOnlyStory" : "maxedStory";
	return <ItemStory item={item} storyKey={`app:city.anvil.${story}`} params={{
		level: item.itemLevel, nextLevel: item.itemLevel + 1
	}} />;
}

/** Why the scrap dealer will not touch an enchanted item: dismantling it would destroy the enchantment. */
export function EnchantedStory({ item }: { item: CityMobileItem }): ReactNode {
	return <ItemStory item={item} storyKey="app:city.scrap.enchantedStory" />;
}

/** Why the home's station hands an item back: the home is too small for it, or nothing can improve it anymore. */
export function StationLimitStory({
	item, station
}: {
	item: CityMobileStationBeyondReachItem;
	station: {
		maxItemLevel: number; maxRarity: number;
	};
}): ReactNode {
	if (item.limit === CITY_STATION_LIMITS.MAXED) {
		return <ItemStory item={item} storyKey="app:city.anvil.maxedStory" />;
	}
	return <ItemStory item={item} storyKey={`app:city.station.${item.limit}Story`} params={{
		level: item.itemLevel, max: station.maxItemLevel, rarity: i18n.t(`items:raritiesWithoutEmote.${station.maxRarity}`)
	}} />;
}
