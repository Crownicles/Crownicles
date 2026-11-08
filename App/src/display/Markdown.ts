import MarkdownIt, { type Token } from "markdown-it";

const markdown = new MarkdownIt({
	html: false, linkify: true
});

// Only an address written out in full is a link, as Discord sees it: a bare domain in a story stays a word.
markdown.linkify.set({
	fuzzyLink: false,
	fuzzyEmail: false,
	fuzzyIP: false
});

export type StorySpan = {
	id: string;
	text: string;
	strong: boolean;
	emphasis: boolean;
	code: boolean;

	/** The web page the span opens when touched. */
	link?: string;
};

type StoryMarks = Pick<StorySpan, "strong" | "emphasis"> & { link: string | undefined };

const LINK_OPEN = "link_open";
const LINK_CLOSE = "link_close";
const MARK_UPDATES: Readonly<Partial<Record<string, Partial<StoryMarks>>>> = {
	strong_open: { strong: true },
	strong_close: { strong: false },
	em_open: { emphasis: true },
	em_close: { emphasis: false },
	[LINK_CLOSE]: { link: undefined }
};
const SOFT_BREAK = "softbreak";
const INLINE_CODE = "code_inline";

/** A game text may name any address; only a web page, which the browser opens, is followed. */
const WEB_LINK = /^https?:\/\//iu;

function markUpdate(token: Token): Partial<StoryMarks> | undefined {
	if (token.type !== LINK_OPEN) {
		return MARK_UPDATES[token.type];
	}
	const href = token.attrGet("href");
	return { link: typeof href === "string" && WEB_LINK.test(href) ? href : undefined };
}

/** Game texts are authored for Discord, so their emphasis and links have to be unpacked before rendering. */
export function storySpans(text: string): StorySpan[] {
	const tokens = markdown.parseInline(text, {})[0]?.children ?? [];
	const spans: StorySpan[] = [];
	const marks: StoryMarks = {
		strong: false, emphasis: false, link: undefined
	};
	let offset = 0;
	for (const token of tokens) {
		const update = markUpdate(token);
		if (update) {
			Object.assign(marks, update);
			continue;
		}
		const content = token.type === SOFT_BREAK ? " " : token.content;
		if (!content) {
			continue;
		}
		const {
			link, ...emphasis
		} = marks;
		spans.push({
			id: `span-${offset}`, text: content, ...emphasis, code: token.type === INLINE_CODE, ...link === undefined ? {} : { link }
		});
		offset += content.length;
	}
	return spans;
}

/** The same text stripped of its markers, for the places that only accept a plain string. */
export function plainStory(text: string): string {
	return storySpans(text).map(span => span.text)
		.join("");
}

/** Markdown parsing folds line breaks into spaces, which a multi-line report cannot afford. */
export function plainLines(text: string): string {
	return text.split("\n").map(plainStory)
		.join("\n");
}
