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
import { FightAlterationState } from "../../../../Lib/src/types/FightAlterationResult";
import { PetAssistanceState } from "../../../../Lib/src/types/PetAssistanceResult";
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
	function historyOf(result: Parameters<FightView["addActionToHistory"]>[3]): CommandFightHistoryItemPacket {
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

	it("splits the stat changes, alterations and damages between the fighter and its opponent", () => {
		const packet = historyOf({
			attackStatus: FightActionStatus.CRITICAL,
			damages: 80,
			buffs: [
				{
					selfTarget: false, stat: FightStatBuffed.ATTACK, value: 0.8, operator: FightStatModifierOperation.MULTIPLIER
				},
				{
					selfTarget: false, stat: FightStatBuffed.BREATH, value: -2, operator: FightStatModifierOperation.ADDITION
				},
				{
					selfTarget: true, stat: FightStatBuffed.DEFENSE, value: 1.3, operator: FightStatModifierOperation.MULTIPLIER
				},
				{
					selfTarget: true, stat: FightStatBuffed.ENERGY, value: 25, operator: FightStatModifierOperation.ADDITION
				},
				{
					selfTarget: true, stat: FightStatBuffed.DAMAGE, value: 15, operator: FightStatModifierOperation.ADDITION
				},
				{
					selfTarget: false, stat: FightStatBuffed.SPEED, value: 10, operator: FightStatModifierOperation.ADDITION
				}
			],
			alterations: [{
				selfTarget: false, alteration: "poisoned"
			}, {
				selfTarget: true, alteration: "full"
			}]
		});

		expect(packet).toMatchObject({
			fightActionId: "summonAttack",
			monsterId: "goblin",
			status: FightActionStatus.CRITICAL,
			customMessage: false,
			fightActionEffectDealt: {
				attack: -20, breath: -2, newAlteration: "poisoned", damages: 80
			},
			fightActionEffectReceived: {
				defense: 30, energy: 25, newAlteration: "full", damages: 15
			}
		});
		// An added speed is not displayed as a change in %
		expect(packet.fightActionEffectDealt?.speed).toBeUndefined();
		expect(packet.usedFightActionId).toBeUndefined();
	});

	it("describes the action actually used when another one was selected", () => {
		const packet = historyOf({
			attackStatus: FightActionStatus.NORMAL,
			damages: 0,
			usedAction: {
				id: "simpleAttack",
				result: {
					attackStatus: FightActionStatus.MISSED, damages: 5
				}
			}
		} as FightActionResult);

		expect(packet).toMatchObject({
			fightActionId: "summonAttack",
			usedFightActionId: "simpleAttack",
			status: FightActionStatus.MISSED,
			fightActionEffectDealt: { damages: 5 }
		});
	});

	it("reports the state of an alteration with its speed change", () => {
		const packet = historyOf({
			state: FightAlterationState.ACTIVE,
			buffs: [{
				selfTarget: true, stat: FightStatBuffed.SPEED, value: 0.5, operator: FightStatModifierOperation.MULTIPLIER
			}]
		});

		expect(packet.status).toBe(FightAlterationState.ACTIVE);
		expect(packet.fightActionEffectReceived?.speed).toBe(-50);
		expect(packet.pet).toBeUndefined();
	});

	it("shows the pet of a player whose action is a pet assistance, and only then", () => {
		const response: CommandFightHistoryItemPacket[] = [];
		const view = new FightView({} as PacketContext, {
			id: "fight", isSilentMode: (): boolean => false
		} as FightController);
		const player = buildPlayerFighter<PlayerFighter>("initiator", true);

		view.addActionToHistory(response, player, { id: "petAssistance" } as FightAction, {
			assistanceStatus: PetAssistanceState.SUCCESS, damages: 10
		});
		view.addActionToHistory(response, player, { id: "simpleAttack" } as FightAction, {
			attackStatus: FightActionStatus.NORMAL, damages: 10
		});

		expect(response.map(packet => [packet.fighterKeycloakId, packet.status, packet.pet])).toEqual([
			["initiator", PetAssistanceState.SUCCESS, ownedPet],
			["initiator", FightActionStatus.NORMAL, undefined]
		]);
	});

	it("tells no summoning for an attack without summoned allies", () => {
		const packet = historyOf({
			attackStatus: FightActionStatus.NORMAL, damages: 40
		});

		expect(packet.fightActionEffectDealt?.summoning).toBeUndefined();
	});
});
