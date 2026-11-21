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
import { CommandFightHistoryItemPacket } from "../../../../Lib/src/packets/fights/FightHistoryItemPacket";
import {
	FightActionResult, FightStatBuffed
} from "../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../Lib/src/types/FightStatModifierOperation";
import { FightActionStatus } from "../../../../Lib/src/types/FightActionStatus";
import type { FightAction } from "../../../src/data/FightAction";

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

describe("FightView.addActionToHistory", () => {
	function historyOf(result: FightActionResult): CommandFightHistoryItemPacket {
		const response: CommandFightHistoryItemPacket[] = [];
		new FightView({} as PacketContext, {
			id: "fight", isSilentMode: (): boolean => false
		} as FightController)
			.addActionToHistory(response, buildMonsterFighter(), { id: "summonAttack" } as FightAction, result);
		return response[0];
	}

	it("tells how many allies a monster summoned to attack", () => {
		const packet = historyOf({
			attackStatus: FightActionStatus.NORMAL,
			damages: 120,
			buffs: [{
				selfTarget: true, stat: FightStatBuffed.SUMMON, value: 7, operator: FightStatModifierOperation.MULTIPLIER
			}]
		});

		expect(packet.fightActionEffectDealt).toMatchObject({
			damages: 120, summoning: 7
		});
	});

	it("tells no summoning for an attack without summoned allies", () => {
		const packet = historyOf({
			attackStatus: FightActionStatus.NORMAL, damages: 40
		});

		expect(packet.fightActionEffectDealt?.summoning).toBeUndefined();
	});
});
