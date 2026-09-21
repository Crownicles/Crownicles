import {ReactNode} from "react";
import {StyleProp, StyleSheet, Text, TextStyle, View} from "react-native";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {storySpans} from "@/src/display/Markdown";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const styles = StyleSheet.create({
	strong: {fontFamily: Theme.fonts.bold, color: Theme.colors.ink},
	emphasis: {fontStyle: "italic"},
	code: {fontFamily: Theme.fonts.semiBold, backgroundColor: Theme.colors.wash, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	chips: {flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8},
	chip: {flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: Theme.colors.wash},
	chipText: {fontFamily: Theme.fonts.semiBold, fontSize: 12, lineHeight: 16, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	dot: {width: 6, height: 6, borderRadius: 3}
});

const CHIP_TONES: Readonly<Record<string, string>> = {
	damage: Theme.colors.red, gain: Theme.colors.green, breath: Theme.colors.blue, neutral: Theme.colors.ink
};

export function FightNarrative({children, style}: {children: string; style?: StyleProp<TextStyle>}): ReactNode {
	return <Text style={style}>{storySpans(children).map(span => <Text key={span.id} style={[span.strong && styles.strong, span.emphasis && styles.emphasis, span.code && styles.code]}>{span.text}</Text>)}</Text>;
}

export type FightEffectTone = keyof typeof CHIP_TONES;

/**
 * Numeric outcomes read better as chips than as inline code: a nested `Text` cannot carry padding
 * in React Native, so the markdown rendering is unpacked into a real container here.
 */
export function FightEffectChips({effects}: {effects: {id: string; tone: FightEffectTone; text: string; iconPath?: string}[]}): ReactNode {
	if (!effects.length) return null;
	return <View style={styles.chips}>
		{effects.map(effect => {
			const icon = effect.iconPath ? AppIcons.getIconOrNull(effect.iconPath) : null;
			return <View key={effect.id} style={styles.chip}>
				{icon ? <TwemojiIcon emoji={icon} size={13} /> : <View style={[styles.dot, {backgroundColor: CHIP_TONES[effect.tone]}]} />}
				<Text style={[styles.chipText, {color: CHIP_TONES[effect.tone]}]}>{storySpans(effect.text).map(span => span.text).join("")}</Text>
			</View>;
		})}
	</View>;
}