import {
	describe, expect, it
} from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

describe("Pet force validation", () => {
	it("should have force between 0 and 30 for all pets", () => {
		const petsPath = resolve(__dirname, "../../../resources/pets");
		const petFiles = readdirSync(petsPath).filter(file => file.endsWith(".json"));
		const invalidPets: { id: string; force: number }[] = [];

		for (const file of petFiles) {
			const petData = JSON.parse(readFileSync(resolve(petsPath, file), "utf8"));
			const petId = file.replace(".json", "");

			if (petData.force < 0 || petData.force > 30) {
				invalidPets.push({
					id: petId,
					force: petData.force
				});
			}
		}

		if (invalidPets.length > 0) {
			const errorMessage = `The following pets have invalid force values (must be between 0 and 30):\n` +
				invalidPets.map(p => `  Pet ${p.id}: force = ${p.force}`).join("\n");
			expect.fail(errorMessage);
		}

		expect(invalidPets).toHaveLength(0);
	});

	it("should have force defined for all pets", () => {
		const petsPath = resolve(__dirname, "../../../resources/pets");
		const petFiles = readdirSync(petsPath).filter(file => file.endsWith(".json"));
		const petsWithoutForce: string[] = [];

		for (const file of petFiles) {
			const petData = JSON.parse(readFileSync(resolve(petsPath, file), "utf8"));
			const petId = file.replace(".json", "");

			if (petData.force === undefined || petData.force === null) {
				petsWithoutForce.push(petId);
			}
		}

		if (petsWithoutForce.length > 0) {
			const errorMessage = `The following pets don't have a force value defined:\n` +
				petsWithoutForce.map(id => `  Pet ${id}`).join("\n");
			expect.fail(errorMessage);
		}

		expect(petsWithoutForce).toHaveLength(0);
	});

	it("should have force as an integer for all pets", () => {
		const petsPath = resolve(__dirname, "../../../resources/pets");
		const petFiles = readdirSync(petsPath).filter(file => file.endsWith(".json"));
		const petsWithNonIntegerForce: { id: string; force: number }[] = [];

		for (const file of petFiles) {
			const petData = JSON.parse(readFileSync(resolve(petsPath, file), "utf8"));
			const petId = file.replace(".json", "");

			if (!Number.isInteger(petData.force)) {
				petsWithNonIntegerForce.push({
					id: petId,
					force: petData.force
				});
			}
		}

		if (petsWithNonIntegerForce.length > 0) {
			const errorMessage = `The following pets have non-integer force values:\n` +
				petsWithNonIntegerForce.map(p => `  Pet ${p.id}: force = ${p.force}`).join("\n");
			expect.fail(errorMessage);
		}

		expect(petsWithNonIntegerForce).toHaveLength(0);
	});
});
