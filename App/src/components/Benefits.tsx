import {ReactNode} from "react";
import {Text, View} from "react-native";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

/** One thing a purchase brings, drawn with the game emoji of what it is. */
export type Benefit = {key: string; iconPath: string; title: string; description: string};

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

function BenefitRow({benefit}: {benefit: Benefit}): ReactNode {
	const styles = useStyles();
	const emoji = AppIcons.getIconOrNull(benefit.iconPath);
	return <View style={styles.row} testID="benefit">
		<View style={styles.tile}>{emoji ? <TwemojiIcon emoji={emoji} size={TILE_EMOJI_SIZE} /> : null}</View>
		<View style={styles.body}>
			<Text style={styles.title}>{benefit.title}</Text>
			<Text style={styles.description}>{benefit.description}</Text>
		</View>
	</View>;
}

/** What the player gets, one emoji tile per gain, so it is seen at a glance rather than read. */
export function Benefits({items}: {items: Benefit[]}): ReactNode {
	const styles = useStyles();
	return <View style={styles.list}>{items.map(benefit => <BenefitRow key={benefit.key} benefit={benefit} />)}</View>;
}
