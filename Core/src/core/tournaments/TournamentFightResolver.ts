import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { TournamentFightRewardPacket } from "../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import {
	TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import {
	Locked, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../app";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentFight } from "../database/game/models/TournamentFight";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import { EloUtils } from "../utils/EloUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import type { FightController } from "../fights/FightController";
import {
	getGameResult
} from "./TournamentRules";

type TournamentFightParameters = {
	fight: FightController;
	fightContext: NonNullable<FightController["tournamentContext"]>;
	response: CrowniclesPacket[];
	isDraw: boolean;
	attackerWon: boolean;
};

type TournamentGloryChanges = {
	attackerKeycloakId: string;
	attackerGlory: number;
	defenderKeycloakId: string;
	defenderGlory: number;
};

type TournamentGlorySnapshot = {
	attackerTotal: number;
	defenderTotal: number;
};

function isValidTournamentFight(
	tournament: Tournament,
	attacker: TournamentParticipant,
	defender: TournamentParticipant,
	fightContext: TournamentFightParameters["fightContext"]
): boolean {
	return tournament.status === TournamentStatuses.COMBAT
		&& Date.now() < tournament.combatEndsAt.getTime()
		&& attacker.tournamentId === tournament.id
		&& defender.tournamentId === tournament.id
		&& attacker.category === fightContext.category
		&& defender.category === fightContext.category;
}

function buildTournamentFightPacket(
	parameters: TournamentFightParameters,
	attacker: TournamentParticipant,
	defender: TournamentParticipant,
	snapshot: TournamentGlorySnapshot
): TournamentFightRewardPacket {
	return makePacket(TournamentFightRewardPacket, {
		player1: {
			keycloakId: attacker.keycloakId,
			category: attacker.category,
			oldTotalGloryPoints: snapshot.attackerTotal,
			newTotalGloryPoints: attacker.getTotalGloryPoints()
		},
		player2: {
			keycloakId: defender.keycloakId,
			category: defender.category,
			oldTotalGloryPoints: snapshot.defenderTotal,
			newTotalGloryPoints: defender.getTotalGloryPoints()
		},
		draw: parameters.isDraw,
		winnerKeycloakId: parameters.isDraw
			? undefined
			: parameters.attackerWon ? attacker.keycloakId : defender.keycloakId
	});
}

async function resolveTournamentFightUnderLock(
	parameters: TournamentFightParameters,
	tournament: Locked<Tournament>,
	attacker: Locked<TournamentParticipant>,
	defender: Locked<TournamentParticipant>
): Promise<TournamentGloryChanges | null> {
	if (await TournamentFight.findOne({ where: { fightId: parameters.fight.id } })
		|| !isValidTournamentFight(tournament, attacker, defender, parameters.fightContext)) {
		return null;
	}
	const attackerResult = getGameResult(parameters.attackerWon, parameters.isDraw);
	const defenderResult = getGameResult(!parameters.attackerWon, parameters.isDraw);
	const snapshot: TournamentGlorySnapshot = {
		attackerTotal: attacker.getTotalGloryPoints(),
		defenderTotal: defender.getTotalGloryPoints()
	};
	const newAttackerAttack = EloUtils.calculateNewRating(
		attacker.attackGloryPoints,
		defender.defenseGloryPoints,
		attackerResult,
		EloUtils.getKFactorFromGlory(attacker.getTotalGloryPoints())
	);
	const newDefenderDefense = EloUtils.calculateNewRating(
		defender.defenseGloryPoints,
		attacker.attackGloryPoints,
		defenderResult,
		EloUtils.getKFactorFromGlory(defender.getTotalGloryPoints())
	);
	attacker.attackGloryPoints = newAttackerAttack;
	defender.defenseGloryPoints = newDefenderDefense;
	await Promise.all([attacker.save(), defender.save()]);
	await TournamentFight.create({
		fightId: parameters.fight.id,
		tournamentId: tournament.id,
		attackerParticipantId: attacker.id,
		defenderParticipantId: defender.id,
		winnerParticipantId: parameters.isDraw
			? null
			: parameters.attackerWon ? attacker.id : defender.id,
		draw: parameters.isDraw,
		playedAt: new Date()
	});
	parameters.response.push(buildTournamentFightPacket(
		parameters,
		attacker,
		defender,
		snapshot
	));
	return {
		attackerKeycloakId: attacker.keycloakId,
		attackerGlory: attacker.attackGloryPoints,
		defenderKeycloakId: defender.keycloakId,
		defenderGlory: defender.defenseGloryPoints
	};
}

async function logTournamentGloryChanges(gloryChanges: TournamentGloryChanges): Promise<void> {
	try {
		await Promise.all([
			crowniclesInstance?.logsDatabase.logPlayersAttackGloryPoints(gloryChanges.attackerKeycloakId, gloryChanges.attackerGlory, NumberChangeReason.TOURNAMENT_FIGHT),
			crowniclesInstance?.logsDatabase.logPlayersDefenseGloryPoints(gloryChanges.defenderKeycloakId, gloryChanges.defenderGlory, NumberChangeReason.TOURNAMENT_FIGHT)
		]);
	}
	catch (error) {
		CrowniclesLogger.errorWithObj("Tournament glory log failed after fight commit", error);
	}
}

export async function resolveTournamentFight(fight: FightController, response: CrowniclesPacket[]): Promise<void> {
	const fightContext = fight.tournamentContext;
	if (!fightContext || fight.isBugged()) {
		return;
	}
	const isDraw = fight.isADraw();
	const parameters: TournamentFightParameters = {
		fight,
		fightContext,
		response,
		isDraw,
		attackerWon: !isDraw && fight.getWinnerFighter() === fight.fightInitiator
	};
	const gloryChanges = await withLockedEntities(
		[
			Tournament.lockKey(fightContext.tournamentId),
			TournamentParticipant.lockKey(fightContext.attackerParticipantId),
			TournamentParticipant.lockKey(fightContext.defenderParticipantId)
		] as const,
		([
			tournament,
			attacker,
			defender
		]) =>
			resolveTournamentFightUnderLock(parameters, tournament, attacker, defender)
	);
	if (gloryChanges) {
		await logTournamentGloryChanges(gloryChanges);
	}
}
