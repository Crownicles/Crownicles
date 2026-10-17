import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import { FightController } from "../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { KingGuardFighter } from "../../core/fights/fighter/KingGuardFighter";
import { generateKingGuard } from "../../core/fights/kingGuards/KingGuardGenerator";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { Class } from "../../data/Class";
import { crowniclesInstance } from "../../app";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { KingGuardFightRewardPacket } from "../../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import {
	calculateMoneyReward, calculateScoreReward, getGameResultFromFight, handlePostFightPetLove
} from "./FightRewards";

/**
 * Reward the player after a fight against a king guard: money, score and pet love like a ranked fight, but no glory.
 * Energy and missions are handled by the player fighter at the end of the fight.
 * @param fight
 * @param guard
 * @param response
 */
export async function kingGuardFightEndCallback(fight: FightController, guard: KingGuardFighter, response: CrowniclesPacket[]): Promise<void> {
	await crowniclesInstance?.logsDatabase.logKingGuardFight(fight, guard);

	const initiatorPlayer = await Players.getById(fight.fightInitiator.player.id);
	const gameResults = getGameResultFromFight(fight);
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
		...petLoveChange ? { petLoveChange } : {}
	}));
}

/**
 * Start a fight against a king guard generated for the player, used when no real opponent is available
 * @param player
 * @param playerClass
 * @param context
 * @param response
 */
export async function startKingGuardFight(player: Player, playerClass: Class, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const askingFighter = new PlayerFighter(player, playerClass);
	askingFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
	await askingFighter.loadStats();

	const guardFighter = new KingGuardFighter(await generateKingGuard(player));
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
