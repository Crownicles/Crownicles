/**
 * Race integration test for the cross-entity pet-transfer critical
 * sections fixed by PR-F1 (`PetTransferCommand`).
 *
 * The withdraw / switch flows mutate `player.petId` AND a
 * `guild_pets` row in the same logical step. Without locking, two
 * guild members trying to withdraw the SAME shelter slot can both
 * pass the read-validate phase, both set `lockedPlayer.petId =
 * petEntityId`, and the destroy of the guild_pet row only commits
 * once — **duplicating** the pet across two players.
 *
 * PR-F1 wraps the read-validate-mutate-save sequence in
 * `withLockedEntities([Player.lockKey(p), GuildPet.lockKey(gp)])`,
 * so the second contender re-validates `lockedGuildPet.petEntityId`
 * against the locked row and bails out instead of duplicating the
 * pet.
 *
 * Why ad-hoc Sequelize models — see the rationale in
 * `handleFoodShopBuy.race.test.ts`. We model two players sharing one
 * guild_pet row.
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

	declare petId: number | null;
}

class GuildPetRow extends Model {
	declare id: number;

	declare petEntityId: number | null;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let GuildPetModel: ModelStatic<GuildPetRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("pet_transfer_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			petId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
		},
		{ sequelize: env.sequelize, tableName: "player_row_pet", timestamps: false }
	);
	GuildPetModel = GuildPetRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			petEntityId: { type: DataTypes.INTEGER, allowNull: true }
		},
		{ sequelize: env.sequelize, tableName: "guild_pet_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
	await GuildPetModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy variant: read both rows, validate, mutate, destroy/save —
 * without holding any row lock. Mirrors the pre-PR-F1 production
 * code path of `withdrawPetFromGuild`.
 */
async function withdrawPetUnsafe(playerId: number, guildPetId: number): Promise<boolean> {
	const player = await PlayerModel.findByPk(playerId);
	const guildPet = await GuildPetModel.findByPk(guildPetId);
	if (!player || !guildPet || player.petId !== null || guildPet.petEntityId === null) {
		return false;
	}
	// Yield once so two unsafe withdrawers interleave their
	// read-validate phase and both pass the "shelter still has the
	// pet" check on the same stale snapshot.
	await new Promise(resolve => setImmediate(resolve));
	player.petId = guildPet.petEntityId;
	await player.save();
	await guildPet.destroy();
	return true;
}

/**
 * Fixed variant: lock both rows with `SELECT … FOR UPDATE`,
 * re-validate `lockedGuildPet.petEntityId`, mutate, save, destroy.
 * Mirrors the post-PR-F1 production code path.
 */
async function withdrawPetLocked(playerId: number, guildPetId: number, expectedPetEntityId: number): Promise<boolean> {
	try {
		return await withLockedEntities(
			[
				{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
				{ model: GuildPetModel, id: guildPetId } as LockKey<GuildPetRow>
			] as const,
			async ([player, guildPet]) => {
				if (player.petId !== null || guildPet.petEntityId !== expectedPetEntityId) {
					return false;
				}
				player.petId = guildPet.petEntityId;
				await player.save();
				await guildPet.destroy();
				return true;
			}
		);
	}
	catch (err) {
		// Concurrent destroy under lock manifests as a row-not-found
		// error: that contender lost the race. Production maps this
		// to `CommandPetTransferSituationChangedErrorPacket`.
		if (err instanceof LockedRowNotFoundError) {
			return false;
		}
		throw err;
	}
}

describe("pet transfer race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe withdrawers BOTH end up adopting the same pet",
		async () => {
			// Two guild members race to withdraw the same shelter slot.
			await PlayerModel.create({ id: 1, petId: null });
			await PlayerModel.create({ id: 2, petId: null });
			await GuildPetModel.create({ id: 100, petEntityId: 7 });

			const results = await Promise.all([
				withdrawPetUnsafe(1, 100),
				withdrawPetUnsafe(2, 100)
			]);

			const [player1, player2, guildPet] = await Promise.all([
				PlayerModel.findByPk(1),
				PlayerModel.findByPk(2),
				GuildPetModel.findByPk(100)
			]);
			// Both reported "withdrew successfully"…
			expect(results).toEqual([true, true]);
			// …and BOTH players ended up adopting pet 7. The shelter
			// row is gone, but the same pet entity is now referenced
			// by two players: the duplication bug.
			expect(player1?.petId).toBe(7);
			expect(player2?.petId).toBe(7);
			expect(guildPet).toBeNull();
		}
	);

	it(
		"FIXES the bug: locked withdrawers serialise — only one player adopts the pet",
		async () => {
			await PlayerModel.create({ id: 11, petId: null });
			await PlayerModel.create({ id: 12, petId: null });
			await GuildPetModel.create({ id: 200, petEntityId: 7 });

			const results = await Promise.all([
				withdrawPetLocked(11, 200, 7),
				withdrawPetLocked(12, 200, 7)
			]);

			// Exactly one of the two withdrawers succeeded; the other
			// found the guild_pet row already destroyed (or
			// reassigned) under the lock and returned false.
			const successCount = results.filter(success => success).length;
			expect(successCount).toBe(1);

			const [player11, player12, guildPet] = await Promise.all([
				PlayerModel.findByPk(11),
				PlayerModel.findByPk(12),
				GuildPetModel.findByPk(200)
			]);
			// Exactly ONE player got the pet; the other still has none.
			const adopters = [player11?.petId, player12?.petId].filter(petId => petId === 7);
			expect(adopters).toHaveLength(1);
			expect(guildPet).toBeNull();
		}
	);

	it(
		"FIXES the bug: distinct shelter slots can be withdrawn in parallel",
		async () => {
			await PlayerModel.create({ id: 21, petId: null });
			await PlayerModel.create({ id: 22, petId: null });
			await GuildPetModel.create({ id: 301, petEntityId: 71 });
			await GuildPetModel.create({ id: 302, petEntityId: 72 });

			const results = await Promise.all([
				withdrawPetLocked(21, 301, 71),
				withdrawPetLocked(22, 302, 72)
			]);

			expect(results).toEqual([true, true]);
			const [player21, player22] = await Promise.all([
				PlayerModel.findByPk(21), PlayerModel.findByPk(22)
			]);
			expect(player21?.petId).toBe(71);
			expect(player22?.petId).toBe(72);
		}
	);
});
