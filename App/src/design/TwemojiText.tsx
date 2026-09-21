import {parse} from "@twemoji/parser";
import {ReactNode} from "react";
import {Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle} from "react-native";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const styles = StyleSheet.create({
	line: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center"
	}
});

/**
 * The text split into words and emojis, ready to be laid out on a wrapping line.
 *
 * Exposed so prose that also carries emphasis can style each piece without re-implementing the
 * emoji substitution.
 */
export function twemojiParts({text, textStyle, emojiSize, iosEmojiVerticalOffset, keyPrefix = ""}: {
	text: string;
	textStyle?: StyleProp<TextStyle>;
	emojiSize: number;
	iosEmojiVerticalOffset?: number;
	keyPrefix?: string;
}): ReactNode[] {
	const entities = parse(text);
	const emojiVerticalOffset = Platform.OS === "ios" ? iosEmojiVerticalOffset ?? 0 : 0;

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
				verticalOffset={emojiVerticalOffset}
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

export function TwemojiText({children, textStyle, containerStyle, emojiSize, iosEmojiVerticalOffset}: {
	children: string;
	textStyle?: StyleProp<TextStyle>;
	containerStyle?: StyleProp<ViewStyle>;
	emojiSize: number;
	iosEmojiVerticalOffset?: number;
}): ReactNode {
	return <View style={[styles.line, containerStyle]}>{twemojiParts({
		text: children, textStyle, emojiSize, iosEmojiVerticalOffset
	})}</View>;
}