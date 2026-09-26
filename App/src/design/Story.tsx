import {ReactNode} from "react";
import {StyleSheet, Text} from "react-native";
import {parse} from "@twemoji/parser";
import {StorySpan, storySpans} from "@/src/display/Markdown";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";

/**
 * A piece of the game's own prose.
 *
 * Event texts are written once, for every front end: they carry Discord emphasis, line breaks and
 * game emojis. Everything is laid out inside a single text so words, emojis and bold wrap together
 * like a paragraph, instead of each piece becoming a block of its own.
 */
const styles = StyleSheet.create({
	text: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.story,
		lineHeight: Theme.lineHeight.story,
		color: Theme.colors.ink
	},
	strong: {fontFamily: Theme.fonts.bold},
	emphasis: {fontStyle: "italic"}
});

function inlineSpan(span: StorySpan, key: string): ReactNode[] {
	const style = [span.strong && styles.strong, span.emphasis && styles.emphasis];
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	for (const entity of parse(span.text)) {
		const [start, end] = entity.indices;
		if (start > lastIndex) parts.push(<Text key={`${key}-${lastIndex}`} style={style}>{span.text.slice(lastIndex, start)}</Text>);
		parts.push(<TwemojiIcon key={`${key}-emoji-${start}`} emoji={entity.text} size={Theme.fontSize.story} verticalOffset={Theme.emoji.iosFieldOffset} />);
		lastIndex = end;
	}
	if (lastIndex < span.text.length) parts.push(<Text key={`${key}-${lastIndex}`} style={style}>{span.text.slice(lastIndex)}</Text>);
	return parts;
}

export function Story({children}: {children: string}): ReactNode {
	return <Text style={styles.text}>{children.split("\n").flatMap((line, lineIndex) => [
		...lineIndex > 0 ? ["\n"] : [],
		...storySpans(line).flatMap(span => inlineSpan(span, `${lineIndex}-${span.id}`))
	])}</Text>;
}
