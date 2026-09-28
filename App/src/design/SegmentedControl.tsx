import {ReactNode} from "react";
import {Pressable, Text, View} from "react-native";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";

/** A segment may wear the game emoji of what it shows, the way Discord labels its own sections. */
export type Segment<Value extends string> = {value: Value; label: string; icon?: string};

const useStyles = createStyles(colors => ({
	container: {flexDirection: "row", padding: Theme.spacing.xs, gap: Theme.spacing.xs, backgroundColor: colors.line, borderRadius: Theme.radius, marginVertical: Theme.spacing.md},
	segment: {flex: 1, minWidth: 0, minHeight: Theme.dimensions.itemMinHeight / 2, paddingHorizontal: Theme.spacing.xs, paddingVertical: Theme.spacing.sm, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: Theme.spacing.sm},
	selected: {backgroundColor: colors.paper},
	label: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.muted, textAlign: "center", letterSpacing: 0},
	selectedLabel: {color: colors.ink}
}));

const SEGMENT_ICON_SIZE = 18;

export function SegmentedControl<Value extends string>({options, value, onChange, label}: {
	options: readonly Segment<Value>[];
	value: Value;
	onChange: (value: Value) => void;
	label: string;
}): ReactNode {
	const styles = useStyles();
	return <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.container}>
		{options.map(option => <Pressable
			key={option.value}
			accessibilityRole="tab"
			accessibilityState={{selected: option.value === value}}
			style={[styles.segment, option.value === value && styles.selected]}
			onPress={(): void => onChange(option.value)}
		>
			{option.icon ? <TwemojiIcon emoji={option.icon} size={SEGMENT_ICON_SIZE} /> : null}
			<Text style={[styles.label, option.value === value && styles.selectedLabel]}>{option.label}</Text>
		</Pressable>)}
	</View>;
}
