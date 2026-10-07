import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {UnitIcon} from "@/src/components/UnitIcon";
import {formatSignedNumber} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {TwemojiText} from "@/src/design/TwemojiText";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const DELTA_WIDTH = 52;
const VALUE_WIDTH = 64;
const COLUMN_EMOJI_SIZE = 20;

const useStyles = createStyles(colors => ({
	line: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingVertical: Theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line},
	last: {borderBottomWidth: 0},
	label: {flex: 1, minWidth: 0, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.rowSubtitle, color: colors.muted},
	valueBox: {flexShrink: 1, flexDirection: "row", alignItems: "baseline", gap: Theme.spacing.xs},
	column: {width: VALUE_WIDTH, flexShrink: 0, justifyContent: "flex-end"},
	value: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: colors.ink, fontVariant: ["tabular-nums"], textAlign: "right"},
	compared: {width: VALUE_WIDTH, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.rowTitle, color: colors.muted, fontVariant: ["tabular-nums"], textAlign: "right"},
	capped: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: colors.faint, textDecorationLine: "line-through", fontVariant: ["tabular-nums"]},
	delta: {width: DELTA_WIDTH, textAlign: "right", fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, color: colors.faint, fontVariant: ["tabular-nums"]},
	gain: {color: colors.green},
	loss: {color: colors.red},
	columns: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingBottom: Theme.spacing.xs},
	columnsLabel: {flex: 1},
	columnHead: {width: VALUE_WIDTH, alignItems: "flex-end"},
	deltaHead: {width: DELTA_WIDTH}
}));

/** One column per item compared: its emoji heads the column of its values, the gap column stays unnamed. */
export type StatColumn = {emoji: string | null; name: string};

function StatColumnHead({column}: {column: StatColumn}): ReactNode {
	const styles = useStyles();
	return <View style={styles.columnHead} accessible accessibilityLabel={column.name}>
		{column.emoji ? <TwemojiIcon emoji={column.emoji} size={COLUMN_EMOJI_SIZE} /> : <Text style={styles.label} numberOfLines={1}>{column.name}</Text>}
	</View>;
}

export function StatColumns({compared, shown}: {compared: StatColumn; shown: StatColumn}): ReactNode {
	const styles = useStyles();
	return <View style={styles.columns}>
		<View style={styles.columnsLabel} />
		<StatColumnHead column={compared} />
		<StatColumnHead column={shown} />
		<View style={styles.deltaHead} />
	</View>;
}

/** How far a value stands from the one it is compared with, coloured by whether it would be a gain. */
export function StatDelta({value, reference}: {value: number; reference: number}): ReactNode {
	const styles = useStyles();
	const delta = value - reference;
	return <Text style={[styles.delta, delta > 0 && styles.gain, delta < 0 && styles.loss]}>{delta === 0 ? "" : formatSignedNumber(delta)}</Text>;
}

/**
 * One figure on its own line: the game emoji of its unit, its name, its value. A value the player's
 * level holds back shows the struck-out full value before it, as Discord does.
 */
export function StatLine({unit, label, value, capped, compared, last = false, children}: {
	unit?: string;
	label: string;
	value: string;
	capped?: string;

	/** The same figure on the item compared with, in its own column before the value. */
	compared?: string;
	last?: boolean;

	/** Drawn after the value: a gap to a compared item or class. */
	children?: ReactNode;
}): ReactNode {
	const styles = useStyles();
	return <View style={[styles.line, last && styles.last]}>
		{unit ? <UnitIcon unit={unit} size={15} /> : null}
		<Text style={styles.label} numberOfLines={1}>{label}</Text>
		{compared === undefined ? null : <Text style={styles.compared}>{compared}</Text>}
		<View style={[styles.valueBox, compared !== undefined && styles.column]}>
			{capped ? <Text style={styles.capped}>{capped}</Text> : null}
			<TwemojiText textStyle={styles.value} emojiSize={Theme.fontSize.rowTitle}>{value}</TwemojiText>
		</View>
		{children}
	</View>;
}
