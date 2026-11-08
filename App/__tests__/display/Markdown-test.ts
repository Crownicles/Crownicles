import {
	plainStory, storySpans
} from "@/src/display/Markdown";

describe("plainStory", () => {
	it("drops the Discord emphasis around a value", () => {
		expect(plainStory("Il vous manque **420** pièces")).toBe("Il vous manque 420 pièces");
	});

	it("unpacks a bold label without eating its punctuation", () => {
		expect(plainStory("Niveau 3 · **Amélioration :** niv. 2 -> niv. 3")).toBe("Niveau 3 · Amélioration : niv. 2 -> niv. 3");
	});

	it("keeps underscores that belong to a word", () => {
		expect(plainStory("snake_case_name")).toBe("snake_case_name");
	});

	it("leaves a plain sentence untouched", () => {
		expect(plainStory("Rien de spécial ici.")).toBe("Rien de spécial ici.");
	});
});

describe("storySpans", () => {
	const links = (text: string): string[] => storySpans(text).flatMap(span => span.link === undefined ? [] : [span.link]);

	it("turns a web address written in a game text into a link to it", () => {
		const spans = storySpans("Lisez le guide du joueur ! https://guide.crownicles.com/.");
		expect(spans.find(span => span.link !== undefined)).toMatchObject({
			text: "https://guide.crownicles.com/", link: "https://guide.crownicles.com/"
		});
		expect(plainStory("Lisez le guide du joueur ! https://guide.crownicles.com/.")).toBe("Lisez le guide du joueur ! https://guide.crownicles.com/.");
	});

	it("follows a Discord link through its label", () => {
		expect(storySpans("Rendez-vous sur le [wiki](https://guide.crownicles.com/) du bot !").find(span => span.link !== undefined)).toMatchObject({
			text: "wiki", link: "https://guide.crownicles.com/"
		});
	});

	it("only follows web pages", () => {
		expect(links("[piège](javascript:alert(1)) mailto:joueur@crownicles.com ftp://crownicles.com //crownicles.com [fichier](file:///etc/passwd)")).toEqual([]);
		expect(links("http://crownicles.com et HTTPS://guide.crownicles.com")).toEqual(["http://crownicles.com", "HTTPS://guide.crownicles.com"]);
	});

	it("leaves a bare domain as words, as Discord does", () => {
		expect(links("Le site crownicles.com est en ligne")).toEqual([]);
	});
});
