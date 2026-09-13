import {afterEach, describe, expect, it} from "vitest";
import {FightController} from "../../../src/core/fights/FightController";
import {FightsManager} from "../../../src/core/fights/FightsManager";
import {FightOvertimeBehavior} from "../../../src/core/fights/FightOvertimeBehavior";
import {FightState} from "../../../src/core/fights/FightState";
import {PlayerFighter} from "../../../src/core/fights/fighter/PlayerFighter";
import {AiPlayerFighter} from "../../../src/core/fights/fighter/AiPlayerFighter";
import {Player} from "../../../src/core/database/game/models/Player";
import {ClassDataController} from "../../../src/data/Class";
import {CrowniclesPacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {CommandFightIntroduceFightersPacket} from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import {CommandFightStatusPacket} from "../../../../Lib/src/packets/fights/FightStatusPacket";

const active: FightController[] = [];
function createFight(silent = false): FightController {
	const player = {keycloakId: "initiator", class: 1, level: 10, getGloryPoints: (): number => 100} as Player;
	const opponent = {keycloakId: "defender", class: 1, level: 10, getGloryPoints: (): number => 100} as Player;
	const playerClass = ClassDataController.instance.getById(1)!;
	const fighter1 = new PlayerFighter(player, playerClass);
	const fighter2 = new AiPlayerFighter(opponent, playerClass);
	fighter1.setBaseEnergy(100);
	fighter2.setBaseEnergy(100);
	const fight = new FightController({fighter1, fighter2}, {
		overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
		context: {keycloakId: player.keycloakId, frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}},
		silentMode: silent
	});
	Reflect.set(fight, "state", FightState.RUNNING);
	active.push(fight);
	return fight;
}

describe("fight resume", () => {
	afterEach(() => {for (const fight of active.splice(0)) FightsManager.unregisterFight(fight.id);});
	it("only restores the initiator's public active fight without progressing a turn", () => {
		const fight = createFight();
		expect(FightsManager.getActiveFightOf("defender")).toBeNull();
		expect(FightsManager.getActiveFightOf("outsider")).toBeNull();
		const resumed = FightsManager.getActiveFightOf("initiator")!;
		const response: CrowniclesPacket[] = [];
		resumed.sendCurrentState(response);
		expect(response).toEqual([
			expect.any(CommandFightIntroduceFightersPacket), expect.any(CommandFightStatusPacket)
		]);
		expect(response).toContainEqual(expect.objectContaining({fightId: fight.id, numberOfTurn: 1}));
		expect(response).toContainEqual(expect.objectContaining({activeFighter: expect.objectContaining({classId: 1, level: 10})}));
		expect(fight.turn).toBe(1);
	});
	it("does not restore silent simulations or finished fights", () => {
		createFight(true);
		expect(FightsManager.getActiveFightOf("initiator")).toBeNull();
		const fight = createFight();
		Reflect.set(fight, "state", FightState.FINISHED);
		expect(FightsManager.getActiveFightOf("initiator")).toBeNull();
		const response: CrowniclesPacket[] = [];
		fight.sendCurrentState(response);
		expect(response).toEqual([]);
	});
});
