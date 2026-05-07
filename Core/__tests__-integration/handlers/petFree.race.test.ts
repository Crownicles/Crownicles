/**
 * Race integration test for the multi-row pet-free critical sections
 * fixed by PR-F3 (`PetFreeCommand`).
 *
 * The shelter free path mutates a guild_pets row, a pet entity row,
 * the player's `lastPetFree` cooldown, and (opportunistically) the
 * guild's `carnivorousFood` pantry — all in the same logical step.
 * Without locking, two members racing to free the same shelter slot:
 *   - both pass the cooldown / money checks against stale snapshots
 *   - both credit themselves the meat reward (lost-update of the
 *     pantry — the second writer's `+= MEAT_GIVEN` overwrites the
 *     first)
 *   - both attempt to destroy the same guild_pets / pet rows
 *
 * PR-F3 wraps the read-validate-mutate-save sequence in a 4-row
 * `withLockedEntities` and re-checks every invariant against the
 * locked rows. The loser of the race sees the row gone (or its
 * `petEntityId` reassigned) and emits a graceful refuse packet.
 */
import {
	beforeAll, afterAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	LockedRowNotFoundError, LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";

class PlayerRow extends Model {
	declare id: number;

	declare lastPetFree: number;
}

class PetRow extends Model {
	declare id: number;
}

class GuildPetRow extends Model {
	declare id: number;

	declare petEntityId: number | null;
}

class GuildRow extends Model {
	declare id: number;

	declare carnivorousFood: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let PetModel: ModelStatic<PetRow>;
let GuildPetModel: ModelStatic<GuildPetRow>;
let GuildModel: ModelStatic<GuildRow>;

const MEAT_GIVEN = 5;

beforeAll(async () => {
	env = await setupIntegrationDb("pet_free_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			lastPetFree: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row_free", timestamps: false }
	);
	PetModel = PetRow.init(
		{ id: { type: DataTypes.INTEGER, primaryKey: true } },
		{ sequelize: env.sequelize, tableName: "pet_row_free", timestamps: false }
	);
	GuildPetModel = GuildPetRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			petEntityId: { type: DataTypes.INTEGER, allowNull: true }
		},
		{ sequelize: env.sequelize, tableName: "guild_pet_row_free", timestamps: false }
	);
	GuildModel = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true },
			carnivorousFood: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "guild_row_free", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
	await PetModel.destroy({ where: {}, truncate: true });
	await GuildPetModel.destroy({ where: {}, truncate: true });
	await GuildModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy shelter-free: each contender independently reads the rows,
 * validates against stale snapshots, mutates and saves. Mirrors the
 * pre-PR-F3 production code path of `freePetFromShelter`.
 */
async function unsafeShelterFree(playerId: number, guildPetId: number, petId: number, guildId: number): Promise<boolean> {
	const player = await PlayerModel.findByPk(playerId);
	const guildPet = await GuildPetModel.findByPk(guildPetId);
	const pet = await PetModel.findByPk(petId);
	const guild = await GuildModel.findByPk(guildId);
	if (!player || !guildPet || !pet || !guild || guildPet.petEntityId !== petId) {
		return false;
	}
	// Yield once so two unsafe contenders interleave their read.
	await new Promise(resolve => setImmediate(resolve));
	guild.carnivorousFood += MEAT_GIVEN; // each contender claims the reward
	await guildPet.destroy();
	await pet.destroy();
	player.lastPetFree = Date.now();
	await Promise.all([player.save(), guild.save()]);
	return true;
}

/**
 * Fixed shelter-free: lock all four rows, revalidate, mutate, save.
 */
async function lockedShelterFree(playerId: number, guildPetId: number, petId: number, guildId: number): Promise<boolean> {
	try {
		return await withLockedEntities(
			[
				{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
				{ model: GuildPetModel, id: guildPetId } as LockKey<GuildPetRow>,
				{ model: PetModel, id: petId } as LockKey<PetRow>,
				{ model: GuildModel, id: guildId } as LockKey<GuildRow>
			] as const,
			async ([player, guildPet, pet, guild]) => {
				if (guildPet.petEntityId !== petId) {
					return false;
				}
				guild.carnivorousFood += MEAT_GIVEN;
				await guildPet.destroy();
				await pet.destroy();
				player.lastPetFree = Date.now();
				await Promise.all([player.save(), guild.save()]);
				return true;
			}
		);
	}
	catch (err) {
		if (err instanceof LockedRowNotFoundError) {
			return false;
		}
		throw err;
	}
}

describe("pet free race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe shelter-free contenders BOTH succeed; pantry credit is lost-updated",
		async () => {
			await PlayerModel.create({ id: 1, lastPetFree: 0 });
			await PlayerModel.create({ id: 2, lastPetFree: 0 });
			await PetModel.create({ id: 100 });
			await GuildPetModel.create({ id: 200, petEntityId: 100 });
			await GuildModel.create({ id: 300, carnivorousFood: 0 });

			const results = await Promise.all([
				unsafeShelterFree(1, 200, 100, 300),
				unsafeShelterFree(2, 200, 100, 300)
			]);

			const [guildPet, pet, guild] = await Promise.all([
				GuildPetModel.findByPk(200),
				PetModel.findByPk(100),
				GuildModel.findByPk(300)
			]);

			// Both contenders reported "freed".
			expect(results).toEqual([true, true]);
			expect(guildPet).toBeNull();
			expect(pet).toBeNull();
			/*
			 * Bug: TWO meat rewards were claimed but only ONE
			 * actually landed in the pantry — classic lost update on
			 * `guild.carnivorousFood`.
			 */
			expect(guild?.carnivorousFood).toBe(MEAT_GIVEN);
		}
	);

	it(
		"FIXES the bug: locked shelter-free contenders serialise — only one succeeds",
		async () => {
			await PlayerModel.create({ id: 11, lastPetFree: 0 });
			await PlayerModel.create({ id: 12, lastPetFree: 0 });
			await PetModel.create({ id: 110 });
			await GuildPetModel.create({ id: 210, petEntityId: 110 });
			await GuildModel.create({ id: 310, carnivorousFood: 0 });

			const results = await Promise.all([
				lockedShelterFree(11, 210, 110, 310),
				lockedShelterFree(12, 210, 110, 310)
			]);

			const [guildPet, pet, guild] = await Promise.all([
				GuildPetModel.findByPk(210),
				PetModel.findByPk(110),
				GuildModel.findByPk(310)
			]);

			// Exactly one of the two contenders succeeded.
			expect(results.filter(success => success)).toHaveLength(1);
			expect(guildPet).toBeNull();
			expect(pet).toBeNull();
			// Pantry credited exactly once.
			expect(guild?.carnivorousFood).toBe(MEAT_GIVEN);
		}
	);

	it(
		"FIXES the bug: distinct shelter slots free in parallel without contention",
		async () => {
			await PlayerModel.create({ id: 21, lastPetFree: 0 });
			await PlayerModel.create({ id: 22, lastPetFree: 0 });
			await PetModel.create({ id: 121 });
			await PetModel.create({ id: 122 });
			await GuildPetModel.create({ id: 221, petEntityId: 121 });
			await GuildPetModel.create({ id: 222, petEntityId: 122 });
			await GuildModel.create({ id: 321, carnivorousFood: 0 });
			await GuildModel.create({ id: 322, carnivorousFood: 0 });

			const results = await Promise.all([
				lockedShelterFree(21, 221, 121, 321),
				lockedShelterFree(22, 222, 122, 322)
			]);

			expect(results).toEqual([true, true]);
		}
	);
});
