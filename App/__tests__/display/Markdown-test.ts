import {plainStory} from "@/src/display/Markdown";

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
