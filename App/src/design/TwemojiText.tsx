import {parse} from "@twemoji/parser";
import {ReactNode} from "react";
import {StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle} from "react-native";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const styles = StyleSheet.create({
	line: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "baseline"
	}
});

export function TwemojiText({children, textStyle, containerStyle, emojiSize}: {
	children: string;
	textStyle?: StyleProp<TextStyle>;
	containerStyle?: StyleProp<ViewStyle>;
	emojiSize: number;
}): ReactNode {
	const entities = parse(children);

	const parts: ReactNode[] = [];
	let lastIndex = 0;

	entities.forEach((entity, index) => {
		const [startIndex, endIndex] = entity.indices;
		if (startIndex > lastIndex) {
			parts.push(
				<Text key={`text-${index}`} style={textStyle}>
					{children.slice(lastIndex, startIndex)}
				</Text>
			);
		}
		parts.push(<TwemojiIcon key={`emoji-${index}`} emoji={entity.text} size={emojiSize} />);
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