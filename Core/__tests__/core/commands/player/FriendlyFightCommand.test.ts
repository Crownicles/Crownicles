import {
	beforeEach, describe, expect, it, vi
} from "vitest";

const fighterOptions: { kind: string; options: unknown }[] = [];
const startFightMock = vi.fn();
const setEndCallbackMock = vi.fn();
const controllerOptions: unknown[] = [];
const logFightMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		ALLOWED_EFFECTS: { NO_EFFECT: [] }
	}
}));
vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: {},
	Players: { getAskedPlayer: vi.fn() }
}));
vi.mock("../../../../src/data/Class", () => ({
	ClassDataController: { instance: { getById: vi.fn().mockReturnValue({ id: 0 }) } }
}));
vi.mock("../../../../src/core/fights/fighter/PlayerFighter", () => ({
	PlayerFighter: class {
		public constructor(_player: unknown, _playerClass: unknown, options: unknown) {
			fighterOptions.push({
				kind: "player", options
			});
		}

		public setFightRole = vi.fn();

		public loadStats = vi.fn();
	}
}));
vi.mock("../../../../src/core/fights/fighter/AiPlayerFighter", () => ({
	AiPlayerFighter: class {
		public constructor(_player: unknown, _playerClass: unknown, options: unknown) {
			fighterOptions.push({
				kind: "ai", options
			});
		}

		public setFightRole = vi.fn();

		public loadStats = vi.fn();
	}
}));
vi.mock("../../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logFight: logFightMock } }
}));
vi.mock("../../../../src/core/fights/FightController", () => ({
	FightController: class {
		public constructor(_fighters: unknown, options: unknown) {
			controllerOptions.push(options);
		}

		public startFight = startFightMock;

		public setEndCallback = setEndCallbackMock;
	}
}));

import FriendlyFightCommand from "../../../../src/commands/player/FriendlyFightCommand";
import { Players } from "../../../../src/core/database/game/models/Player";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	CommandFriendlyFightErrorPacketRes, FRIENDLY_FIGHT_ERRORS
} from "../../../../../Lib/src/packets/commands/CommandFriendlyFightPacket";

describe("FriendlyFightCommand", () => {
	const player = {
		id: 1,
		class: 0
	};

	function buildOpponent(overrides: Partial<{ id: number; level: number; started: boolean }> = {}): unknown {
		const {
			id = 2, level = FightConstants.REQUIRED_LEVEL, started = true
		} = overrides;
		return {
			id,
			level,
			class: 0,
			hasStartedToPlay: (): boolean => started
		};
	}

	async function executeCommand(): Promise<unknown[]> {
		const response: unknown[] = [];
		await new FriendlyFightCommand().execute(response as never, player as never, { askedPlayer: { rank: 1 } } as never, {} as never);
		return response;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		fighterOptions.length = 0;
		controllerOptions.length = 0;
	});

	it.each([
		["the asked player does not exist", null, FRIENDLY_FIGHT_ERRORS.OPPONENT_NOT_FOUND],
		["the asked player has not started", buildOpponent({ started: false }), FRIENDLY_FIGHT_ERRORS.OPPONENT_NOT_FOUND],
		["the asked player is the initiator", buildOpponent({ id: player.id }), FRIENDLY_FIGHT_ERRORS.SELF_FIGHT],
		["the asked player cannot fight yet", buildOpponent({ level: FightConstants.REQUIRED_LEVEL - 1 }), FRIENDLY_FIGHT_ERRORS.OPPONENT_LEVEL_TOO_LOW]
	])("refuses the fight when %s", async (_label, opponent, error) => {
		vi.mocked(Players.getAskedPlayer).mockResolvedValue(opponent as never);

		const response = await executeCommand();

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandFriendlyFightErrorPacketRes);
		expect((response[0] as CommandFriendlyFightErrorPacketRes).error).toBe(error);
		expect(startFightMock).not.toHaveBeenCalled();
	});

	it("starts a consequence-free fight with both fighters capped at the friendly fight level", async () => {
		vi.mocked(Players.getAskedPlayer).mockResolvedValue(buildOpponent() as never);

		await executeCommand();

		expect(fighterOptions).toEqual([
			{
				kind: "player", options: {
					withoutConsequences: true, levelCap: FightConstants.FRIENDLY_FIGHT_LEVEL_CAP
				}
			},
			{
				kind: "ai", options: {
					allowPotionConsumption: false, withoutConsequences: true, levelCap: FightConstants.FRIENDLY_FIGHT_LEVEL_CAP
				}
			}
		]);
		expect(controllerOptions[0]).toMatchObject({
			friendly: true, levelCap: FightConstants.FRIENDLY_FIGHT_LEVEL_CAP
		});
		expect(startFightMock).toHaveBeenCalledTimes(1);
	});

	it("only logs the fight once it is over", async () => {
		vi.mocked(Players.getAskedPlayer).mockResolvedValue(buildOpponent() as never);
		const fight = { friendly: true };

		await executeCommand();

		expect(setEndCallbackMock).toHaveBeenCalledTimes(1);
		expect(logFightMock).not.toHaveBeenCalled();
		const response: unknown[] = [];
		await setEndCallbackMock.mock.calls[0][0](fight, response);
		expect(logFightMock).toHaveBeenCalledExactlyOnceWith(fight);
		expect(response).toEqual([]);
	});
});
