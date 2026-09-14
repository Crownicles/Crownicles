import {ReactNode} from "react";
import {StyleProp, StyleSheet, Text, TextStyle} from "react-native";
import MarkdownIt from "markdown-it";
import {Theme} from "@/src/design/Theme";

const markdown = new MarkdownIt({html: false, linkify: false});
type StorySpan = {id: string; text: string; strong: boolean; emphasis: boolean; code: boolean};
const MARK_UPDATES: Readonly<Partial<Record<string, Partial<Pick<StorySpan, "strong" | "emphasis">>>>> = {
	strong_open: {strong: true}, strong_close: {strong: false}, em_open: {emphasis: true}, em_close: {emphasis: false}
};
const SOFT_BREAK = "softbreak";
const INLINE_CODE = "code_inline";
const styles = StyleSheet.create({
	strong: {fontFamily: Theme.fonts.bold, color: Theme.colors.ink},
	emphasis: {fontStyle: "italic"},
	code: {fontFamily: Theme.fonts.semiBold, backgroundColor: Theme.colors.wash, color: Theme.colors.ink, fontVariant: ["tabular-nums"]}
});

function storySpans(text: string): StorySpan[] {
	const tokens = markdown.parseInline(text, {})[0]?.children ?? [];
	const spans: StorySpan[] = [];
	const marks = {strong: false, emphasis: false};
	let offset = 0;
	for (const token of tokens) {
		const update = MARK_UPDATES[token.type];
		if (update) {
			Object.assign(marks, update);
			continue;
		}
		const content = token.type === SOFT_BREAK ? " " : token.content;
		if (!content) continue;
		spans.push({id: `span-${offset}`, text: content, ...marks, code: token.type === INLINE_CODE});
		offset += content.length;
	}
	return spans;
}

export function FightNarrative({children, style}: {children: string; style?: StyleProp<TextStyle>}): ReactNode {
	return <Text style={style}>{storySpans(children).map(span => <Text key={span.id} style={[span.strong && styles.strong, span.emphasis && styles.emphasis, span.code && styles.code]}>{span.text}</Text>)}</Text>;
}