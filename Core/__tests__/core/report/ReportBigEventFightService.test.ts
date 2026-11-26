import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const doubles = vi.hoisted(() => ({
	fights: [] as {
		fighters: { fighter1: unknown; fighter2: { level: number; monster: { id: string } } };
		options: { overtimeBehavior: unknown; context: unknown };
		endCallback?: (fight: unknown, response: unknown[]) => Promise<void>;
		startFight: ReturnType<typeof vi.fn>;
	}[]
}));

vi.mock("../../../src/core/report/ReportDestinationService", () => ({ chooseDestination: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/data/events/PossibilityOutcome", () => ({ applyOutcomeRandomItem: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn()
}));

vi.mock("../../../src/core/fights/FightController", () => ({
	FightController: class {
		endCallback?: (fight: unknown, response: unknown[]) => Promise<void>;

		readonly startFight = vi.fn().mockResolvedValue(undefined);

		constructor(public fighters: { fighter1: unknown; fighter2: { level: number; monster: { id: string } } }, public options: { overtimeBehavior: unknown; context: unknown }) {
			doubles.fights.push(this);
		}

		setEndCallback(callback: (fight: unknown, response: unknown[]) => Promise<void>): void {
			this.endCallback = callback;
		}
	}
}));

vi.mock("../../../src/core/fights/fighter/PlayerFighter", () => ({
	PlayerFighter: class {
		readonly loadStats = vi.fn().mockResolvedValue(undefined);

		constructor(public player: unknown, public classData: unknown) {}
	}
}));

vi.mock("../../../src/core/fights/fighter/MonsterFighter", () => ({
	MonsterFighter: class {
		constructor(public level: number, public monster: { id: string }) {}
	}
}));

import {
	PendingBigEventFight, startBigEventFight
} from "../../../src/core/report/ReportBigEventFightService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerFighter } from "../../../src/core/fights/fighter/PlayerFighter";
import { FightOvertimeBehavior } from "../../../src/core/fights/FightOvertimeBehavior";
import { chooseDestination } from "../../../src/core/report/ReportDestinationService";
import { applyOutcomeRandomItem } from "../../../src/data/events/PossibilityOutcome";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { CommandReportBigEventFightResultRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Effect } from "../../../../Lib/src/types/Effect";
import { asPlayer } from "../ModelStubs";

const context = { keycloakId: "traveller" } as PacketContext;

const pending: PendingBigEventFight = {
	eventId: 11,
	possibilityId: "followHint",
	outcomeId: "8",
	fight: {
		monster: "bandit",
		level: 40,
		won: {
			money: 100, experience: 30, randomItem: {}
		},
		lost: {
			money: -150, health: -20, effect: Effect.OCCUPIED.id, lostTime: 60
		}
	},
	destination: {
		newMapLink: null, allowStayInCity: false, forceStayInCity: false
	}
};

function lockedPlayerDouble(): Record<string, unknown> {
	return {
		id: 3,
		class: 1,
		effectId: Effect.OCCUPIED.id,
		effectDuration: 60,

		// The blessing doubles the coins won: the shown amount must be the credited one
		addMoney: vi.fn((parameters: { amount: number }) => {
			parameters.amount *= parameters.amount > 0 ? 2 : 1;
			return Promise.resolve();
		}),
		addExperience: vi.fn().mockResolvedValue(undefined),
		addHealth: vi.fn().mockResolvedValue(undefined),
		setLastReportWithEffect: vi.fn().mockResolvedValue(undefined),
		killIfNeeded: vi.fn().mockResolvedValue(false),
		save: vi.fn().mockResolvedValue(undefined)
	};
}

let lockedPlayer: ReturnType<typeof lockedPlayerDouble>;

async function fightAndEnd(won: boolean): Promise<CrowniclesPacket[]> {
	await startBigEventFight(asPlayer({ id: 3, class: 1 }), pending, context, []);
	const response: CrowniclesPacket[] = [];
	await doubles.fights[0].endCallback!({
		isADraw: () => false,
		getWinnerFighter: () => (won ? new PlayerFighter(asPlayer({}), {} as never) : {})
	}, response);
	return response;
}

beforeEach(() => {
	doubles.fights.length = 0;
	lockedPlayer = lockedPlayerDouble();
	vi.spyOn(Players, "getById").mockResolvedValue(asPlayer({ id: 3 }));
	vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({} as PlayerMissionsInfo);
	vi.mocked(withLockedEntities).mockImplementation((_keys, body) => body([lockedPlayer] as never));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(chooseDestination).mockClear();
	vi.mocked(applyOutcomeRandomItem).mockClear();
	vi.mocked(withLockedEntities).mockReset();
});

describe("startBigEventFight", () => {
	it("should fight the monster of the outcome at its fixed level, like a PvE fight", async () => {
		const response: CrowniclesPacket[] = [];

		await startBigEventFight(asPlayer({ id: 3, class: 1 }), pending, context, response);

		const [fight] = doubles.fights;
		expect(fight.fighters.fighter2.level).toBe(40);
		expect(fight.fighters.fighter2.monster.id).toBe("bandit");
		expect(fight.options).toEqual({ overtimeBehavior: FightOvertimeBehavior.INCREASE_DAMAGE_PVE, context });
		expect(fight.startFight).toHaveBeenCalledWith(response);
	});

	it("should give the rewards of a won fight under the lock, show them, then let the player choose a destination", async () => {
		const response = await fightAndEnd(true);

		expect(withLockedEntities).toHaveBeenCalledWith([Player.lockKey(3), PlayerMissionsInfo.lockKey(3)], expect.any(Function));
		expect(response[0]).toBeInstanceOf(CommandReportBigEventFightResultRes);
		expect(response[0]).toMatchObject({
			eventId: 11, possibilityId: "followHint", outcomeId: "8", monsterId: "bandit", won: true, money: 200, experience: 30, health: 0
		});
		expect(lockedPlayer.addHealth).not.toHaveBeenCalled();
		expect(applyOutcomeRandomItem).toHaveBeenCalledWith(pending.fight.won, lockedPlayer, context, response);
		expect(chooseDestination).toHaveBeenCalledWith(context, lockedPlayer, null, response, {
			mainPacket: false, allowStayInCity: false, forceStayInCity: false
		});
		expect(lockedPlayer.save).toHaveBeenCalled();
	});

	it("should apply the losses of a lost fight", async () => {
		const response = await fightAndEnd(false);

		expect(response[0]).toMatchObject({
			won: false, money: -150, health: -20, experience: 0, effect: { name: Effect.OCCUPIED.id, time: 60 }
		});
		expect(lockedPlayer.setLastReportWithEffect).toHaveBeenCalledWith(60, Effect.OCCUPIED, expect.anything());
		expect(chooseDestination).toHaveBeenCalled();
	});

	it("should not choose a destination for a player the fight killed", async () => {
		vi.mocked(lockedPlayer.killIfNeeded as ReturnType<typeof vi.fn>).mockResolvedValue(true);

		await fightAndEnd(false);

		expect(chooseDestination).not.toHaveBeenCalled();
	});
});
