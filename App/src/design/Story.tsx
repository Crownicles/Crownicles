import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {storySpans} from "@/src/display/Markdown";
import {twemojiParts} from "@/src/design/TwemojiText";
import {Theme} from "@/src/design/Theme";

/**
 * A piece of the game's own prose.
 *
 * Event texts are written once, for every front end: they carry Discord emphasis and game emojis.
 * Rendering them as a plain string leaves the asterisks visible and the emojis drawn by the system
 * instead of the game's own set, so both are unpacked here.
 */
const styles = StyleSheet.create({
	story: {flexDirection: "row", flexWrap: "wrap", alignItems: "center"},
	text: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.story,
		lineHeight: Theme.lineHeight.story,
		color: Theme.colors.ink
	},
	strong: {fontFamily: Theme.fonts.bold},
	emphasis: {fontStyle: "italic"}
});

export function Story({children}: {children: string}): ReactNode {
	return <View style={styles.story}>{storySpans(children).flatMap(span => twemojiParts({
		text: span.text,
		textStyle: [styles.text, span.strong && styles.strong, span.emphasis && styles.emphasis],
		emojiSize: Theme.fontSize.story,
		keyPrefix: `${span.id}-`
	}))}</View>;
}
