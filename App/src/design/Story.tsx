import { ReactNode } from "react";
import {
	Linking, StyleProp, Text, TextStyle
} from "react-native";
import {
	StorySpan, storySpans
} from "@/src/display/Markdown";
import {
	InlineEmoji, inlineEmoji, twemojiParts
} from "@/src/design/TwemojiText";
import { Theme } from "@/src/design/Theme";
import { createStyles } from "@/src/design/ThemeContext";

/**
 * A piece of the game's own prose.
 *
 * Event texts are written once, for every front end: they carry Discord emphasis, links, line breaks
 * and game emojis. Everything is laid out inside a single text so words, emojis and bold wrap together
 * like a paragraph, instead of each piece becoming a block of its own.
 */
const useStyles = createStyles(colors => ({
	text: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.story,
		lineHeight: Theme.lineHeight.story,
		color: colors.ink
	},
	strong: { fontFamily: Theme.fonts.bold },
	emphasis: { fontStyle: "italic" },
	link: {
		color: colors.blue, textDecorationLine: "underline"
	}
}));

type StoryStyles = ReturnType<typeof useStyles>;

function openLink(url: string): void {
	Linking.openURL(url).catch(console.error);
}

/** A link opens in the browser, as Discord opens it, without leaving its place in the sentence. */
function storySpan(styles: StoryStyles, span: StorySpan, key: string, emoji: InlineEmoji): ReactNode[] {
	const parts = twemojiParts({
		text: span.text, textStyle: [span.strong && styles.strong, span.emphasis && styles.emphasis], emoji, keyPrefix: `${key}-`
	});
	const link = span.link;
	return link === undefined
		? parts
		: [<Text key={`${key}-link`} style={styles.link} accessibilityRole="link" onPress={(): void => openLink(link)}>{parts}</Text>];
}

/** Game prose in the text style of the block that holds it, with its emojis drawn at that size unless another is asked. */
export function StoryText({
	children, style, emojiSize
}: {
	children: string; style: StyleProp<TextStyle>; emojiSize?: number;
}): ReactNode {
	const styles = useStyles();
	const emoji = inlineEmoji(style, emojiSize);

	// Android places inline emojis from a greedy layout: a balanced one moves the words but not the emojis.
	return <Text style={style} textBreakStrategy="simple">{children.split("\n").flatMap((line, lineIndex) => [
		...lineIndex > 0 ? ["\n"] : [],
		...storySpans(line).flatMap(span => storySpan(styles, span, `${lineIndex}-${span.id}`, emoji))
	])}</Text>;
}

export function Story({ children }: { children: string }): ReactNode {
	const styles = useStyles();
	return <StoryText style={styles.text}>{children}</StoryText>;
}
