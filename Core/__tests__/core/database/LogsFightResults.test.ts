import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { LogsDatabase } from "../../../src/core/database/logs/LogsDatabase";
import { Players } from "../../../src/core/database/game/models/Player";
import { LogsFightsResults } from "../../../src/core/database/logs/models/LogsFightsResults";
import { AiPlayerFighter } from "../../../src/core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../../src/core/fights/FightController";

const INITIATOR_LOG_ID = 11;
const DEFENDER_LOG_ID = 22;
const FIGHT_LOG_ID = 99;

/**
 * Build a finished fight, won by its initiator, between two players without any action used
 * @param friendly
 */
function buildFinishedFight(friendly: boolean): FightController {
	const fightInitiator = {
		player: {
			id: 1, keycloakId: "initiator", score: 100, class: 2
		},
		pet: null,
		fightActionsHistory: []
	};
	const defender = Object.assign(Object.create(AiPlayerFighter.prototype), {
		player: {
			id: 2, keycloakId: "defender", score: 200, class: 3
		},
		pet: null,
		fightActionsHistory: []
	});
	return {
		fightInitiator,
		friendly,
		turn: 12,
		getNonFightInitiatorFighter: () => defender,
		getWinnerFighter: () => fightInitiator,
		isADraw: () => false
	} as unknown as FightController;
}

describe("LogsDatabase.logFight", () => {
	const logs = Object.create(LogsDatabase.prototype) as LogsDatabase;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(LogsDatabase, "findOrCreatePlayer").mockImplementation(keycloakId => Promise.resolve({
			id: keycloakId === "initiator" ? INITIATOR_LOG_ID : DEFENDER_LOG_ID
		} as never));
		vi.spyOn(Players, "getById").mockResolvedValue({
			attackGloryPoints: 1000, defenseGloryPoints: 900
		} as never);
		vi.spyOn(LogsFightsResults, "create").mockResolvedValue({ id: FIGHT_LOG_ID } as never);
	});

	it.each([true, false])("persists the friendly flag of the fight (friendly: %s)", async friendly => {
		const fightId = await logs.logFight(buildFinishedFight(friendly));

		expect(fightId).toBe(FIGHT_LOG_ID);
		expect(LogsFightsResults.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
			fightInitiatorId: INITIATOR_LOG_ID,
			player2Id: DEFENDER_LOG_ID,
			winner: 1,
			friendly
		}));
	});
});
