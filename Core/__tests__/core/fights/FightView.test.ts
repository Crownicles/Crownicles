import {
	describe, expect, it, vi
} from "vitest";
import { FightView } from "../../../src/core/fights/FightView";
import { FightController } from "../../../src/core/fights/FightController";
import { MonsterFighter } from "../../../src/core/fights/fighter/MonsterFighter";
import { PlayerFighter } from "../../../src/core/fights/fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../src/core/fights/fighter/AiPlayerFighter";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

const ownedPet = { typeId: 1 };

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, callback: typeof capturedEndCallback) {
			capturedEndCallback = callback;
		}

		build(): unknown {
			return {};
		}
	}
}));

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

describe("FightView.displayFightActionMenu timeout", () => {
	function buildTimeoutFixture(hadEnded: boolean): {
		playerFighter: PlayerFighter; endFight: ReturnType<typeof vi.fn>;
	} {
		const endFight = vi.fn().mockResolvedValue(undefined);
		const controller = {
			id: "fight",
			getDefendingFighter: (): MonsterFighter => buildMonsterFighter(),
			hadEnded: (): boolean => hadEnded,
			endFight
		} as unknown as FightController;
		const playerFighter = {
			player: { keycloakId: "initiator" },
			kill: vi.fn()
		} as unknown as PlayerFighter;
		new FightView({} as PacketContext, controller).displayFightActionMenu([], playerFighter, new Map());
		return {
			playerFighter, endFight
		};
	}

	it("does not kill the player nor end the fight again when the fight already ended", async () => {
		const { playerFighter, endFight } = buildTimeoutFixture(true);

		await capturedEndCallback!({ getFirstReaction: () => undefined }, []);

		expect(playerFighter.kill).not.toHaveBeenCalled();
		expect(endFight).not.toHaveBeenCalled();
	});

	it("kills the player and ends the fight as a defeat when no reaction was given and the fight is still running", async () => {
		const { playerFighter, endFight } = buildTimeoutFixture(false);

		await capturedEndCallback!({ getFirstReaction: () => undefined }, []);

		expect(playerFighter.kill).toHaveBeenCalledTimes(1);
		expect(endFight).toHaveBeenCalledWith([], false);
	});
});
