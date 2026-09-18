import {ReactNode} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {Theme} from "@/src/design/Theme";

export type Segment<Value extends string> = {value: Value; label: string};

const styles = StyleSheet.create({
	container: {flexDirection: "row", padding: Theme.spacing.xs, gap: Theme.spacing.xs, backgroundColor: Theme.colors.line, borderRadius: Theme.radius, marginVertical: Theme.spacing.md},
	segment: {flex: 1, minWidth: 0, minHeight: Theme.dimensions.itemMinHeight / 2, paddingHorizontal: Theme.spacing.xs, paddingVertical: Theme.spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: Theme.spacing.sm},
	selected: {backgroundColor: Theme.colors.paper},
	label: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.muted, textAlign: "center", letterSpacing: 0},
	selectedLabel: {color: Theme.colors.ink}
});

export function SegmentedControl<Value extends string>({options, value, onChange, label}: {
	options: readonly Segment<Value>[];
	value: Value;
	onChange: (value: Value) => void;
	label: string;
}): ReactNode {
	return <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.container}>
		{options.map(option => <Pressable
			key={option.value}
			accessibilityRole="tab"
			accessibilityState={{selected: option.value === value}}
			style={[styles.segment, option.value === value && styles.selected]}
			onPress={(): void => onChange(option.value)}
		><Text style={[styles.label, option.value === value && styles.selectedLabel]}>{option.label}</Text></Pressable>)}
	</View>;
}
