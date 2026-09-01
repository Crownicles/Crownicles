import {
	CrowniclesPacket, PacketContext, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import Tournament from "../../core/database/game/models/Tournament";
import { getEffectiveLevel } from "../../core/tournaments/TournamentRules";
import { getParticipant } from "../../core/tournaments/TournamentQueries";
import { findAndReserveOpponent } from "../../core/tournaments/TournamentMatchmaking";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { ClassDataController } from "../../data/Class";
import { PlayerFighter } from "../../core/fights/fighter/PlayerFighter";
import { AiPlayerFighter } from "../../core/fights/fighter/AiPlayerFighter";
import { FightController } from "../../core/fights/FightController";
import { FightOvertimeBehavior } from "../../core/fights/FightOvertimeBehavior";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorFight } from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandFightOpponentsNotFoundPacket, CommandFightRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandFightPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { getPlayerStats } from "./FightPlayerStats";

export type TournamentFightEndCallback = (fight: FightController, response: CrowniclesPacket[]) => Promise<void>;

type TournamentFightFlow = {
	response: CrowniclesPacket[];
	player: Player;
	context: PacketContext;
	tournament: Tournament;
	fightEndCallback: TournamentFightEndCallback;
};

async function startTournamentFight(flow: TournamentFightFlow): Promise<void> {
	const participant = await getParticipant(flow.tournament.id, flow.player.id);
	if (!participant) {
		flow.response.push(makePacket(CommandFightOpponentsNotFoundPacket, {}));
		return;
	}
	const opponentParticipant = await findAndReserveOpponent(flow.tournament, participant);
	if (!opponentParticipant) {
		flow.response.push(makePacket(CommandFightOpponentsNotFoundPacket, {}));
		return;
	}
	const opponent = await Players.getById(opponentParticipant.playerId);
	const playerClass = ClassDataController.instance.getById(flow.player.class);
	const opponentClass = ClassDataController.instance.getById(opponent.class);
	if (!playerClass || !opponentClass) {
		throw new Error("Class not found for tournament player or opponent");
	}

	const askingFighter = new PlayerFighter(flow.player, playerClass, {
		effectiveLevel: getEffectiveLevel(participant.category, flow.player.level),
		tournamentMode: true
	});
	askingFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
	await askingFighter.loadStats();
	askingFighter.tournamentGloryPoints = participant.getTotalGloryPoints();

	const incomingFighter = new AiPlayerFighter(opponent, opponentClass, {
		allowPotionConsumption: false,
		effectiveLevel: getEffectiveLevel(opponentParticipant.category, opponent.level),
		tournamentMode: true
	});
	incomingFighter.setFightRole(FightConstants.FIGHT_ROLES.DEFENDER);
	await incomingFighter.loadStats();
	incomingFighter.tournamentGloryPoints = opponentParticipant.getTotalGloryPoints();

	const fightController = new FightController(
		{
			fighter1: askingFighter,
			fighter2: incomingFighter
		},
		{
			overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
			context: flow.context,
			tournamentContext: {
				tournamentId: flow.tournament.id,
				attackerParticipantId: participant.id,
				defenderParticipantId: opponentParticipant.id,
				category: participant.category
			}
		}
	);
	fightController.setEndCallback(flow.fightEndCallback);
	await fightController.startFight(flow.response);
}

function tournamentFightValidationEndCallback(flow: TournamentFightFlow): EndCallback {
	return async (collector, response): Promise<void> => {
		try {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await startTournamentFight({
					...flow,
					response
				});
			}
			else {
				response.push(makePacket(CommandFightRefusePacketRes, {}));
			}
		}
		finally {
			BlockingUtils.unblockPlayer(flow.player.keycloakId, BlockingConstants.REASONS.FIGHT_CONFIRMATION);
		}
	};
}

export async function executeTournamentFightCommand(flow: TournamentFightFlow): Promise<void> {
	const participant = await getParticipant(flow.tournament.id, flow.player.id);
	if (!participant || flow.tournament.status !== TournamentStatuses.COMBAT) {
		flow.response.push(makePacket(CommandFightOpponentsNotFoundPacket, {}));
		return;
	}
	const collector = new ReactionCollectorFight(await getPlayerStats(flow.player, participant));
	const collectorPacket = new ReactionCollectorInstance(
		collector,
		flow.context,
		{
			allowedPlayerKeycloakIds: [flow.player.keycloakId],
			reactionLimit: 1
		},
		tournamentFightValidationEndCallback(flow)
	)
		.block(flow.player.keycloakId, BlockingConstants.REASONS.FIGHT_CONFIRMATION)
		.build();
	flow.response.push(collectorPacket);
}
