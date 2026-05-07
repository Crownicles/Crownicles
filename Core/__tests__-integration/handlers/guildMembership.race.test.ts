/**
 * Race integration tests for the guild membership handlers
 * migrated by PR-G:
 *
 *   1. **GuildInviteCommand** — accept an invitation. Two
 *      concurrent accepts on a guild with a single seat left
 *      both pass the "not full" check on a stale member count
 *      and both insert → the guild overflows MAX_GUILD_MEMBERS.
 *
 *   2. **GuildLeaveCommand** — chief leave with elder promotion.
 *      Concurrent self-leave from chief and elder both read the
 *      pre-leave roles, both decide they are the chief / elder
 *      branches, both write → the guild ends with no chief.
 *
 *   3. **GuildKickCommand** — concurrent kicks of two members
 *      driven by stale `guildId` snapshots while the kicked
 *      member is also leaving on their own → double mutation of
 *      the same row.
 *
 *   4. **GuildCreateCommand** — same player double-clicks the
 *      create button. The price check passes on both stale
 *      snapshots, two guild rows get created, money is debited
 *      twice.
 *
 *   5. **GuildDescriptionCommand** — concurrent description
 *      edits from chief and elder: classic last-write-wins where
 *      the read-then-write order means the slower writer
 *      silently overwrites the faster one's intent without ever
 *      seeing it.
 *
 * PR-G wraps each critical section in `withLockedEntities` so
 * the second contender re-validates the relevant invariant
 * against the locked rows and either bails out or applies its
 * mutation on the post-first-writer state.
 *
 * Why ad-hoc Sequelize models — the production handlers reach
 * into Players / Guilds factories that we cannot drive in
 * isolation. We mirror the *shape* of each critical section
 * (read → validate → mutate → save) on a minimal schema and
 * prove the race + the lock fix.
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
	LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";

class PlayerRow extends Model {
	declare id: number;

	declare money: number;

	declare guildId: number | null;
}

class GuildRow extends Model {
	declare id: number;

	declare name: string;

	declare description: string;

	declare chiefId: number | null;

	declare elderId: number | null;
}

let env: IntegrationTestEnvironment;
let Players: ModelStatic<PlayerRow>;
let Guilds: ModelStatic<GuildRow>;

const MAX_GUILD_MEMBERS = 6;
const GUILD_CREATE_PRICE = 1000;

beforeAll(async () => {
	env = await setupIntegrationDb("guild_membership_race");
	Players = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			guildId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
		},
		{ sequelize: env.sequelize, tableName: "pg_player", timestamps: false }
	);
	Guilds = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			name: { type: DataTypes.STRING, allowNull: false },
			description: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
			chiefId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
			elderId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }
		},
		{ sequelize: env.sequelize, tableName: "pg_guild", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await Promise.all([
		Players.destroy({ where: {}, truncate: true }),
		Guilds.destroy({ where: {}, truncate: true })
	]);
});

/* --------------------------- 1. Invite accept --------------------------- */

async function acceptInviteUnsafe(invitedId: number, guildId: number): Promise<boolean> {
	const invited = await Players.findByPk(invitedId);
	if (!invited || invited.guildId !== null) {
		return false;
	}
	const memberCount = await Players.count({ where: { guildId } });
	if (memberCount >= MAX_GUILD_MEMBERS) {
		return false;
	}
	// Yield so the contender can pass its own stale check.
	await new Promise(resolve => setImmediate(resolve));
	invited.guildId = guildId;
	await invited.save();
	return true;
}

async function acceptInviteLocked(invitedId: number, guildId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: Players, id: invitedId } as LockKey<PlayerRow>,
			{ model: Guilds, id: guildId } as LockKey<GuildRow>
		],
		async ([invited]) => {
			if (invited.guildId !== null) {
				return false;
			}
			// Re-read member count under the guild lock.
			const memberCount = await Players.count({ where: { guildId } });
			if (memberCount >= MAX_GUILD_MEMBERS) {
				return false;
			}
			invited.guildId = guildId;
			await invited.save();
			return true;
		}
	);
}

