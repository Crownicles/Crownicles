import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import { KingGuardState } from "../../core/database/game/models/KingGuardState";
import { FightController } from "../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { KingGuardFighter } from "../../core/fights/fighter/KingGuardFighter";
import { buildKingGuard } from "../../core/fights/kingGuards/KingGuardLibrary";
import {
	getPlayerGuardGlory, pickKingGuard
} from "../../core/fights/kingGuards/KingGuardMatchmaking";
import {
	computeKingGuardRatingChange, getPlayerKingGuardKFactor, KingGuardRatingChange
} from "../../core/fights/kingGuards/KingGuardRating";
import { KingGuardDataController } from "../../data/KingGuard";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { Class } from "../../data/Class";
import { crowniclesInstance } from "../../app";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { LogsKingGuardFightsRequests } from "../../core/database/logs/requests/LogsKingGuardFightsRequests";
import { KingGuardFightRewardPacket } from "../../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	calculateMoneyReward, calculateScoreReward, getGameResultFromFight, handlePostFightPetLove
} from "./FightRewards";

type KingGuardFightResult = {
	playerResult: EloGameResult;
	playerKFactor: number;
};

/**
 * Update the hidden ratings of a player and of the guard it fought, count the guard's record, and count the fight
 * in the activity of the player like a ranked fight
 */
async function applyKingGuardFightResultUnderLock(
	player: Locked<Player>,
	guard: Locked<KingGuardState>,
	result: KingGuardFightResult
): Promise<KingGuardRatingChange> {
	const change = computeKingGuardRatingChange({
		player: getPlayerGuardGlory(player),
		guard: guard.glory
	}, result.playerResult, result.playerKFactor);
	player.guardGloryPoints = change.playerGuardGlory + change.playerGuardGloryChange;
	player.fightCountdown = Math.max(0, player.fightCountdown - 1);
	guard.glory = change.guardGlory + change.guardGloryChange;
	if (result.playerResult === EloGameResult.WIN) {
		guard.losses++;
	}
	else if (result.playerResult === EloGameResult.LOSS) {
		guard.wins++;
	}
	else {
		guard.draws++;
	}
	await Promise.all([player.save(), guard.save()]);
	return change;
}

/**
 * Apply the result of a fight against a king guard. The player and the guard are locked together: several players may fight
 * the same guard at the same time
 * @returns The ratings before the fight and their change, null when the player or the guard vanished
 */
export async function applyKingGuardFightResult(ids: {
	playerId: number;
	guardId: number;
}, result: KingGuardFightResult): Promise<KingGuardRatingChange | null> {
	try {
		return await withLockedEntities(
			[Player.lockKey(ids.playerId), KingGuardState.lockKey(ids.guardId)] as const,
			([player, guard]) => applyKingGuardFightResultUnderLock(player, guard, result)
		);
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(`kingGuardFightEndCallback: locked row vanished for player ${ids.playerId} or guard ${ids.guardId}, ratings not updated`);
			return null;
		}
		throw e;
	}
}

/**
 * Reward the player after a fight against a king guard: money, score and pet love like a ranked fight, but no glory.
 * The hidden ratings of the player and of the guard change, and the fight counts in the activity of the player.
 * Energy and missions are handled by the player fighter at the end of the fight.
 * @param fight
 * @param guard
 * @param response
 */
export async function kingGuardFightEndCallback(fight: FightController, guard: KingGuardFighter, response: CrowniclesPacket[]): Promise<void> {
	const gameResults = getGameResultFromFight(fight);
	const playerId = fight.fightInitiator.player.id;
	const ratingChange = await applyKingGuardFightResult({
		playerId,
		guardId: guard.guardData.id
	}, {
		playerResult: gameResults.initiatorResult,
		playerKFactor: getPlayerKingGuardKFactor(await LogsKingGuardFightsRequests.countRatedFights(fight.fightInitiator.player.keycloakId))
	});
	await crowniclesInstance?.logsDatabase.logKingGuardFight(fight, guard, ratingChange);

	// Read after the ratings update, which owns the rating and the fight countdown of the player
	const initiatorPlayer = await Players.getById(playerId);
	const fightInitiatorInfo = {
		playerDailyFightSummary: await LogsReadRequests.getPersonalInitiatedFightDailySummary(initiatorPlayer.keycloakId),
		initiatorGameResult: gameResults.initiatorResult,
		initiatorPlayer
	};

	const points = await calculateScoreReward(fightInitiatorInfo, response);
	const money = await calculateMoneyReward(fightInitiatorInfo, response);
	const petLoveChange = gameResults.isDraw ? undefined : await handlePostFightPetLove(fight, response);

	response.push(makePacket(KingGuardFightRewardPacket, {
		points,
		money,
		draw: gameResults.isDraw,
		won: gameResults.initiatorResult === EloGameResult.WIN,
		guard: {
			id: guard.guardData.id,
			sex: guard.guardData.sex
		},
		...petLoveChange ? { petLoveChange } : {}
	}));
}

/**
 * Start a fight against a king guard of the library chosen for the player, used when no real opponent is available
 * @param fighter The player, its class and the id of the guard to fight if it is forced (test command)
 * @param context
 * @param response
 */
export async function startKingGuardFight(fighter: {
	player: Player;
	playerClass: Class;
	guardId?: number;
}, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const {
		player, playerClass
	} = fighter;
	const askingFighter = new PlayerFighter(player, playerClass);
	askingFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
	await askingFighter.loadStats();

	const guardData = fighter.guardId === undefined
		? await pickKingGuard(player)
		: KingGuardDataController.instance.getById(fighter.guardId)!;
	const guardFighter = new KingGuardFighter(buildKingGuard(guardData, player.level));
	await guardFighter.loadStats();

	const fightController = new FightController(
		{
			fighter1: askingFighter,
			fighter2: guardFighter
		},
		{
			overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
			context
		}
	);
	fightController.setEndCallback((fight, endResponse) => kingGuardFightEndCallback(fight, guardFighter, endResponse));
	await fightController.startFight(response);
}
