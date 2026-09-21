import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({html: false, linkify: false});

export type StorySpan = {id: string; text: string; strong: boolean; emphasis: boolean; code: boolean};

const MARK_UPDATES: Readonly<Partial<Record<string, Partial<Pick<StorySpan, "strong" | "emphasis">>>>> = {
	strong_open: {strong: true}, strong_close: {strong: false}, em_open: {emphasis: true}, em_close: {emphasis: false}
};
const SOFT_BREAK = "softbreak";
const INLINE_CODE = "code_inline";

/** Game texts are authored for Discord, so their emphasis has to be unpacked before rendering. */
export function storySpans(text: string): StorySpan[] {
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

/** The same text stripped of its markers, for the places that only accept a plain string. */
export function plainStory(text: string): string {
	return storySpans(text).map(span => span.text).join("");
}
