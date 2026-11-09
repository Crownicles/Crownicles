type TextPart = string | false | null | undefined;

function present(parts: readonly TextPart[]): string[] {
	return parts.filter((part): part is string => Boolean(part));
}

/** Blocks of translated text separated by a blank line; empty parts are skipped. */
export function joinParagraphs(parts: readonly TextPart[]): string {
	return present(parts).join("\n\n");
}

/** Lines of translated text kept in the same paragraph; empty parts are skipped. */
export function joinLines(parts: readonly TextPart[]): string {
	return present(parts).join("\n");
}
