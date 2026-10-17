import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../src/core/database/game/models/PetEntity", () => ({
	default: { build: vi.fn((values: unknown) => values) }
}));

import { generateKingGuardPet } from "../../../../src/core/fights/kingGuards/KingGuardPet";
import { PetDataController } from "../../../../src/data/Pet";

describe("generateKingGuardPet", () => {
	const draws = 20_000;
	const drawnForces: number[] = [];

	beforeEach(() => {
		if (drawnForces.length > 0) {
			return;
		}
		for (let i = 0; i < draws; i++) {
			const { typeId } = generateKingGuardPet() as unknown as { typeId: number };
			drawnForces.push(PetDataController.instance.getById(typeId)!.force);
		}
	});

	it("never gives the empty pet slot", () => {
		expect(drawnForces.every(force => force > 0)).toBe(true);
	});

	it("draws strong pets more often than weak ones", () => {
		const pets = PetDataController.instance.getAllValues().filter(pet => pet.rarity !== 0);
		const uniformMeanForce = pets.reduce((total, pet) => total + pet.force, 0) / pets.length;
		const drawnMeanForce = drawnForces.reduce((total, force) => total + force, 0) / draws;

		expect(drawnMeanForce).toBeGreaterThan(uniformMeanForce * 1.5);
	});

	it("keeps the weakest pets possible", () => {
		const weakestForce = Math.min(...PetDataController.instance.getAllValues().filter(pet => pet.rarity !== 0)
			.map(pet => pet.force));

		expect(drawnForces).toContain(weakestForce);
	});
});
