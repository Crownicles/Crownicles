export function compactCityDescription(description: string): string {
	const firstParagraph = description.split("\n\n")[0].trim();
	const firstSentence = firstParagraph.match(/^.*?[.!?](?:\s|$)/)?.[0];
	return (firstSentence ?? firstParagraph).trim();
}
