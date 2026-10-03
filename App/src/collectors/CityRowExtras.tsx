import {ReactNode} from "react";
import {Text, View} from "react-native";
import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {HOME_UPGRADE_CHANGES, HomeUpgradeChange} from "ws-packets/src/objects/HomeUpgrade";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const UPGRADE_CHANGE_ICONS: Record<HomeUpgradeChange, string> = {
	[HOME_UPGRADE_CHANGES.CHEST]: "city.homeUpgrades.chest",
	[HOME_UPGRADE_CHANGES.BIGGER_CHEST]: "city.homeUpgrades.chest",
	[HOME_UPGRADE_CHANGES.INVENTORY_BONUS]: "city.homeUpgrades.chest",
	[HOME_UPGRADE_CHANGES.UPGRADE_ITEM_STATION]: "city.homeUpgrades.upgradeEquipment",
	[HOME_UPGRADE_CHANGES.BETTER_UPGRADE_ITEM_STATION]: "city.homeUpgrades.upgradeEquipment",
	[HOME_UPGRADE_CHANGES.BETTER_BED]: "city.homeUpgrades.bed",
	[HOME_UPGRADE_CHANGES.GARDEN]: "city.homeUpgrades.garden",
	[HOME_UPGRADE_CHANGES.BIGGER_GARDEN]: "city.homeUpgrades.garden",
	[HOME_UPGRADE_CHANGES.BETTER_GARDEN_EARTH]: "city.homeUpgrades.earthQuality",
	[HOME_UPGRADE_CHANGES.COOKING_STATION]: "city.homeUpgrades.cooking",
	[HOME_UPGRADE_CHANGES.BETTER_COOKING_STATION]: "city.homeUpgrades.cooking"
};

const TILE_SIZE = 40;
const TILE_EMOJI_SIZE = 22;

const useStyles = createStyles(colors => ({
	list: {gap: Theme.spacing.md},
	row: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	tile: {width: TILE_SIZE, height: TILE_SIZE, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: Theme.radius, backgroundColor: colors.wash},
	body: {flex: 1, minWidth: 0, gap: 2},
	title: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.ink},
	description: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted}
}));

function UpgradeChangeRow({change}: {change: HomeUpgradeChange}): ReactNode {
	const styles = useStyles();
	const emoji = AppIcons.getIconOrNull(UPGRADE_CHANGE_ICONS[change]);
	return <View style={styles.row} testID="home-upgrade-change">
		<View style={styles.tile}>{emoji ? <TwemojiIcon emoji={emoji} size={TILE_EMOJI_SIZE} /> : null}</View>
		<View style={styles.body}>
			<Text style={styles.title}>{i18n.t(`app:city.upgradeChanges.${change}.title`)}</Text>
			<Text style={styles.description}>{i18n.t(`app:city.upgradeChanges.${change}.description`)}</Text>
		</View>
	</View>;
}

function UpgradeChanges({changes}: {changes: HomeUpgradeChange[]}): ReactNode {
	const styles = useStyles();
	return <View style={styles.list}>{changes.map(change => <UpgradeChangeRow key={change} change={change} />)}</View>;
}

/** What the player weighs before confirming: every advantage a home upgrade brings. */
export function cityRowDetails(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): ReactNode {
	const changes = reaction.type === CITY_REACTION_KINDS.UPGRADE_HOME ? snapshot?.home?.manage?.upgradeChanges ?? [] : [];
	return changes.length > 0 ? <UpgradeChanges changes={changes} /> : null;
}
