import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import { QueryInterface } from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	down, up
} from "../../src/core/database/game/migrations/075-onboarding-campaign-reorder";
import { CampaignData } from "../../src/data/Campaign";

const CAMPAIGN_LENGTH = 149;

type Row = {
	campaignProgression: number;
	campaignBlob: string;
	missionId: string;
	missionVariant: number;
	numberDone: number;
};

let env: IntegrationTestEnvironment;

function context(): QueryInterface {
	return env.sequelize.getQueryInterface();
}

function blob(prefix: string): string {
	return prefix.padEnd(CAMPAIGN_LENGTH, "0");
}

async function insertPlayer(id: number, player: { level: number; classId: number; progression: number; blob: string; slot: { missionId: string; missionVariant: number; numberDone: number } }): Promise<void> {
	await env.sequelize.query(`INSERT INTO players (id, level, class) VALUES (${id}, ${player.level}, ${player.classId})`);
	await env.sequelize.query(`INSERT INTO player_missions_info (playerId, campaignProgression, campaignBlob) VALUES (${id}, ${player.progression}, '${player.blob}')`);
	await env.sequelize.query(`INSERT INTO mission_slots (playerId, missionId, missionVariant, missionObjective, numberDone, gemsToWin, xpToWin, moneyToWin, saveBlob, expiresAt)
		VALUES (${id}, '${player.slot.missionId}', ${player.slot.missionVariant}, 1, ${player.slot.numberDone}, 1, 10, 0, 'saved', NULL)`);
}

async function row(id: number): Promise<Row> {
	const [rows] = await env.sequelize.query(`
		SELECT pmi.campaignProgression, pmi.campaignBlob, ms.missionId, ms.missionVariant, ms.numberDone
		FROM player_missions_info pmi JOIN mission_slots ms ON ms.playerId = pmi.playerId AND ms.expiresAt IS NULL
		WHERE pmi.playerId = ${id}
	`);
	return rows[0] as Row;
}

describe("075-onboarding-campaign-reorder migration", () => {
	beforeAll(async () => {
		env = await setupIntegrationDb("campaign_reorder");
		await env.sequelize.query("CREATE TABLE players (id INT PRIMARY KEY, level INT NOT NULL, class INT NOT NULL)");
		await env.sequelize.query("CREATE TABLE player_missions_info (playerId INT PRIMARY KEY, campaignProgression INT NOT NULL, campaignBlob VARCHAR(255) NOT NULL)");
		await env.sequelize.query(`CREATE TABLE mission_slots (id INT AUTO_INCREMENT PRIMARY KEY, playerId INT NOT NULL, missionId TEXT, missionVariant INT, missionObjective INT,
			numberDone INT, gemsToWin INT, xpToWin INT, moneyToWin INT, saveBlob TEXT, expiresAt DATETIME NULL)`);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		for (const table of ["players", "player_missions_info", "mission_slots"]) {
			await env.sequelize.query(`DELETE FROM ${table}`);
		}
	});

	it("sends a newcomer who already consulted the missions back to its first report", async () => {
		await insertPlayer(1, {
			level: 1, classId: 0, progression: 2, blob: blob("1"), slot: { missionId: "commandReport", missionVariant: 0, numberDone: 0 }
		});
		await up({ context: context() });
		const result = await row(1);
		expect(result.campaignBlob.slice(0, 3)).toBe("010");
		expect(result.campaignProgression).toBe(1);
		expect(result.missionId).toBe("commandReport");
	});

	it("moves a player waiting on level 5 to the item it has not found yet, keeping every completion", async () => {
		await insertPlayer(2, {
			level: 3, classId: 0, progression: 5, blob: blob("1111"), slot: { missionId: "reachLevel", missionVariant: 0, numberDone: 3 }
		});
		await up({ context: context() });
		const result = await row(2);
		expect(result.campaignBlob.split("1").length - 1).toBe(4);
		expect(result.campaignProgression).toBe(4);
		expect(result.missionId).toBe("findOrBuyItem");
		expect(result.numberDone).toBe(0);
	});

	it("keeps the progress of a player whose current mission stays the first one left", async () => {
		await insertPlayer(3, {
			level: 1, classId: 0, progression: 3, blob: blob("11"), slot: { missionId: "earnMoney", missionVariant: 0, numberDone: 60 }
		});
		await up({ context: context() });
		const result = await row(3);
		expect(result.campaignProgression).toBe(3);
		expect(result.missionId).toBe("earnMoney");
		expect(result.numberDone).toBe(60);
	});

	it("starts a level-driven mission from the player's current level", async () => {
		// Everything but reachLevel 5 (previous position 5) and what follows the class is done.
		await insertPlayer(4, {
			level: 7, classId: 2, progression: 5, blob: blob("1111011111111110"), slot: { missionId: "reachLevel", missionVariant: 0, numberDone: 4 }
		});
		await up({ context: context() });
		const result = await row(4);
		expect(result.campaignProgression).toBe(13);
		expect(result.missionId).toBe("reachLevel");
		expect(result.numberDone).toBe(7);
	});

	it("leaves players past the reordered missions untouched", async () => {
		const veteran = blob("1111111111111111111101");
		await insertPlayer(5, {
			level: 40, classId: 3, progression: 21, blob: veteran, slot: { missionId: "anyFight", missionVariant: 0, numberDone: 0 }
		});
		await up({ context: context() });
		const result = await row(5);
		expect(result.campaignBlob).toBe(veteran);
		expect(result.campaignProgression).toBe(21);
		expect(result.missionId).toBe("anyFight");
	});

	it("points every reordered player at the mission campaign.json now holds at its position", async () => {
		await insertPlayer(6, {
			level: 2, classId: 0, progression: 4, blob: blob("111"), slot: { missionId: "travelHours", missionVariant: 1, numberDone: 0 }
		});
		await up({ context: context() });
		const result = await row(6);
		const expected = CampaignData.getMissions()[result.campaignProgression - 1];
		expect(result.missionId).toBe(expected.missionId);
		expect(result.missionVariant).toBe(expected.missionVariant);
	});

	it("is undone by down()", async () => {
		const before = blob("1111");
		await insertPlayer(7, {
			level: 3, classId: 0, progression: 5, blob: before, slot: { missionId: "reachLevel", missionVariant: 0, numberDone: 3 }
		});
		await up({ context: context() });
		await down({ context: context() });
		const result = await row(7);
		expect(result.campaignBlob).toBe(before);
		expect(result.campaignProgression).toBe(5);
		expect(result.missionId).toBe("reachLevel");
		expect(result.numberDone).toBe(3);
	});
});