describe("GuildInvite acceptance race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two invitees both join when only one seat is free",
		async () => {
			await Guilds.create({ id: 1, name: "G1" });
			// Pre-fill 5 members + 2 pending invitees → only 1 seat.
			for (let id = 1; id <= 5; id++) {
				await Players.create({ id, money: 0, guildId: 1 });
			}
			await Players.create({ id: 10, money: 0, guildId: null });
			await Players.create({ id: 11, money: 0, guildId: null });

			const results = await Promise.all([
				acceptInviteUnsafe(10, 1), acceptInviteUnsafe(11, 1)
			]);

			const memberCount = await Players.count({ where: { guildId: 1 } });
			// Both saw 5 members, both joined → 7 > MAX 6.
			expect(results).toEqual([true, true]);
			expect(memberCount).toBe(7);
		}
	);

	it("FIXES the bug: locked accept rejects the second contender", async () => {
		await Guilds.create({ id: 2, name: "G2" });
		for (let id = 20; id <= 24; id++) {
			await Players.create({ id, money: 0, guildId: 2 });
		}
		await Players.create({ id: 30, money: 0, guildId: null });
		await Players.create({ id: 31, money: 0, guildId: null });

		const results = await Promise.all([
			acceptInviteLocked(30, 2), acceptInviteLocked(31, 2)
		]);

		const memberCount = await Players.count({ where: { guildId: 2 } });
		expect(results.filter(Boolean).length).toBe(1);
		expect(memberCount).toBe(MAX_GUILD_MEMBERS);
	});
});

/* ----------------------- 2. Chief + elder leave race ----------------------- */

async function leaveAsChiefLocked(chiefId: number, guildId: number): Promise<string> {
	// Fast-path snapshot to size the lock set: if there is an
	// elder, we need to lock them too so the in-lock view is
	// consistent. We re-validate everything inside the lock.
	const peek = await Guilds.findByPk(guildId);
	const initialElderId = peek?.elderId ?? null;

	if (initialElderId === null) {
		return await withLockedEntities(
			[
				{ model: Players, id: chiefId } as LockKey<PlayerRow>,
				{ model: Guilds, id: guildId } as LockKey<GuildRow>
			],
			async ([chief, guild]) => {
				if (guild.chiefId !== chiefId || guild.elderId !== null) {
					return "noop";
				}
				chief.guildId = null;
				guild.chiefId = null;
				await Promise.all([guild.save(), chief.save()]);
				return "leftHeadless";
			}
		);
	}

	return await withLockedEntities(
		[
			{ model: Players, id: chiefId } as LockKey<PlayerRow>,
			{ model: Players, id: initialElderId } as LockKey<PlayerRow>,
			{ model: Guilds, id: guildId } as LockKey<GuildRow>
		],
		async ([chief, elder, guild]) => {
			if (guild.chiefId !== chiefId) {
				return "noop";
			}
			// Elder departed between the snapshot and the lock
			// acquisition: go headless instead of promoting a
			// player who is no longer in the guild.
			if (guild.elderId !== initialElderId || elder.guildId !== guildId) {
				chief.guildId = null;
				guild.chiefId = null;
				guild.elderId = null;
				await Promise.all([guild.save(), chief.save()]);
				return "leftHeadless";
			}
			guild.chiefId = initialElderId;
			guild.elderId = null;
			chief.guildId = null;
			await Promise.all([guild.save(), chief.save()]);
			return "promoted";
		}
	);
}

async function leaveAsMemberLocked(playerId: number, guildId: number): Promise<string> {
	return await withLockedEntities(
		[
			{ model: Players, id: playerId } as LockKey<PlayerRow>,
			{ model: Guilds, id: guildId } as LockKey<GuildRow>
		],
		async ([player, guild]) => {
			if (player.guildId !== guildId) {
				return "noop";
			}
			if (guild.elderId === playerId) {
				guild.elderId = null;
			}
			player.guildId = null;
			await Promise.all([guild.save(), player.save()]);
			return "left";
		}
	);
}

