import {
	describe, expect, it, vi
} from "vitest";
import {
	CommandTournamentStatusPacketRes
} from "../../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentCategories, TournamentStatuses } from "../../../../../Lib/src/types/Tournament";

const mocks = vi.hoisted(() => ({
	claimTournamentReward: vi.fn(),
	findTournamentForContext: vi.fn(),
	getParticipant: vi.fn(),
	getStatusData: vi.fn(),
	registerPlayer: vi.fn()
}));

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	adminCommand: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => descriptor,
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: {
			NOT_STARTED_OR_DEAD: []
		},
		WHERE: {
			EVERYWHERE: []
		}
	}
}));

vi.mock("../../../../src/core/tournaments/TournamentQueries", () => ({
	findTournamentForContext: mocks.findTournamentForContext,
	getParticipant: mocks.getParticipant,
	getTournamentAdminMenuData: vi.fn(),
	getTournamentOwnerMenuData: vi.fn()
}));

vi.mock("../../../../src/core/tournaments/TournamentRegistration", () => ({
	registerPlayer: mocks.registerPlayer
}));

vi.mock("../../../../src/core/tournaments/TournamentRanking", () => ({
	getStatusData: mocks.getStatusData
}));

vi.mock("../../../../src/core/tournaments/TournamentRewards", () => ({
	claimTournamentReward: mocks.claimTournamentReward
}));

vi.mock("../../../../src/core/tournaments/TournamentCreation", () => ({
	createTournament: vi.fn(),
	generateTournamentCode: vi.fn()
}));

vi.mock("../../../../src/core/tournaments/TournamentPause", () => ({
	pauseTournamentForChannel: vi.fn(),
	resumeTournament: vi.fn()
}));

vi.mock("../../../../src/core/tournaments/TournamentCancellation", () => ({
	cancelTournament: vi.fn()
}));

vi.mock("../../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		errorWithObj: vi.fn()
	}
}));

import TournamentCommand from "../../../../src/commands/tournament/TournamentCommand";

function buildStatus(category?: typeof TournamentCategories[keyof typeof TournamentCategories]): Record<string, unknown> {
	return {
		tournamentId: 42,
		status: TournamentStatuses.REGISTRATION,
		levelLimitMode: "category",
		levelCap: null,
		discordGuildId: "guild-id",
		discordChannelId: "channel-id",
		registrationEndsAt: Date.now() + 86_400_000,
		combatEndsAt: Date.now() + 172_800_000,
		participantCount: category ? 1 : 0,
		categoryCounts: {
			[TournamentCategories.LEVEL_50]: category === TournamentCategories.LEVEL_50 ? 1 : 0,
			[TournamentCategories.LEVEL_100]: category === TournamentCategories.LEVEL_100 ? 1 : 0
		},
		...(category ? {
			category,
			totalGloryPoints: 1500,
			rank: 1
		} : {})
	};
}

describe("TournamentCommand player entry point", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.claimTournamentReward.mockResolvedValue(undefined);
		mocks.findTournamentForContext.mockResolvedValue({ id: 42 });
	});

	it("registers a non-participant and returns the refreshed total glory", async () => {
		mocks.getStatusData
			.mockResolvedValueOnce(buildStatus())
			.mockResolvedValueOnce(buildStatus(TournamentCategories.LEVEL_50));
		mocks.registerPlayer.mockResolvedValue({ tournamentId: 42 });

		const response: unknown[] = [];
		await TournamentCommand.status(response as never, { id: 7 } as never, {} as never, {
			frontEndSubOrigin: "guild-id",
			discord: { channel: "channel-id" }
		} as never);

		const status = response[0] as CommandTournamentStatusPacketRes;
		expect(mocks.registerPlayer).toHaveBeenCalledOnce();
		expect(mocks.getStatusData).toHaveBeenCalledTimes(2);
		expect(status.newlyRegistered).toBe(true);
		expect(status.category).toBe(TournamentCategories.LEVEL_50);
		expect(status.totalGloryPoints).toBe(1500);
		expect("attackGloryPoints" in status).toBe(false);
		expect("defenseGloryPoints" in status).toBe(false);
	});

	it("returns the participant status without attempting a second registration", async () => {
		mocks.getStatusData.mockResolvedValue(buildStatus(TournamentCategories.LEVEL_100));

		const response: unknown[] = [];
		await TournamentCommand.status(response as never, { id: 8 } as never, {} as never, {
			frontEndSubOrigin: "guild-id",
			discord: { channel: "channel-id" }
		} as never);

		const status = response[0] as CommandTournamentStatusPacketRes;
		expect(mocks.registerPlayer).not.toHaveBeenCalled();
		expect(mocks.getStatusData).toHaveBeenCalledOnce();
		expect(status.newlyRegistered).toBe(false);
		expect(status.totalGloryPoints).toBe(1500);
	});
});
