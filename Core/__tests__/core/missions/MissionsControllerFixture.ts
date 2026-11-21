import {
	afterEach, beforeAll, beforeEach, vi
} from "vitest";
import {
	Model, Sequelize
} from "sequelize";
import Player, { initModel as initPlayer } from "../../../src/core/database/game/models/Player";
import MissionSlot, {
	initModel as initMissionSlot, MissionSlots
} from "../../../src/core/database/game/models/MissionSlot";
import PlayerMissionsInfo, {
	initModel as initPlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import DailyMission, {
	DailyMissions, initModel as initDailyMission
} from "../../../src/core/database/game/models/DailyMission";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { Campaign } from "../../../src/core/missions/Campaign";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { setCrowniclesInstanceForTests } from "../../../src/app";
import { Crownicles } from "../../../src/core/bot/Crownicles";
import { IMission } from "../../../src/core/missions/IMission";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "../../../../Lib/src/packets/events/MissionsExpiredPacket";
import { CompletedMission } from "../../../../Lib/src/types/CompletedMission";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace
} from "../../../../Lib/src/locks/CLSNamespace";
import { Effect } from "../../../../Lib/src/types/Effect";

/*
 * Models bound to a Sequelize instance that never connects: `build()` gives real instances (change tracking, toJSON...)
 * while every query (save, destroy...) is stubbed by the tests
 */
const sequelize = new Sequelize({
	dialect: "mariadb",
	logging: false
});
initPlayer(sequelize);
initMissionSlot(sequelize);
initPlayerMissionsInfo(sequelize);
initDailyMission(sequelize);

export const PLAYER_ID = 42;

export const KEYCLOAK_ID = "keycloak-42";

type AfterCommitCallback = () => unknown;

export type FakeTransaction = {
	afterCommit: (callback: AfterCommitCallback) => void;
};

/**
 * Run `body` as `withLockedEntities` would: inside a transaction bound to the CLS namespace, whose `afterCommit`
 * callbacks run once the body resolved and are dropped when it throws (rollback)
 */
export async function runInFakeTransaction<R>(body: () => Promise<R>): Promise<R> {
	const callbacks: AfterCommitCallback[] = [];
	const transaction: FakeTransaction = {
		afterCommit: (callback): void => {
			callbacks.push(callback);
		}
	};
	const namespace = getCrowniclesNamespace();
	const result = await namespace.runAndReturn(async () => {
		namespace.set(CLS_TRANSACTION_KEY, transaction);
		return await body();
	});
	for (const callback of callbacks) {
		await callback();
	}
	return result;
}

/**
 * Mark the instance as persisted, as a successful query would
 */
function markSaved<M extends Model>(instance: M): M {
	for (const field of instance.changed() || []) {
		instance.changed(field as keyof M, false);
	}
	return instance;
}

export function buildPlayer(values: Partial<{
	level: number;
	experience: number;
	money: number;
	score: number;
	weeklyScore: number;
	class: number;
	health: number;
}> = {}): Player {
	return markSaved(Player.build({
		id: PLAYER_ID,
		keycloakId: KEYCLOAK_ID,
		level: 10,
		experience: 0,
		money: 0,
		score: 0,
		weeklyScore: 0,
		class: 0,
		health: 100,
		effectId: Effect.NO_EFFECT.id,
		...values
	}, { isNewRecord: false }));
}

export type MissionSlotValues = {
	id?: number;
	missionId: string;
	missionVariant?: number;
	missionObjective: number;
	numberDone?: number;
	expiresAt?: Date | null;
	saveBlob?: Buffer | null;
	gemsToWin?: number;
	xpToWin?: number;
	pointsToWin?: number;
	moneyToWin?: number;
};

const IN_ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function buildMissionSlot(values: MissionSlotValues): MissionSlot {
	return markSaved(MissionSlot.build({
		id: 1,
		playerId: PLAYER_ID,
		missionVariant: 0,
		numberDone: 0,
		expiresAt: new Date(Date.now() + IN_ONE_DAY_MS),
		saveBlob: null,
		gemsToWin: 0,
		xpToWin: 0,
		pointsToWin: 0,
		moneyToWin: 0,
		...values
	}, { isNewRecord: false }));
}

