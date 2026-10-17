import {
	CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { PersonalFightDailySummary } from "../../core/database/logs/LogsReadRequests";
import { FightController } from "../../core/fights/FightController";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { FightRewardPacket } from "../../../../Lib/src/packets/fights/FightRewardPacket";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { PostFightPetLoveOutcomes } from "../../../../Lib/src/constants/PetConstants";
import { BlessingManager } from "../../core/blessings/BlessingManager";

export type FightInitiatorInformation = {
	playerDailyFightSummary: PersonalFightDailySummary;
	initiatorGameResult: number;
	initiatorPlayer: Player;
};

/**
 * Calculate the money reward for the initiator of the fight
 * @param fightInitiatorInformation Information about the fight initiator
 * @param response Packet response array
 * @returns The amount of money rewarded
 */
export async function calculateMoneyReward(
	fightInitiatorInformation: FightInitiatorInformation,
	response: CrowniclesPacket[]
): Promise<number> {
	const winMoneyReward = fightInitiatorInformation.initiatorPlayer.getLeague().getFightWinMoneyReward();

	// Determine the bonus to reward based on a game result
	const bonusByResult = {
		[EloGameResult.WIN]: winMoneyReward,
		[EloGameResult.DRAW]: FightConstants.REWARDS.DRAW_MONEY_BONUS,
		[EloGameResult.LOSS]: FightConstants.REWARDS.LOSS_MONEY_BONUS
	};

	let extraMoneyBonus = bonusByResult[fightInitiatorInformation.initiatorGameResult as EloGameResult];

	// Calculate already awarded money
	const summary = fightInitiatorInformation.playerDailyFightSummary;
	const lossCount = summary.played - (summary.draw + summary.won);

	const alreadyAwardedMoney =
		summary.won * winMoneyReward
		+ summary.draw * FightConstants.REWARDS.DRAW_MONEY_BONUS
		+ lossCount * FightConstants.REWARDS.LOSS_MONEY_BONUS;
	const maxMoneyBonus = winMoneyReward * FightConstants.REWARDS.MAX_REWARDED_WINS;

	// Apply cap to money rewards if necessary
	if (alreadyAwardedMoney > maxMoneyBonus) {
		extraMoneyBonus = Math.max(
			maxMoneyBonus - (alreadyAwardedMoney - extraMoneyBonus),
			0
		);
	}

	// Apply fight loot blessing multiplier
	extraMoneyBonus = Math.round(extraMoneyBonus * BlessingManager.getInstance().getFightLootMultiplier());

	await fightInitiatorInformation.initiatorPlayer.addMoney({
		amount: extraMoneyBonus,
		response,
		reason: NumberChangeReason.FIGHT
	});

	return BlessingManager.getInstance().applyMoneyBlessing(extraMoneyBonus);
}

/**
 * Calculate the score reward for the initiator of the fight
 * @param fightInitiatorInformation
 * @param response
 */
export async function calculateScoreReward(fightInitiatorInformation: FightInitiatorInformation, response: CrowniclesPacket[]): Promise<number> {
	if (fightInitiatorInformation.initiatorGameResult !== EloGameResult.WIN || fightInitiatorInformation.playerDailyFightSummary.won > FightConstants.REWARDS.NUMBER_OF_WIN_THAT_AWARD_SCORE_BONUS) {
		return 0;
	}

	/*
	 * Award extra score points only to the initiator for one of his first wins of the day.
	 * Apply fight loot blessing multiplier
	 */
	const scoreBonus = Math.round(FightConstants.REWARDS.SCORE_BONUS_AWARD * BlessingManager.getInstance().getFightLootMultiplier());

	await fightInitiatorInformation.initiatorPlayer.addScore({
		amount: scoreBonus,
		response,
		reason: NumberChangeReason.FIGHT
	});

	return Math.round(scoreBonus * BlessingManager.getInstance().getScoreMultiplier());
}

/**
 * Get the game result for initiator based on fight outcome
 */
export function getGameResultFromFight(fight: FightController): {
	initiatorResult: EloGameResult;
	defenderResult: EloGameResult;
	isDraw: boolean;
} {
	const isDraw = fight.isADraw();
	const winnerFighter = fight.getWinnerFighter();

	if (isDraw) {
		return {
			initiatorResult: EloGameResult.DRAW,
			defenderResult: EloGameResult.DRAW,
			isDraw: true
		};
	}

	const initiatorWon = winnerFighter === fight.fightInitiator;
	return {
		initiatorResult: initiatorWon ? EloGameResult.WIN : EloGameResult.LOSS,
		defenderResult: initiatorWon ? EloGameResult.LOSS : EloGameResult.WIN,
		isDraw: false
	};
}

/**
 * Handle pet love change after a fight victory
 */
export async function handlePostFightPetLove(
	fight: FightController,
	response: CrowniclesPacket[]
): Promise<FightRewardPacket["petLoveChange"]> {
	const winnerFighter = fight.getWinnerFighter();
	const petLoveResult = fight.getPostFightPetLoveChange(winnerFighter, PostFightPetLoveOutcomes.WIN);

	if (!petLoveResult || !(winnerFighter instanceof PlayerFighter)) {
		return undefined;
	}

	const petEntity = winnerFighter.pet;
	if (!petEntity) {
		return undefined;
	}

	await petEntity.changeLovePoints({
		player: winnerFighter.player,
		response,
		amount: petLoveResult.loveChange,
		reason: NumberChangeReason.FIGHT
	});
	await petEntity.save({ fields: ["lovePoints"] });

	return {
		keycloakId: winnerFighter.player.keycloakId,
		loveChange: petLoveResult.loveChange,
		reactionType: petLoveResult.reactionType,
		petId: petEntity.typeId,
		petSex: petEntity.sex,
		petNickname: petEntity.nickname
	};
}
