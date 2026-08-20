import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PetEntity as PetEntityType } from "../../src/core/database/game/models/PetEntity";

type PetNickCommandModule = typeof import("../../src/commands/pet/PetNickCommand");

describe("pet nickname lock", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PetEntity: ModelStatic<PetEntityType>;
	let renameOwnPet: PetNickCommandModule["renameOwnPet"];

	beforeAll(async () => {
		env = await setupCoreForTests("petnicklock");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		PetEntity = models.PetEntity as ModelStatic<PetEntityType>;
		renameOwnPet = loadProductionModule<PetNickCommandModule>("commands/pet/PetNickCommand").renameOwnPet;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await PetEntity.destroy({
				truncate: true, force: true
			});
			await Player.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	async function seedPlayerWithPet(keycloakId: string): Promise<{
		player: PlayerType; pet: PetEntityType;
	}> {
		const pet = await PetEntity.create({
			typeId: 1,
			sex: "m",
			nickname: "Origine",
			lovePoints: 50
		});
		const player = await Player.create({
			keycloakId,
			petId: pet.id
		});
		return {
			player, pet
		};
	}

	it("refuses to rename a pet the player no longer owns", async () => {
		const {
			player, pet
		} = await seedPlayerWithPet("nick-lost-ownership");

		// The transfer / sell / free committed while the rename was in flight
		await Player.update({ petId: null }, { where: { id: player.id } });

		const renamed = await renameOwnPet(player, pet.id, "Vole");

		expect(renamed).toBeNull();
		const reloadedPet = await PetEntity.findByPk(pet.id);
		expect(reloadedPet!.nickname).toBe("Origine");
	});

	it("renames the pet when the player still owns it", async () => {
		const {
			player, pet
		} = await seedPlayerWithPet("nick-still-owner");

		const renamed = await renameOwnPet(player, pet.id, "Nouveau");

		expect(renamed).not.toBeNull();
		const reloadedPet = await PetEntity.findByPk(pet.id);
		expect(reloadedPet!.nickname).toBe("Nouveau");
	});

	it("reports a missing pet instead of throwing when the pet row vanished", async () => {
		const {
			player, pet
		} = await seedPlayerWithPet("nick-vanished-pet");
		const petId = pet.id;
		await PetEntity.destroy({
			where: { id: petId }, force: true
		});

		await expect(renameOwnPet(player, petId, "Fantome")).resolves.toBeNull();
	});
});