export function buildMissionInfo(values: Partial<{
	gems: number;
	dailyMissionNumberDone: number;
	dailyMissionBlob: Buffer | null;
	lastDailyMissionCompleted: Date | null;
	campaignBlob: string;
}> = {}): PlayerMissionsInfo {
	return markSaved(PlayerMissionsInfo.build({
		playerId: PLAYER_ID,
		gems: 0,
		dailyMissionNumberDone: 0,
		dailyMissionBlob: null,
		lastDailyMissionCompleted: null,
		campaignBlob: "0",
		...values
	}, { isNewRecord: false }));
}

export function buildDailyMission(values: Partial<{
	missionId: string;
	missionVariant: number;
	missionObjective: number;
	gemsToWin: number;
	xpToWin: number;
	pointsToWin: number;
	moneyToWin: number;
}> = {}): DailyMission {
	return DailyMission.build({
		id: 0,
		missionId: "earnMoney",
		missionVariant: 0,
		missionObjective: 3,
		gemsToWin: 0,
		xpToWin: 0,
		pointsToWin: 0,
		moneyToWin: 0,
		lastDate: new Date(),
		...values
	}, { isNewRecord: false });
}

/**
 * Stub the queries of the models used by the mission update: saving marks the instance as persisted
 */
export function stubModelQueries(): {
	playerSave: ReturnType<typeof vi.spyOn>;
	missionSlotSave: ReturnType<typeof vi.spyOn>;
	missionSlotDestroy: ReturnType<typeof vi.spyOn>;
	missionInfoSave: ReturnType<typeof vi.spyOn>;
} {
	return {
		playerSave: vi.spyOn(Player.prototype, "save").mockImplementation(function(this: Player) {
			return Promise.resolve(markSaved(this));
		}),
		missionSlotSave: vi.spyOn(MissionSlot.prototype, "save").mockImplementation(function(this: MissionSlot) {
			return Promise.resolve(markSaved(this));
		}),
		missionSlotDestroy: vi.spyOn(MissionSlot.prototype, "destroy").mockResolvedValue(undefined),
		missionInfoSave: vi.spyOn(PlayerMissionsInfo.prototype, "save").mockImplementation(function(this: PlayerMissionsInfo) {
			return Promise.resolve(markSaved(this));
		})
	};
}

export const SCORE_MULTIPLIER = 1.5;

export const MONEY_BLESSING_MULTIPLIER = 2;

export const DAY_MS = 24 * 60 * 60 * 1000;

type RewardCall = {
	amount: number;
	reason: NumberChangeReason;
	response: CrowniclesPacket[];
};

type LogMock = ReturnType<typeof vi.fn>;

/**
 * State of a mission update: the rows handed by the lock, the mission slots and daily mission they own, and what the
 * update granted. Reset before each test
 */
export type MissionsControllerHarness = {
	locked: {
		player: Player;
		missionInfo: PlayerMissionsInfo;
	};
	missionSlots: MissionSlot[];
	campaignSlot: MissionSlot | null;
	campaignMissions: CompletedMission[];
	dailyMission: DailyMission;
	dailyMissionMultiplier: number;
	queries: ReturnType<typeof stubModelQueries>;
	rewards: {
		experience: RewardCall[];
		money: RewardCall[];
		score: RewardCall[];
		gems: { amount: number; keycloakId: string; reason: NumberChangeReason }[];
	};
	logs: {
		logMissionFinished: LogMock;
		logMissionDailyFinished: LogMock;
		logMissionFailed: LogMock;
		logMissionFound: LogMock;
	};
};

export type MissionsControllerMocks = {
	withLockedEntities: ReturnType<typeof vi.fn>;
	importCompiledFolderExports: ReturnType<typeof vi.fn>;
};

/**
 * Register the hooks running the mission updates against the harness: the test file must mock `withLockedEntities`
 * and `importCompiledFolderExports` with the given mocks
 * @param mocks
 * @param missionInterfaces interfaces discovered by `loadMissionInterfaces`, keyed by mission id
 */
