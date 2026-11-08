import { ReactNode } from "react";
import {
	Linking, Platform, StyleProp, Text, TextStyle
} from "react-native";
import {
	StorySpan, storySpans
} from "@/src/display/Markdown";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { emojiEntities } from "@/src/design/TwemojiText";
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

const EMOJI_OFFSET = Platform.OS === "ios" ? Theme.emoji.iosFieldOffset : Theme.emoji.androidStoryOffset;

function openLink(url: string): void {
	Linking.openURL(url).catch(console.error);
}

function inlineSpan(styles: StoryStyles, span: StorySpan, key: string, emojiSize: number): ReactNode[] {
	const style = [span.strong && styles.strong, span.emphasis && styles.emphasis];
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	for (const entity of emojiEntities(span.text)) {
		const [start, end] = entity.indices;
		if (start > lastIndex) {
			parts.push(<Text key={`${key}-${lastIndex}`} style={style}>{span.text.slice(lastIndex, start)}</Text>);
		}
		parts.push(<TwemojiIcon key={`${key}-emoji-${start}`} emoji={entity.text} size={emojiSize} verticalOffset={EMOJI_OFFSET} />);
		lastIndex = end;
	}
	if (lastIndex < span.text.length) {
		parts.push(<Text key={`${key}-${lastIndex}`} style={style}>{span.text.slice(lastIndex)}</Text>);
	}
	return parts;
}

/** A link opens in the browser, as Discord opens it, without leaving its place in the sentence. */
function storySpan(styles: StoryStyles, span: StorySpan, key: string, emojiSize: number): ReactNode[] {
	const parts = inlineSpan(styles, span, key, emojiSize);
	const link = span.link;
	return link === undefined
		? parts
		: [<Text key={`${key}-link`} style={styles.link} accessibilityRole="link" onPress={(): void => openLink(link)}>{parts}</Text>];
}

/** Game prose in the text style of the block that holds it, with its emojis drawn at that size. */
export function StoryText({
	children, style, emojiSize
}: {
	children: string; style: StyleProp<TextStyle>; emojiSize: number;
}): ReactNode {
	const styles = useStyles();

	// Android places inline emojis from a greedy layout: a balanced one moves the words but not the emojis.
	return <Text style={style} textBreakStrategy="simple">{children.split("\n").flatMap((line, lineIndex) => [
		...lineIndex > 0 ? ["\n"] : [],
		...storySpans(line).flatMap(span => storySpan(styles, span, `${lineIndex}-${span.id}`, emojiSize))
	])}</Text>;
}

export function Story({ children }: { children: string }): ReactNode {
	const styles = useStyles();
	return <StoryText style={styles.text} emojiSize={Theme.fontSize.story}>{children}</StoryText>;
}