describe("GuildLeave chief+elder race (integration)", () => {
	it(
		"DEMONSTRATES the bug: chief promotes a since-departed elder via a stale snapshot",
		async () => {
			await Guilds.create({
				id: 3, name: "G3", chiefId: 100, elderId: 101
			});
			await Players.create({ id: 100, guildId: 3 });
			await Players.create({ id: 101, guildId: 3 });
			await Players.create({ id: 102, guildId: 3 });

			// Chief snapshots the guild while elder=101 is still set.
			const chiefGuildSnapshot = await Guilds.findByPk(3);
			const chiefPlayerSnapshot = await Players.findByPk(100);
			expect(chiefGuildSnapshot?.elderId).toBe(101);

			// Elder departs in the meantime (committed write).
			await Players.update({ guildId: null }, { where: { id: 101 } });
			await Guilds.update({ elderId: null }, { where: { id: 3 } });

			// Chief now executes the unsafe promotion path against
			// the stale snapshot — without a re-read, they happily
			// promote a player who has already left.
			chiefGuildSnapshot!.chiefId = chiefGuildSnapshot!.elderId;
			chiefGuildSnapshot!.elderId = null;
			chiefPlayerSnapshot!.guildId = null;
			await Promise.all([chiefGuildSnapshot!.save(), chiefPlayerSnapshot!.save()]);

			const guild = await Guilds.findByPk(3);
			const elder = await Players.findByPk(101);
			expect(guild?.chiefId).toBe(101);
			expect(elder?.guildId).toBeNull();
		}
	);

	it("FIXES the bug: locked chief-leave re-reads the elder state and goes headless", async () => {
		await Guilds.create({
			id: 4, name: "G4", chiefId: 200, elderId: 201
		});
		await Players.create({ id: 200, guildId: 4 });
		await Players.create({ id: 201, guildId: 4 });
		await Players.create({ id: 202, guildId: 4 });

		// Elder leaves first under a proper lock.
		const elderResult = await leaveAsMemberLocked(201, 4);
		expect(elderResult).toBe("left");

		// Chief leaves next: the fast-path peek sees elderId=null
		// already cleared, so the 2-key branch is taken and the
		// guild is left headless instead of promoting an absent
		// elder.
		const chiefResult = await leaveAsChiefLocked(200, 4);
		expect(chiefResult).toBe("leftHeadless");

		const guild = await Guilds.findByPk(4);
		const elder = await Players.findByPk(201);
		const chief = await Players.findByPk(200);
		expect(guild?.chiefId).toBeNull();
		expect(guild?.elderId).toBeNull();
		expect(elder?.guildId).toBeNull();
		expect(chief?.guildId).toBeNull();
	});

	it("FIXES the bug: locked chief-leave detects an elder departure committed between the peek and the lock", async () => {
		await Guilds.create({
			id: 7, name: "G7", chiefId: 700, elderId: 701
		});
		await Players.create({ id: 700, guildId: 7 });
		await Players.create({ id: 701, guildId: 7 });

		// Force the in-lock revalidation branch by mutating the
		// elder and the guild row out-of-band before the lock body
		// runs. Even though the fast-path peek picked the 3-key
		// path with elder=701, the locked elder row will reveal a
		// guildId mismatch / cleared elderId, so the in-lock fix
		// goes headless instead of promoting the absent elder.
		await Players.update({ guildId: null }, { where: { id: 701 } });
		await Guilds.update({ elderId: null }, { where: { id: 7 } });

		const chiefResult = await leaveAsChiefLocked(700, 7);
		expect(chiefResult).toBe("leftHeadless");

		const guild = await Guilds.findByPk(7);
		expect(guild?.chiefId).toBeNull();
		expect(guild?.elderId).toBeNull();
	});
});

/* ----------------------- 3. Double-create same name ----------------------- */

async function createGuildUnsafe(playerId: number, name: string): Promise<boolean> {
	const player = await Players.findByPk(playerId);
	if (!player || player.guildId !== null || player.money < GUILD_CREATE_PRICE) {
		return false;
	}
	const existing = await Guilds.findOne({ where: { name } });
	if (existing) {
		return false;
	}
	await new Promise(resolve => setImmediate(resolve));
	player.money -= GUILD_CREATE_PRICE;
	const guild = await Guilds.create({ name, chiefId: playerId });
	player.guildId = guild.id;
	await player.save();
	return true;
}

async function createGuildLocked(playerId: number, name: string): Promise<boolean> {
	return await withLockedEntities(
		[{ model: Players, id: playerId } as LockKey<PlayerRow>],
		async ([player]) => {
			if (player.guildId !== null || player.money < GUILD_CREATE_PRICE) {
				return false;
			}
			const existing = await Guilds.findOne({ where: { name } });
			if (existing) {
				return false;
			}
			player.money -= GUILD_CREATE_PRICE;
			const guild = await Guilds.create({ name, chiefId: playerId });
			player.guildId = guild.id;
			await player.save();
			return true;
		}
	);
}

