import { parse } from "@twemoji/parser";
import { ReactNode } from "react";
import {
	StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle
} from "react-native";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";

type EmojiEntity = ReturnType<typeof parse>[number];

/** Game texts come back screen after screen: past this many, the oldest parse is forgotten. */
const PARSED_TEXTS_KEPT = 500;
const parsedTexts = new Map<string, readonly EmojiEntity[]>();

/** Where the emojis of a text sit; the regex scan is kept since the same texts are drawn again and again. */
export function emojiEntities(text: string): readonly EmojiEntity[] {
	const known = parsedTexts.get(text);
	if (known) {
		return known;
	}
	const entities = parse(text);
	const oldest = parsedTexts.keys().next();
	if (parsedTexts.size >= PARSED_TEXTS_KEPT && !oldest.done) {
		parsedTexts.delete(oldest.value);
	}
	parsedTexts.set(text, entities);
	return entities;
}

/** Inter's capitals rise this share of the font size above the baseline. */
const CAP_HEIGHT_RATIO = 0.727;

/** React Native's own text size, for a text whose style sets none. */
const DEFAULT_FONT_SIZE = 14;

/**
 * Both platforms stand an inline image on the baseline of its line, so an emoji as tall as the letters rises
 * above them, and iOS cuts what passes the top of the text. Lowered by this much, it is centred on the
 * capitals whatever the size of the text and of the emoji, instead of following a nudge tuned for one size.
 */
export function inlineEmojiOffset(textStyle: StyleProp<TextStyle>, emojiSize: number): number {
	const fontSize = StyleSheet.flatten(textStyle)?.fontSize ?? DEFAULT_FONT_SIZE;
	return (emojiSize - fontSize * CAP_HEIGHT_RATIO) / 2;
}

/**
 * The text split into words and emojis, ready to be laid out on a wrapping line.
 *
 * Exposed so prose that also carries emphasis can style each piece without re-implementing the
 * emoji substitution.
 */
export function twemojiParts({
	text, textStyle, emojiSize, emojiOffset, keyPrefix = ""
}: {
	text: string;
	textStyle?: StyleProp<TextStyle>;
	emojiSize: number;

	/** From `inlineEmojiOffset`, with the style of the text holding the pieces. */
	emojiOffset: number;
	keyPrefix?: string;
}): ReactNode[] {
	const entities = emojiEntities(text);

	const parts: ReactNode[] = [];
	let lastIndex = 0;

	entities.forEach(entity => {
		const [startIndex, endIndex] = entity.indices;
		if (startIndex > lastIndex) {
			parts.push(
				<Text key={`${keyPrefix}text-${lastIndex}-${startIndex}`} style={textStyle}>
					{text.slice(lastIndex, startIndex)}
				</Text>
			);
		}
		parts.push(
			<TwemojiIcon
				key={`${keyPrefix}emoji-${startIndex}-${endIndex}`}
				emoji={entity.text}
				size={emojiSize}
				verticalOffset={emojiOffset}
			/>
		);
		lastIndex = endIndex;
	});

	if (lastIndex < text.length) {
		parts.push(
			<Text key={`${keyPrefix}text-last`} style={textStyle}>
				{text.slice(lastIndex)}
			</Text>
		);
	}

	return parts;
}

/** Game texts open with their emoji: split it off so it can take an icon slot and the rest a title style. */
export function splitLeadingEmoji(label: string): {
	emoji?: string; text: string;
} {
	const trimmed = label.trimStart();
	const [first] = emojiEntities(trimmed);
	if (first?.indices[0] !== 0) {
		return { text: trimmed };
	}
	return {
		emoji: first.text, text: trimmed.slice(first.indices[1]).trimStart()
	};
}

/** Laid out as one paragraph, so a long label wraps its words after the emoji instead of pushing the text below it. */
export function TwemojiText({
	children, textStyle, containerStyle, emojiSize, numberOfLines
}: {
	children: string;
	textStyle?: StyleProp<TextStyle>;
	containerStyle?: StyleProp<ViewStyle>;
	emojiSize: number;
	numberOfLines?: number;
}): ReactNode {
	return <View style={containerStyle}><Text style={textStyle} numberOfLines={numberOfLines}>{twemojiParts({
		text: children, emojiSize, emojiOffset: inlineEmojiOffset(textStyle, emojiSize)
	})}</Text></View>;
}
