import {
	afterEach, beforeEach, vi
} from "vitest";
import {
	Model, Sequelize
} from "sequelize";
import Player, { initModel as initPlayer } from "../../../../src/core/database/game/models/Player";
import {
	assertPlayerHasNoPendingChanges, LockedPlayerFollowUp, MissionInformations, MissionsController, PLAYER_RESYNC_CALLERS
} from "../../../../src/core/missions/MissionsController";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { Crownicles } from "../../../../src/core/bot/Crownicles";
import { BlessingManager } from "../../../../src/core/blessings/BlessingManager";
import { Effect } from "../../../../../Lib/src/types/Effect";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";

/*
 * Bound to a Sequelize instance that never connects: `build()` gives real instances (attribute setters, change
 * tracking) while every query is stubbed by the harness
 */
initPlayer(new Sequelize({
	dialect: "mariadb",
	logging: false
}));

export const PLAYER_ID = 7;

export const KEYCLOAK_ID = "keycloak-7";

export type PlayerValues = Record<string, unknown>;

type LogMock = ReturnType<typeof vi.fn>;

export const DEFAULT_PLAYER_VALUES: PlayerValues = {
	id: PLAYER_ID,
	keycloakId: KEYCLOAK_ID,
	level: 10,
	experience: 0,
	money: 0,
	score: 0,
	weeklyScore: 0,
	tokens: 0,
	rage: 0,
	class: 0,
	health: 50,
	fightPointsLost: 0,
	attackGloryPoints: 0,
	defenseGloryPoints: 0,
	guildId: null,
	effectId: Effect.NO_EFFECT.id
};

/**
 * Mark the instance as persisted, as a successful query would
 */
function markSaved<M extends Model>(instance: M): M {
	for (const field of instance.changed() || []) {
		instance.changed(field as keyof M, false);
	}
	return instance;
}

/**
 * Plug a bot whose logs database only has the given log functions
 * @param logsDatabase
 */
export function useLogsDatabase(logsDatabase: Record<string, LogMock>): void {
	// The code under test only reaches the bot through its logs database: a partial one is enough
	setCrowniclesInstanceForTests({ logsDatabase } as unknown as Crownicles);
}

export function buildPlayer(values: PlayerValues = {}): Player {
	return markSaved(Player.build({
		...DEFAULT_PLAYER_VALUES,
		...values
	}, { isNewRecord: false }));
}

/**
 * A mission progress as resolved under the lock, the way `MissionsController` hands it to the missions
 */
export type ResolvedMissionUpdate = {
	missionId: string;
	count: number;
	set: boolean;
};

/**
 * The player row of the database: the lock helpers stubbed by the harness hand a fresh instance of it, whose
 * committed values become the row, then synchronize the caller as the real helpers do
 */
export type PlayerRowHarness = {
	row: PlayerValues;
	missionUpdates: ResolvedMissionUpdate[];
	followUps: (LockedPlayerFollowUp | undefined)[];
	blessings: {
		scoreMultiplier: number;
		moneyMultiplier: number;
		rageAmplified: boolean;
	};
	logs: Record<
		"logMoneyChange" | "logScoreChange" | "logExperienceChange" | "logLevelChange" | "logTokensChange" | "logRageChange"
		| "logHealthChange" | "logEnergyChange" | "logPlayersAttackGloryPoints" | "logPlayersDefenseGloryPoints" | "logPlayerNewPet",
		LogMock
	>;

	/**
	 * Build the caller instance from the current row, optionally with stale values
	 */
	caller: (staleValues?: PlayerValues) => Player;
};

export function setupPlayerRowHarness(): PlayerRowHarness {
	const harness = {} as PlayerRowHarness;

	function lockRow(): Player {
		return buildPlayer(harness.row);
	}

	function commit(locked: Player): void {
		markSaved(locked);
		harness.row = { ...locked.get({ plain: true }) };
	}

	function applyMission(locked: Player, information: MissionInformations): void {
		information.applyOnLockedPlayer?.(locked);
		harness.missionUpdates.push({
			missionId: information.missionId,
			count: typeof information.count === "function" ? information.count(locked) : information.count ?? 1,
			set: information.set ?? false
		});
	}

	beforeEach(() => {
		Object.assign(harness, {
			row: { ...DEFAULT_PLAYER_VALUES },
			missionUpdates: [],
			followUps: [],
			blessings: {
				scoreMultiplier: 1,
				moneyMultiplier: 1,
				rageAmplified: false
			},
			logs: Object.fromEntries([
				"logMoneyChange", "logScoreChange", "logExperienceChange", "logLevelChange", "logTokensChange", "logRageChange",
				"logHealthChange", "logEnergyChange", "logPlayersAttackGloryPoints", "logPlayersDefenseGloryPoints", "logPlayerNewPet"
			].map(name => [name, vi.fn().mockResolvedValue(undefined)])),
			caller: (staleValues: PlayerValues = {}): Player => buildPlayer({
				...harness.row,
				...staleValues
			})
		});
		useLogsDatabase(harness.logs);
		// Only the blessings read by the player resources are used
		vi.spyOn(BlessingManager, "getInstance").mockReturnValue({
			getScoreMultiplier: () => harness.blessings.scoreMultiplier,
			applyMoneyBlessing: (amount: number) => (amount > 0 ? Math.round(amount * harness.blessings.moneyMultiplier) : amount),
			isRageAmplified: () => harness.blessings.rageAmplified
		} as unknown as BlessingManager);
		vi.spyOn(Player.prototype, "save").mockImplementation(function(this: Player) {
			return Promise.resolve(markSaved(this));
		});
		vi.spyOn(Player, "withLocked").mockImplementation(async (_id, body) => {
			const locked = lockRow();
			const result = await body(locked);
			commit(locked);
			return result;
		});
		vi.spyOn(MissionsController, "update").mockImplementation((player: Player, _response: CrowniclesPacket[], information: MissionInformations) => {
			assertPlayerHasNoPendingChanges(player, PLAYER_RESYNC_CALLERS.UPDATE);
			const locked = lockRow();
			applyMission(locked, information);
			commit(locked);
			return Promise.resolve(Object.assign(player, locked));
		});
		vi.spyOn(MissionsController, "updateMultiple").mockImplementation((
			player: Player,
			_response: CrowniclesPacket[],
			informations: MissionInformations[],
			followUp?: LockedPlayerFollowUp
		) => {
			assertPlayerHasNoPendingChanges(player, PLAYER_RESYNC_CALLERS.UPDATE_MULTIPLE);
			const locked = lockRow();
			for (const information of informations) {
				applyMission(locked, information);
			}
			harness.followUps.push(followUp);
			commit(locked);
			return Promise.resolve(Object.assign(player, locked));
		});
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.restoreAllMocks();
	});

	return harness;
}
