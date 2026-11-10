import {
	describe, expect, it
} from "vitest";
import { rankKingGuardChallengers } from "../../../../src/core/fights/kingGuards/KingGuardStats";
import { KingGuardVictory } from "../../../../src/core/database/logs/requests/LogsKingGuardFightsRequests";

function victory(keycloakId: string, guardId: number, firstDate: number, firstFightId = firstDate): KingGuardVictory {
	return {
		keycloakId, guardId, firstDate, firstFightId
	};
}

describe("rankKingGuardChallengers", () => {
	it("keeps for each player the guard with the highest rating today among the ones it beat, and ranks the players by it", () => {
		const victories = [
			victory("alice", 1, 100),
			victory("alice", 2, 200),
			victory("bob", 3, 150)
		];
		const glories = new Map([[1, 1800], [2, 1500], [3, 1700]]);

		const challengers = rankKingGuardChallengers(victories, glories);

		expect(challengers.map(challenger => [challenger.keycloakId, challenger.guardId])).toEqual([["alice", 1], ["bob", 3]]);
	});

	it("changes the best guard of a player and the ranking when the ratings of the guards move, without the players fighting", () => {
		const victories = [
			victory("alice", 1, 100),
			victory("alice", 2, 200),
			victory("bob", 3, 150)
		];

		const challengers = rankKingGuardChallengers(victories, new Map([[1, 1400], [2, 1600], [3, 1700]]));

		expect(challengers.map(challenger => [challenger.keycloakId, challenger.guardId])).toEqual([["bob", 3], ["alice", 2]]);
	});

	it("ranks first the player who beat its best guard first, the id of the fight breaking the ties within the same second", () => {
		const victories = [
			victory("late", 1, 300),
			victory("sameSecondLater", 1, 100, 12),
			victory("sameSecondFirst", 1, 100, 11)
		];

		const challengers = rankKingGuardChallengers(victories, new Map([[1, 1500]]));

		expect(challengers.map(challenger => challenger.keycloakId)).toEqual(["sameSecondFirst", "sameSecondLater", "late"]);
	});

	it("leaves out the guards it has no rating for", () => {
		const challengers = rankKingGuardChallengers([victory("alice", 99, 100)], new Map([[1, 1500]]));

		expect(challengers).toEqual([]);
	});
});
