import {
	describe, expect, it
} from "vitest";
import { ClassInfoConstants } from "../../src/constants/ClassInfoConstants";
import { ClassConstants } from "../../src/constants/ClassConstants";

const CLASSES = ClassConstants.CLASSES_ID;

describe("ClassInfoConstants lineages", () => {
	it("finds the lineage of a class, whatever its rank in it", () => {
		expect(ClassInfoConstants.getClassLineageName(CLASSES.RECRUIT)).toBe("infantryman");
		expect(ClassInfoConstants.getClassLineageName(CLASSES.IMPENETRABLE_TANK)).toBe("tank");
		expect(ClassInfoConstants.getClassLineageName(CLASSES.LUMINOUS_PALADIN)).toBe("paladin");
		expect(ClassInfoConstants.getClassLineageName(CLASSES.MYSTIC_MAGE)).toBe("mage");
	});

	it("gives the whole lineage of a class", () => {
		expect(ClassInfoConstants.getClassLineage(CLASSES.ARCHER)).toEqual([
			CLASSES.ROCK_THROWER, CLASSES.SLINGER, CLASSES.ARCHER, CLASSES.GUNNER, CLASSES.FORMIDABLE_GUNNER
		]);
	});

	it("puts every class in exactly one lineage", () => {
		for (const classId of Object.values(CLASSES)) {
			const lineages = Object.values(ClassInfoConstants.CLASS_LINEAGES).filter(lineage => (lineage as readonly number[]).includes(classId));
			expect(lineages, `class ${classId}`).toHaveLength(1);
		}
	});

	it("treats an unknown class as a lineage of its own", () => {
		expect(ClassInfoConstants.getClassLineageName(999)).toBeNull();
		expect(ClassInfoConstants.getClassLineage(999)).toEqual([999]);
	});
});
