import { describe, expect, it, beforeEach, vi } from "vitest";
import { getValidOutcomesForPlayer, PossibilityOutcome } from "../../../src/data/events/PossibilityOutcome";
import Player from "../../../src/core/database/game/models/Player";
import { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { PetDataController } from "../../../src/data/Pet";

// Mock des dépendances
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo");
vi.mock("../../../src/core/database/game/models/PetEntity");
vi.mock("../../../src/core/database/game/models/InventorySlot");
vi.mock("../../../src/data/Pet");

describe("PossibilityOutcome Requirements", () => {
	let mockPlayer: Partial<Player>;
	let outcomes: { [key: string]: PossibilityOutcome };

	beforeEach(() => {
		// Créer un joueur mock
		mockPlayer = {
			id: 1,
			level: 10,
			health: 100,
			karma: 50,
			class: 1,
			petId: 123,
			getCumulativeDefense: vi.fn().mockReturnValue(20),
			getCumulativeAttack: vi.fn().mockReturnValue(15),
			getCumulativeSpeed: vi.fn().mockReturnValue(10)
		} as Partial<Player>;

		// Mock des inventaires actifs
		vi.mocked(InventorySlots.getPlayerActiveObjects).mockResolvedValue({} as any);

		// Définir des outcomes de test
		outcomes = {
			basicOutcome: {
				health: 10,
				money: 50
			},
			levelRequirement: {
				requirements: {
					level: { min: 5, max: 15 }
				},
				health: 20
			},
			campaignRequirement: {
				requirements: {
					campaignCurrentMissionId: 3
				},
				money: 100
			},
			petTypeRequirement: {
				requirements: {
					validPetTypeIds: [42]
				},
				gems: 5
			},
			petRarityRequirement: {
				requirements: {
					petRarity: { min: 2, max: 4 }
				},
				bonusExperience: 150
			},
			noPetRequirement: {
				requirements: {
					validPetTypeIds: [1]
				},
				health: -10
			}
		};
	});

	describe("Campaign Requirements", () => {
		it("should pass when campaign requirement matches", async () => {
			// Mock mission info avec la bonne progression de campagne
			vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({
				campaignProgression: 3
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ campaignRequirement: outcomes.campaignRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("campaignRequirement");
		});

		it("should fail when campaign requirement doesn't match", async () => {
			// Mock mission info avec une progression différente
			vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({
				campaignProgression: 5
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ campaignRequirement: outcomes.campaignRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});
	});

	describe("Pet Type Requirements", () => {
		it("should pass when pet type matches (single type)", async () => {
			// Mock pet entity avec le bon type
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 42
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petTypeRequirement: outcomes.petTypeRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("petTypeRequirement");
		});

		it("should pass when pet type matches (multiple valid types)", async () => {
			// Mock pet entity avec un type dans la liste
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 99
			} as any);

			const multiTypesOutcome = {
				requirements: {
					validPetTypeIds: [42, 99, 123]
				},
				gems: 10
			};

			const validOutcomes = await getValidOutcomesForPlayer(
				{ multiTypes: multiTypesOutcome },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("multiTypes");
		});

		it("should fail when pet type doesn't match", async () => {
			// Mock pet entity avec un type différent
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 999
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petTypeRequirement: outcomes.petTypeRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});

		it("should fail when pet type not in list (multiple valid types)", async () => {
			// Mock pet entity avec un type non présent dans la liste
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 999
			} as any);

			const multiTypesOutcome = {
				requirements: {
					validPetTypeIds: [42, 99, 123]
				},
				gems: 10
			};

			const validOutcomes = await getValidOutcomesForPlayer(
				{ multiTypes: multiTypesOutcome },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});

		it("should fail when player has no pet", async () => {
			// Joueur sans pet
			mockPlayer.petId = undefined;

			const validOutcomes = await getValidOutcomesForPlayer(
				{ noPetRequirement: outcomes.noPetRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});
	});

	describe("Pet Rarity Requirements", () => {
		beforeEach(() => {
			// Mock pet entity
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 42
			} as any);
		});

		it("should pass when pet rarity is within range", async () => {
			// Mock pet data avec rareté dans la range
			vi.mocked(PetDataController.instance.getById).mockReturnValue({
				rarity: 3
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petRarityRequirement: outcomes.petRarityRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("petRarityRequirement");
		});

		it("should fail when pet rarity is below minimum", async () => {
			// Mock pet data avec rareté trop faible
			vi.mocked(PetDataController.instance.getById).mockReturnValue({
				rarity: 1
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petRarityRequirement: outcomes.petRarityRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});

		it("should fail when pet rarity is above maximum", async () => {
			// Mock pet data avec rareté trop élevée
			vi.mocked(PetDataController.instance.getById).mockReturnValue({
				rarity: 5
			} as any);

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petRarityRequirement: outcomes.petRarityRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});

		it("should fail when player has no pet for rarity requirement", async () => {
			// Joueur sans pet
			mockPlayer.petId = undefined;

			const validOutcomes = await getValidOutcomesForPlayer(
				{ petRarityRequirement: outcomes.petRarityRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(0);
		});
	});

	describe("Combined Requirements", () => {
		it("should validate multiple requirements", async () => {
			// Mock toutes les dépendances pour qu'elles passent
			vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({
				campaignProgression: 3
			} as any);
			vi.mocked(PetEntities.getById).mockResolvedValue({
				typeId: 42
			} as any);
			vi.mocked(PetDataController.instance.getById).mockReturnValue({
				rarity: 3
			} as any);

			const complexOutcome: PossibilityOutcome = {
				requirements: {
					level: { min: 5, max: 15 },
					campaignCurrentMissionId: 3,
					validPetTypeIds: [42],
					petRarity: { min: 2, max: 4 }
				},
				money: 200
			};

			const validOutcomes = await getValidOutcomesForPlayer(
				{ complexOutcome },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("complexOutcome");
		});
	});

	describe("Basic Requirements (existing)", () => {
		it("should validate level requirements", async () => {
			const validOutcomes = await getValidOutcomesForPlayer(
				{ levelRequirement: outcomes.levelRequirement },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("levelRequirement");
		});

		it("should accept outcomes with no requirements", async () => {
			const validOutcomes = await getValidOutcomesForPlayer(
				{ basicOutcome: outcomes.basicOutcome },
				mockPlayer as Player
			);

			expect(validOutcomes).toHaveLength(1);
			expect(validOutcomes[0][0]).toBe("basicOutcome");
		});
	});
});
