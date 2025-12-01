import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { ReactionCollectorFight } from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandFightNotEnoughEnergyPacketRes,
	CommandFightOpponentsNotFoundPacket,
	CommandFightPacketReq,
	CommandFightRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandFightPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import {
	LogsReadRequests,
	PersonalFightDailySummary,
	RankedFightResult
} from "../../core/database/logs/LogsReadRequests";
import {
	FightController
} from "../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { ClassDataController } from "../../data/Class";
import { crowniclesInstance } from "../../index";
import { EloUtils } from "../../core/utils/EloUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { AiPlayerFighter } from "../../core/fights/fighter/AiPlayerFighter";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { FightRewardPacket } from "../../../../Lib/src/packets/fights/FightRewardPacket";
import { LeagueDataController } from "../../data/League";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { minutesToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { PacketUtils } from "../../core/utils/PacketUtils";
import { PlayerWasAttackedNotificationPacket } from "../../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PostFightPetLoveOutcomes } from "../../../../Lib/src/constants/PetConstants";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";

type PlayerStats = {
	pet: {
		petTypeId: number;
		petSex: SexTypeShort;
		petNickname: string;
		isOnExpedition: boolean;
	};
	classId: number;
	fightRanking: { glory: number };
	energy: {
		value: number;
		max: number;
	};
	attack: number;
	defense: number;
	speed: number;
	breath: {
		base: number;
		max: number;
		regen: number;
	};
};

type FightInitiatorInformation = {
	playerDailyFightSummary: PersonalFightDailySummary;
	initiatorGameResult: number;
	initiatorPlayer: Player;
};

/*
 * Map to store the cooldowns of players who have been defenders in ranked fights
 * It is updated just before starting a fight, so it prevents a single player to defend two players at the same time as
 * Fights are logged at the end of the fight
 */
export const fightsDefenderCooldowns = new Map<string, number>();

async function getPlayerStats(player: Player): Promise<PlayerStats> {
	const playerActiveObjects = await InventorySlots.getMainSlotsItems(player.id);
	const petEntity = await PetEntities.getById(player.petId);

	return {
		pet: petEntity
			? {
				petTypeId: petEntity.typeId!,
				petSex: petEntity.sex as SexTypeShort,
				petNickname: petEntity.nickname,
				isOnExpedition: await PetExpeditions.getActiveExpeditionForPlayer(player.id) !== null
			}
			: {
				petTypeId: null,
				petSex: null,
				petNickname: null,
				isOnExpedition: false
			},
		classId: player.class,
		fightRanking: {
			glory: player.getGloryPoints()
		},
		energy: {
			value: player.getCumulativeEnergy(),
			max: player.getMaxCumulativeEnergy()
		},
		attack: player.getCumulativeAttack(playerActiveObjects),
		defense: player.getCumulativeDefense(playerActiveObjects),
		speed: player.getCumulativeSpeed(playerActiveObjects),
		breath: {
			base: player.getBaseBreath(),
			max: player.getMaxBreath(),
			regen: player.getBreathRegen()
		}
	};
}

/**
 * Calculate the money reward for the initiator of the fight
 * @param fightInitiatorInformation Information about the fight initiator
 * @param response Packet response array
 * @returns The amount of money rewarded
 */
async function calculateMoneyReward(
	fightInitiatorInformation: FightInitiatorInformation,
	response: CrowniclesPacket[]
): Promise<number> {
	// Determine the bonus to reward based on a game result
	const bonusByResult = {
		[EloGameResult.WIN]: FightConstants.REWARDS.WIN_MONEY_BONUS,
		[EloGameResult.DRAW]: FightConstants.REWARDS.DRAW_MONEY_BONUS,
		[EloGameResult.LOSS]: FightConstants.REWARDS.LOSS_MONEY_BONUS
	};

	let extraMoneyBonus = bonusByResult[fightInitiatorInformation.initiatorGameResult as EloGameResult];

	// Calculate already awarded money
	const summary = fightInitiatorInformation.playerDailyFightSummary;
	const lossCount = summary.played - (summary.draw + summary.won);

	const alreadyAwardedMoney =
		summary.won * FightConstants.REWARDS.WIN_MONEY_BONUS
		+ summary.draw * FightConstants.REWARDS.DRAW_MONEY_BONUS
		+ lossCount * FightConstants.REWARDS.LOSS_MONEY_BONUS;

	// Apply cap to money rewards if necessary
	if (alreadyAwardedMoney > FightConstants.REWARDS.MAX_MONEY_BONUS) {
		extraMoneyBonus = Math.max(
			FightConstants.REWARDS.MAX_MONEY_BONUS - (alreadyAwardedMoney - extraMoneyBonus),
			0
		);
	}

	// Add money to the appropriate player
	await fightInitiatorInformation.initiatorPlayer.addMoney({
		amount: extraMoneyBonus,
		response,
		reason: NumberChangeReason.FIGHT
	});

	return extraMoneyBonus;
}

/**
 * Calculate the score reward for the initiator of the fight
 * @param fightInitiatorInformation
 * @param response
 */
async function calculateScoreReward(fightInitiatorInformation: FightInitiatorInformation, response: CrowniclesPacket[]): Promise<number> {
	if (fightInitiatorInformation.initiatorGameResult !== EloGameResult.WIN || fightInitiatorInformation.playerDailyFightSummary.won > FightConstants.REWARDS.NUMBER_OF_WIN_THAT_AWARD_SCORE_BONUS) {
		return 0;
	}

	// Award extra score points only to the initiator for one of his first wins of the day.
	const scoreBonus = FightConstants.REWARDS.SCORE_BONUS_AWARD;

	await fightInitiatorInformation.initiatorPlayer.addScore(
		{
			amount: scoreBonus,
			response,
			reason: NumberChangeReason.FIGHT
		}
	);

	return scoreBonus;
}

/**
 * Update the players' glory and cooldowns after a fight
 * @param attacker
 * @param defender
 * @param attackerGameResult
 * @param defenderGameResult
 * @param response
 * @param fightLogId
 */
async function updatePlayersEloAndCooldowns(
	attacker: Player,
	defender: Player,
	attackerGameResult: EloGameResult,
	defenderGameResult: EloGameResult,
	response: CrowniclesPacket[],
	fightLogId: number | null
): Promise<void> {
	// Calculate elo
	const player1KFactor = EloUtils.getKFactor(attacker);
	const player2KFactor = EloUtils.getKFactor(defender);
	const player1NewRating = EloUtils.calculateNewRating(attacker.attackGloryPoints, defender.defenseGloryPoints, attackerGameResult, player1KFactor);
	const player2NewRating = EloUtils.calculateNewRating(defender.defenseGloryPoints, attacker.attackGloryPoints, defenderGameResult, player2KFactor);

	// Change glory and fightCountdown and save
	await attacker.setGloryPoints(player1NewRating, false, NumberChangeReason.FIGHT, response, fightLogId);
	attacker.fightCountdown--;
	if (attacker.fightCountdown < 0) {
		attacker.fightCountdown = 0;
	}
	await defender.setGloryPoints(player2NewRating, true, NumberChangeReason.FIGHT, response, fightLogId);
	defender.fightCountdown--;
	if (defender.fightCountdown < 0) {
		defender.fightCountdown = 0;
	}
	await Promise.all([
		attacker.save(),
		defender.save()
	]);
}

/**
 * Send notification to defending player that they were attacked
 */
function notifyDefenderOfAttack(fight: FightController): void {
	const defendingFighter = fight.getNonFightInitiatorFighter();
	if (defendingFighter instanceof AiPlayerFighter) {
		PacketUtils.sendNotifications([
			makePacket(PlayerWasAttackedNotificationPacket, {
				keycloakId: defendingFighter.player.keycloakId,
				attackedByPlayerKeycloakId: fight.fightInitiator.player.keycloakId
			})
		]);
	}
}

/**
 * Get the game result for initiator based on fight outcome
 */
function getGameResultFromFight(fight: FightController): {
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
async function handlePostFightPetLove(
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

/**
 * Build player glory info for reward packet
 */
function buildPlayerGloryInfo(player: Player, oldGlory: number): FightRewardPacket["player1"] {
	return {
		keycloakId: player.keycloakId,
		oldGlory,
		newGlory: player.getGloryPoints(),
		oldLeagueId: LeagueDataController.instance.getByGlory(oldGlory).id,
		newLeagueId: player.getLeague().id
	};
}

/**
 * Code that will be executed when a fight ends (except if the fight has a bug)
 * @param fight
 * @param response
 */
async function fightEndCallback(fight: FightController, response: CrowniclesPacket[]): Promise<void> {
	notifyDefenderOfAttack(fight);

	const fightLogId = await crowniclesInstance.logsDatabase.logFight(fight);
	const gameResults = getGameResultFromFight(fight);

	const fightInitiator = fight.fightInitiator;
	const nonFightInitiator = fight.getNonFightInitiatorFighter();

	const initiatorPlayer = fightInitiator instanceof PlayerFighter || fightInitiator instanceof AiPlayerFighter
		? await Players.getById(fightInitiator.player.id)
		: null;
	const opponentPlayer = nonFightInitiator instanceof PlayerFighter || nonFightInitiator instanceof AiPlayerFighter
		? await Players.getById(nonFightInitiator.player.id)
		: null;

	const playerDailyFightSummary = await LogsReadRequests.getPersonalInitiatedFightDailySummary(
		fight.fightInitiator.player.keycloakId
	);

	const fightInitiatorInfo: FightInitiatorInformation = {
		playerDailyFightSummary,
		initiatorGameResult: gameResults.initiatorResult,
		initiatorPlayer
	};

	const scoreBonus = await calculateScoreReward(fightInitiatorInfo, response);
	const extraMoneyBonus = await calculateMoneyReward(fightInitiatorInfo, response);

	// Save glory before changing it
	const player1OldGlory = initiatorPlayer.getGloryPoints();
	const player2OldGlory = opponentPlayer.getGloryPoints();
	await updatePlayersEloAndCooldowns(initiatorPlayer, opponentPlayer, gameResults.initiatorResult, gameResults.defenderResult, response, fightLogId);

	const petLoveChange = gameResults.isDraw ? undefined : await handlePostFightPetLove(fight, response);

	response.push(makePacket(FightRewardPacket, {
		points: scoreBonus,
		money: extraMoneyBonus,
		player1: buildPlayerGloryInfo(initiatorPlayer, player1OldGlory),
		player2: buildPlayerGloryInfo(opponentPlayer, player2OldGlory),
		draw: gameResults.isDraw,
		petLoveChange
	}));
}

/**
 * Check if a BO3 is already finished (three games played or two wins)
 * @param bo3
 */
function bo3isAlreadyFinished(bo3: RankedFightResult): boolean {
	return bo3.won > 1 || bo3.lost > 1 || bo3.draw + bo3.won + bo3.lost >= 3;
}

/**
 * Check if these players have been defenders recently in the cache map
 * @param validOpponents
 */
function checkPlayersInDefenderCacheMap(validOpponents: Player[]): Player[] {
	const now = Date.now();
	return validOpponents.filter(opponent => {
		const cooldown = fightsDefenderCooldowns.get(opponent.keycloakId);
		if (cooldown) {
			return cooldown < now;
		}
		return true;
	});
}

/**
 * Get the initial valid opponents based on the offset and player
 * @param offset
 * @param player
 */
async function getInitialValidOpponents(offset: number, player: Player): Promise<Player[]> {
	let validOpponents: Player[];
	if (offset === 0) {
		// Fetch both active and regular potential opponents
		const activeOpponents = await Players.findActivePotentialOpponents(
			player,
			FightConstants.ACTIVE_PLAYER_PER_OPPONENT_SEARCH,
			offset
		);
		const regularOpponents = await Players.findPotentialOpponents(
			player,
			FightConstants.PLAYER_PER_OPPONENT_SEARCH,
			offset
		);

		// Combine and remove duplicates based on keycloakId
		validOpponents = [...activeOpponents];
		for (const opp of regularOpponents) {
			if (!validOpponents.some(p => p.keycloakId === opp.keycloakId)) {
				validOpponents.push(opp);
			}
		}
		return validOpponents;
	}
	return await Players.findPotentialOpponents(
		player,
		FightConstants.PLAYER_PER_OPPONENT_SEARCH,
		offset - 1
	);
}

/**
 * Find another player to fight the player that started the command
 * @param player - player that wants to fight
 * @returns player opponent
 */
async function findOpponent(player: Player): Promise<Player | null> {
	for (let offset = 0; offset <= FightConstants.MAX_OFFSET_FOR_OPPONENT_SEARCH; offset++) {
		// Retrieve some potential opponents
		let validOpponents = await getInitialValidOpponents(offset, player);

		if (validOpponents.length === 0) {
			continue;
		}

		// Shuffle the array of opponents to randomize who gets picked first
		validOpponents.sort(() => Math.random() - 0.5);

		// Check if these players have been defenders recently in the cache map
		validOpponents = checkPlayersInDefenderCacheMap(validOpponents);

		// Check if these players have been defenders recently in the database
		const haveBeenDefenderRecently = await LogsReadRequests.hasBeenADefenderInRankedFightSinceMinutes(
			validOpponents.map(opponent => opponent.keycloakId),
			FightConstants.DEFENDER_COOLDOWN_MINUTES
		);

		// Filter out opponents who have been defenders too recently
		const opponentsNotOnCooldown = validOpponents.filter(
			opponent => !haveBeenDefenderRecently[opponent.keycloakId]
		);

		// If nobody is off cooldown in this batch, continue to the next offset
		if (opponentsNotOnCooldown.length === 0) {
			continue;
		}

		// Get IDs for the remaining opponents
		const remainingOpponentKeycloakIds = opponentsNotOnCooldown.map(
			opponent => opponent.keycloakId
		);

		// Fetch the fight results against all remaining valid opponents
		const bo3Map = await LogsReadRequests.getRankedFightsThisWeek(
			player.keycloakId,
			remainingOpponentKeycloakIds
		);

		// Check each remaining opponent to see if the best-of-three is finished
		for (const opponent of opponentsNotOnCooldown) {
			const results = bo3Map.get(opponent.keycloakId) ?? {
				won: 0, lost: 0, draw: 0
			};
			if (!bo3isAlreadyFinished(results)) {
				return opponent;
			}
		}
	}
	return null;
}

function fightValidationEndCallback(player: Player, context: PacketContext): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			const opponent = await findOpponent(player);
			if (!opponent) {
				response.push(makePacket(CommandFightOpponentsNotFoundPacket, {}));
				BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.FIGHT_CONFIRMATION);
				return;
			}
			const askingFighter = new PlayerFighter(player, ClassDataController.instance.getById(player.class));
			askingFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
			await askingFighter.loadStats();
			const incomingFighter = new AiPlayerFighter(opponent, ClassDataController.instance.getById(opponent.class));
			incomingFighter.setFightRole(FightConstants.FIGHT_ROLES.DEFENDER);
			await incomingFighter.loadStats();

			// Start fight
			const fightController = new FightController(
				{
					fighter1: askingFighter, fighter2: incomingFighter
				},
				FightOvertimeBehavior.END_FIGHT_DRAW,
				context
			);
			fightController.setEndCallback(fightEndCallback);
			fightsDefenderCooldowns.set(opponent.keycloakId, Date.now() + minutesToMilliseconds(FightConstants.DEFENDER_COOLDOWN_MINUTES));
			await fightController.startFight(response);
		}
		else {
			response.push(makePacket(CommandFightRefusePacketRes, {}));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.FIGHT_CONFIRMATION);
	};
}

export default class FightCommand {
	@commandRequires(CommandFightPacketReq, {
		notBlocked: true,
		whereAllowed: [WhereAllowed.CONTINENT],
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: FightConstants.REQUIRED_LEVEL
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandFightPacketReq, context: PacketContext): Promise<void> {
		if (!player.hasEnoughEnergyToFight()) {
			response.push(makePacket(CommandFightNotEnoughEnergyPacketRes, {}));
			return;
		}

		const collector = new ReactionCollectorFight(
			await getPlayerStats(player)
		);

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			fightValidationEndCallback(player, context)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.FIGHT_CONFIRMATION)
			.build();

		response.push(collectorPacket);
	}
}

/**
 * Clear the fights defender cooldowns cache (used for testing purposes)
 * @returns The number of entries cleared
 */
export function clearFightsDefenderCooldowns(): number {
	const size = fightsDefenderCooldowns.size;
	fightsDefenderCooldowns.clear();
	return size;
}
