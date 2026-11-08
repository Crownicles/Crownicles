import {
	describe, expect, it
} from "vitest";
import { FightView } from "../../../src/core/fights/FightView";
import { FightController } from "../../../src/core/fights/FightController";
import { MonsterFighter } from "../../../src/core/fights/fighter/MonsterFighter";
import { PlayerFighter } from "../../../src/core/fights/fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../src/core/fights/fighter/AiPlayerFighter";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

const ownedPet = { typeId: 1 };

function buildPlayerFighter<T extends PlayerFighter | AiPlayerFighter>(keycloakId: string, withPet: boolean): T {
	return {
		player: { keycloakId },
		availableFightActions: new Map([["simpleAttack", { breath: 2 }], ["heavyAttack", { breath: 5 }]]),
		pet: withPet ? { asOwnedPet: (): unknown => ownedPet } : undefined
	} as unknown as T;
}

function buildMonsterFighter(): MonsterFighter {
	return Object.assign(Object.create(MonsterFighter.prototype) as MonsterFighter, {
		monster: { id: "goblin" },
		availableFightActions: new Map([["bite", { breath: 1 }]])
	});
}

function introduce(controller: Partial<FightController>, opponent: MonsterFighter | AiPlayerFighter, initiatorHasPet = false): CommandFightIntroduceFightersPacket {
	const response: CommandFightIntroduceFightersPacket[] = [];
	new FightView({} as PacketContext, {
		id: "fight", friendly: false, ...controller
	} as FightController)
		.introduceFight(response, buildPlayerFighter<PlayerFighter>("initiator", initiatorHasPet), opponent);
	return response[0];
}

describe("FightView.introduceFight", () => {
	it("introduces a monster opponent with the breath cost of every action", () => {
		const packet = introduce({}, buildMonsterFighter(), true);

		expect(packet).toMatchObject({
			fightId: "fight",
			fightInitiatorKeycloakId: "initiator",
			fightOpponentMonsterId: "goblin",
			fightInitiatorActions: [["simpleAttack", 2], ["heavyAttack", 5]],
			fightOpponentActions: [["bite", 1]],
			fightInitiatorPet: ownedPet,
			friendly: false
		});
		expect(packet.fightOpponentKeycloakId).toBeUndefined();
		expect(packet.fightOpponentPet).toBeUndefined();
		expect(packet.levelCap).toBeUndefined();
	});

	it("introduces a player opponent with its pet and the friendly fight level cap", () => {
		const packet = introduce({
			friendly: true, levelCap: 100
		}, buildPlayerFighter<AiPlayerFighter>("opponent", true));

		expect(packet).toMatchObject({
			fightOpponentKeycloakId: "opponent",
			fightOpponentPet: ownedPet,
			friendly: true,
			levelCap: 100
		});
		expect(packet.fightOpponentMonsterId).toBeUndefined();
		expect(packet.fightInitiatorPet).toBeUndefined();
	});
});
