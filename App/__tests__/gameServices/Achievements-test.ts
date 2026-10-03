import {achievementsForFightEnd, GAME_ACHIEVEMENTS} from "@/src/gameServices/Achievements";
import type {FightEnd} from "ws-packets/src/objects/Fight";

const PVP_END: FightEnd = {
	winner: {isSelf: true, finalEnergy: 100, maxEnergy: 200},
	loser: {isSelf: false, name: "Adversaire", finalEnergy: 0, maxEnergy: 200},
	draw: false,
	turns: 4,
	maxTurns: 30
};

describe("platform achievements", () => {
	it.each([
		{label: "victory", result: PVP_END},
		{label: "defeat", result: {...PVP_END, winner: {...PVP_END.winner, isSelf: false}, loser: {...PVP_END.loser, isSelf: true}}},
		{label: "draw", result: {...PVP_END, draw: true}}
	])("unlocks the first PvP achievement after a $label", ({result}) => {
		expect(achievementsForFightEnd(result)).toEqual([GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]);
	});

	it.each(["winner", "loser"] as const)("does not unlock it when the %s is a monster", participant => {
		const result = {...PVP_END, [participant]: {...PVP_END[participant], monsterId: "island_boss"}};
		expect(achievementsForFightEnd(result)).toEqual([]);
	});

	it("does not unlock it for a result that does not involve the player", () => {
		expect(achievementsForFightEnd({...PVP_END, winner: {...PVP_END.winner, isSelf: false}})).toEqual([]);
	});
});