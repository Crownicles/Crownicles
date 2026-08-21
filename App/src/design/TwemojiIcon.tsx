import {Image} from "expo-image";
import twemoji from "@twemoji/api";
import {ReactElement} from "react";
import {StyleSheet} from "react-native";

const TWEMOJI_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg";

const styles = StyleSheet.create({
	icon: {
		flexShrink: 0
	}
});

export function twemojiAssetUrl(emoji: string): string {
	const filenameSource = emoji.includes("\u200D")
		? emoji
		: emoji.replace(/\uFE0F/gu, "");
	return `${TWEMOJI_ASSET_BASE_URL}/${twemoji.convert.toCodePoint(filenameSource)}.svg`;
}

export function TwemojiIcon({emoji, size, opacity = 1, verticalOffset = 0}: {
	emoji: string;
	size: number;
	opacity?: number;
	verticalOffset?: number;
}): ReactElement {
	const source = twemojiAssetUrl(emoji);

	return (
		<Image
			accessibilityRole="image"
			accessibilityLabel={emoji}
			contentFit="contain"
			source={source}
			style={[styles.icon, {width: size, height: size, opacity, transform: [{translateY: verticalOffset}]}]}
		/>
	);
}