export function setupMissionsControllerHarness(mocks: MissionsControllerMocks, missionInterfaces: Record<string, IMission>): MissionsControllerHarness {
	const harness = {} as MissionsControllerHarness;

	beforeAll(async () => {
		mocks.importCompiledFolderExports.mockImplementation((_folder: string, getExport: (module: { missionInterface: IMission }) => IMission) =>
			Promise.resolve(new Map(Object.entries(missionInterfaces).map(([id, missionInterface]) => [id, getExport({ missionInterface })]))));
		await MissionsController.loadMissionInterfaces();
	});

	beforeEach(() => {
		Object.assign(harness, {
			locked: {
				player: buildPlayer(),
				missionInfo: buildMissionInfo()
			},
			missionSlots: [],
			campaignSlot: null,
			campaignMissions: [],
			dailyMission: buildDailyMission({ missionId: "dailyOnly" }),
			dailyMissionMultiplier: 1,
			queries: stubModelQueries(),
			rewards: {
				experience: [], money: [], score: [], gems: []
			},
			logs: {
				logMissionFinished: vi.fn().mockResolvedValue(undefined),
				logMissionDailyFinished: vi.fn().mockResolvedValue(undefined),
				logMissionFailed: vi.fn().mockResolvedValue(undefined),
				logMissionFound: vi.fn().mockResolvedValue(undefined)
			}
		});
		// The mission update only reaches the bot through its logs database: a partial one is enough
		setCrowniclesInstanceForTests({ logsDatabase: harness.logs } as unknown as Crownicles);

		mocks.withLockedEntities.mockImplementation((_keys: unknown, body: (entities: [Player, PlayerMissionsInfo]) => Promise<Player>) =>
			runInFakeTransaction(() => body([harness.locked.player, harness.locked.missionInfo])));
		vi.spyOn(DailyMissions, "getOrGenerate").mockImplementation(() => Promise.resolve(harness.dailyMission));
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockImplementation(() => Promise.resolve(harness.locked.missionInfo));
		vi.spyOn(MissionSlots, "getOfPlayer").mockImplementation(() => Promise.resolve(harness.missionSlots));
		vi.spyOn(MissionSlots, "getCampaignOfPlayer").mockImplementation(() => Promise.resolve(harness.campaignSlot as MissionSlot));
		vi.spyOn(Campaign, "updatePlayerCampaign").mockImplementation(completed => Promise.resolve(completed ? harness.campaignMissions : []));
		vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue([]);
		// Only the blessings read by the mission rewards are used
		vi.spyOn(BlessingManager, "getInstance").mockReturnValue({
			getScoreMultiplier: () => SCORE_MULTIPLIER,
			applyMoneyBlessing: (amount: number) => amount * MONEY_BLESSING_MULTIPLIER,
			getDailyMissionMultiplier: () => harness.dailyMissionMultiplier
		} as unknown as BlessingManager);
		vi.spyOn(Player.prototype, "addExperience").mockImplementation(function(this: Player, parameters) {
			harness.rewards.experience.push(parameters);
			return Promise.resolve(this);
		});
		vi.spyOn(Player.prototype, "addMoney").mockImplementation(function(this: Player, parameters) {
			harness.rewards.money.push(parameters);
			return Promise.resolve(this);
		});
		vi.spyOn(Player.prototype, "addScore").mockImplementation(function(this: Player, parameters) {
			harness.rewards.score.push(parameters);
			return Promise.resolve(this);
		});
		vi.spyOn(PlayerMissionsInfo.prototype, "addGems").mockImplementation(function(this: PlayerMissionsInfo, amount, keycloakId, reason) {
			harness.rewards.gems.push({
				amount, keycloakId, reason
			});
			this.gems += amount;
			return Promise.resolve();
		});
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.restoreAllMocks();
		mocks.withLockedEntities.mockReset();
	});

	return harness;
}

export function completedPackets(response: CrowniclesPacket[]): MissionsCompletedPacket[] {
	return response.filter((packet): packet is MissionsCompletedPacket => packet instanceof MissionsCompletedPacket);
}

export function expiredPackets(response: CrowniclesPacket[]): MissionsExpiredPacket[] {
	return response.filter((packet): packet is MissionsExpiredPacket => packet instanceof MissionsExpiredPacket);
}
