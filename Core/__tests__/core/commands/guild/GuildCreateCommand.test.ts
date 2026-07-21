import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import GuildCreateCommand from "../../../../src/commands/guild/GuildCreateCommand";
import {
	Guild, Guilds
} from "../../../../src/core/database/game/models/Guild";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../../src/core/database/game/models/PlayerMissionsInfo";
import { LogsDatabase } from "../../../../src/core/database/logs/LogsDatabase";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { BlockingUtils } from "../../../../src/core/utils/BlockingUtils";
import { ReactionCollectorInstance } from "../../../../src/core/utils/ReactionsCollector";
import { withLockedEntities } from "../../../../../Lib/src/locks/withLockedEntities";
import { GuildCreateConstants } from "../../../../../Lib/src/constants/GuildCreateConstants";

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: {
			NOT_STARTED_OR_DEAD: []
		}
	}
}));
vi.mock("../../../../src/core/database/game/models/Player", () => ({
	Player: {
		lockKey: vi.fn()
	}
}));
vi.mock("../../../../src/core/database/game/models/Guild");
vi.mock("../../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	default: {
		lockKey: vi.fn()
	},
	PlayerMissionsInfos: {
		getOfPlayer: vi.fn()
	}
}));
vi.mock("../../../../src/core/database/logs/LogsDatabase", () => ({
	LogsDatabase: {
		logGuildCreation: vi.fn()
	}
}));
vi.mock("../../../../src/core/missions/MissionsController", () => ({
	MissionsController: {
		update: vi.fn()
	}
}));
vi.mock("../../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		unblockPlayer: vi.fn()
	}
}));
vi.mock("../../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, callback: typeof capturedEndCallback) {
			capturedEndCallback = callback;
		}

		block(): this {
			return this;
		}

		build(): this {
			return this;
		}
	}
}));
vi.mock("../../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));
vi.mock("../../../../../Lib/src/packets/CrowniclesPacket", () => ({
	CrowniclesPacket: class {},
	PacketContext: class {},
	PacketDirection: {
		NONE: 0,
		FRONT_TO_BACK: 1,
		BACK_TO_FRONT: 2
	},
	sendablePacket: () => () => {},
	makePacket: vi.fn((PacketType, data) => ({
		type: PacketType.name,
		data
	}))
}));
vi.mock("../../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate", () => ({
	ReactionCollectorGuildCreate: class {}
}));

describe("GuildCreateCommand", () => {
	const player = {
		id: 12,
		keycloakId: "player-keycloak-id",
		guildId: null,
		money: GuildCreateConstants.PRICE,
		spendMoney: vi.fn(),
		save: vi.fn()
	};
	const newGuild = {
		id: 34,
		level: 0,
		updateLastDailyAt: vi.fn(),
		save: vi.fn()
	};

	beforeEach(() => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		player.guildId = null;
		player.money = GuildCreateConstants.PRICE;
		player.spendMoney.mockImplementation(async () => {
			player.guildId = null;
		});
		vi.mocked(Guilds.getByName).mockResolvedValue(null);
		vi.mocked(Guild.create).mockResolvedValue(newGuild as never);
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue(null as never);
		vi.mocked(LogsDatabase.logGuildCreation).mockResolvedValue();
		vi.mocked(MissionsController.update).mockResolvedValue(undefined as never);
		vi.mocked(withLockedEntities).mockImplementation(async (_keys, callback) => await callback([player] as never));
	});

	it("credits the initial treasury when the guild creation is accepted", async () => {
		await new GuildCreateCommand().execute([], player as never, {
			askedGuildName: "Guild test"
		} as never, {} as never);

		if (!capturedEndCallback) {
			throw new Error("Expected guild creation collector callback to be set");
		}
		await capturedEndCallback({
			getFirstReaction: () => ({
				reaction: {
					type: "ReactionCollectorAcceptReaction"
				}
			})
		}, []);

		expect(Guild.create).toHaveBeenCalledWith({
			name: "Guild test",
			chiefId: player.id,
			treasury: GuildCreateConstants.INITIAL_TREASURY
		});
		expect(player.guildId).toBe(newGuild.id);
		expect(player.spendMoney.mock.invocationCallOrder[0])
			.toBeLessThan(player.save.mock.invocationCallOrder[0]);
	});
});