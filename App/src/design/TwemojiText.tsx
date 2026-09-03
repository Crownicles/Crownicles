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

export function TwemojiText({children, textStyle, containerStyle, emojiSize, iosEmojiVerticalOffset}: {
	children: string;
	textStyle?: StyleProp<TextStyle>;
	containerStyle?: StyleProp<ViewStyle>;
	emojiSize: number;
	iosEmojiVerticalOffset?: number;
}): ReactNode {
	const entities = parse(children);
	const emojiVerticalOffset = Platform.OS === "ios" ? iosEmojiVerticalOffset ?? 0 : 0;

	const parts: ReactNode[] = [];
	let lastIndex = 0;

	entities.forEach(entity => {
		const [startIndex, endIndex] = entity.indices;
		if (startIndex > lastIndex) {
			parts.push(
				<Text key={`text-${lastIndex}-${startIndex}`} style={textStyle}>
					{children.slice(lastIndex, startIndex)}
				</Text>
			);
		}
		parts.push(
			<TwemojiIcon
				key={`emoji-${startIndex}-${endIndex}`}
				emoji={entity.text}
				size={emojiSize}
				verticalOffset={emojiVerticalOffset}
			/>
		);
		lastIndex = endIndex;
	});

	if (lastIndex < children.length) {
		parts.push(
			<Text key="text-last" style={textStyle}>
				{children.slice(lastIndex)}
			</Text>
		);
	}

	return <View style={[styles.line, containerStyle]}>{parts}</View>;
}