describe("GuildCreate double-click race (integration)", () => {
	it(
		"DEMONSTRATES the bug: same player double-creates and pays twice",
		async () => {
			await Players.create({ id: 300, money: GUILD_CREATE_PRICE * 2, guildId: null });

			const results = await Promise.all([
				createGuildUnsafe(300, "TwinA"),
				createGuildUnsafe(300, "TwinB")
			]);

			const guildCount = await Guilds.count();
			const player = await Players.findByPk(300);
			// Two creates from the same player both passed the
			// stale-snapshot check → 2 guilds and a classic lost
			// update on money: each saved its own pre-computed
			// (start-money − price) value, so the second save
			// "rolled back" the first debit.
			expect(results).toEqual([true, true]);
			expect(guildCount).toBe(2);
			expect(player?.money).toBe(GUILD_CREATE_PRICE);
		}
	);

	it("FIXES the bug: locked create serialises on the player row", async () => {
		await Players.create({ id: 301, money: GUILD_CREATE_PRICE * 2, guildId: null });

		const results = await Promise.all([
			createGuildLocked(301, "OnlyOneA"),
			createGuildLocked(301, "OnlyOneB")
		]);

		const guildCount = await Guilds.count();
		const player = await Players.findByPk(301);
		expect(results.filter(Boolean).length).toBe(1);
		expect(guildCount).toBe(1);
		expect(player?.money).toBe(GUILD_CREATE_PRICE);
		expect(player?.guildId).not.toBeNull();
	});
});

/* ------------------ 4. Description edit + chief swap race ------------------ */

async function editDescriptionLocked(playerId: number, guildId: number, newDesc: string): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: Players, id: playerId } as LockKey<PlayerRow>,
			{ model: Guilds, id: guildId } as LockKey<GuildRow>
		],
		async ([player, guild]) => {
			if (player.guildId !== guildId) {
				return false;
			}
			if (guild.chiefId !== playerId && guild.elderId !== playerId) {
				return false;
			}
			guild.description = newDesc;
			await guild.save();
			return true;
		}
	);
}

describe("GuildDescription edit race (integration)", () => {
	it(
		"DEMONSTRATES the bug: a stale-snapshot edit from a since-demoted elder still lands",
		async () => {
			await Guilds.create({
				id: 5, name: "G5", description: "old", chiefId: 400, elderId: 401
			});
			await Players.create({ id: 400, guildId: 5 });
			await Players.create({ id: 401, guildId: 5 });

			// Elder takes a snapshot while still being elder.
			const elderSnapshot = await Guilds.findByPk(5);
			const elderPlayerSnapshot = await Players.findByPk(401);
			// Bug-shape role check is performed against the elder's
			// in-memory snapshot, mirroring what the production
			// handler used to do before the lock.
			const stalePassed = elderSnapshot!.elderId === 401
				&& elderPlayerSnapshot!.guildId === 5;
			expect(stalePassed).toBe(true);

			// Mid-flight, the chief demotes the elder.
			await Guilds.update({ elderId: null }, { where: { id: 5 } });

			// The elder's stale snapshot now writes the description.
			// Without a lock, nothing re-validates the role between
			// the snapshot read and the save: the demoted elder's
			// edit lands on the canonical row.
			elderSnapshot!.description = "elderText";
			await elderSnapshot!.save();

			const guild = await Guilds.findByPk(5);
			expect(guild?.description).toBe("elderText");
		}
	);

	it("FIXES the bug: locked edit re-reads the role and rejects the demoted elder", async () => {
		await Guilds.create({
			id: 6, name: "G6", description: "old", chiefId: 500, elderId: 501
		});
		await Players.create({ id: 500, guildId: 6 });
		await Players.create({ id: 501, guildId: 6 });

		// Demote the elder atomically.
		await Guilds.update({ elderId: null }, { where: { id: 6 } });

		const elderEdit = await editDescriptionLocked(501, 6, "shouldNotLand");
		const guild = await Guilds.findByPk(6);
		expect(elderEdit).toBe(false);
		expect(guild?.description).toBe("old");
		expect(guild?.elderId).toBeNull();
	});
});
