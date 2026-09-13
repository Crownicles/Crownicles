import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandFightIntroduceFightersPacket } from "../../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { CommandFightStatusPacket } from "../../../../../Lib/src/packets/fights/FightStatusPacket";
import { CommandFightHistoryItemPacket } from "../../../../../Lib/src/packets/fights/FightHistoryItemPacket";
import { CommandFightEndOfFightPacket } from "../../../../../Lib/src/packets/fights/EndOfFightPacket";
import { FightRewardPacket } from "../../../../../Lib/src/packets/fights/FightRewardPacket";
import { AIFightActionChoosePacket } from "../../../../../Lib/src/packets/fights/AIFightActionChoosePacket";
import { BuggedFightPacket } from "../../../../../Lib/src/packets/fights/BuggedFightPacket";
import {
	CommandFightNotEnoughEnergyPacketRes, CommandFightOpponentsNotFoundPacket, CommandFightRefusePacketRes, CommandFightResumeRes
} from "../../../../../Lib/src/packets/commands/CommandFightPacket";
import {
	FightIntroductionRes, FightStatusRes, FightLogRes, FightEndRes, FightRewardRes, FightWaitRes, FightErrorRes, FightResumeRes
} from "../../../../../WsPackets/src/fromServer/fight/FightRes";
import {
	FIGHT_ERRORS, FightError, FightFighter, FightRankingChange
} from "../../../../../WsPackets/src/objects/Fight";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { fightParticipant } from "../FightDisplay";

function failure(error: FightError): Promise<FightErrorRes> {
	return asyncMakeFromServerPacket(FightErrorRes, { error });
}

async function fighterStatus(context: PacketContext, fighter: CommandFightStatusPacket["activeFighter"]): Promise<FightFighter> {
	const {
		keycloakId: _keycloakId, monsterId: _monsterId, ...details
	} = fighter;
	return {
		...await fightParticipant(context, fighter), ...details
	};
}

async function rankingChange(context: PacketContext, fighter: FightRewardPacket["player1"]): Promise<FightRankingChange> {
	const {
		keycloakId, ...ranking
	} = fighter;
	return {
		...await fightParticipant(context, { keycloakId }), ...ranking
	};
}

export default class FightServerTranslator {
	@fromServerTranslator(CommandFightResumeRes, FightResumeRes)
	public static resume(_context: PacketContext, packet: CommandFightResumeRes): Promise<FightResumeRes> {
		return asyncMakeFromServerPacket(FightResumeRes, { active: packet.active });
	}

	@fromServerTranslator(CommandFightIntroduceFightersPacket, FightIntroductionRes)
	public static async introduction(context: PacketContext, packet: CommandFightIntroduceFightersPacket): Promise<FightIntroductionRes> {
		return asyncMakeFromServerPacket(FightIntroductionRes, { introduction: {
			fightId: packet.fightId,
			initiator: await fightParticipant(context, { keycloakId: packet.fightInitiatorKeycloakId }),
			opponent: await fightParticipant(context, {
				keycloakId: packet.fightOpponentKeycloakId, monsterId: packet.fightOpponentMonsterId
			}),
			initiatorActions: packet.fightInitiatorActions,
			opponentActions: packet.fightOpponentActions,
			...packet.fightInitiatorPet ? { initiatorPet: packet.fightInitiatorPet } : {},
			...packet.fightOpponentPet ? { opponentPet: packet.fightOpponentPet } : {}
		} });
	}

	@fromServerTranslator(CommandFightStatusPacket, FightStatusRes)
	public static async status(context: PacketContext, packet: CommandFightStatusPacket): Promise<FightStatusRes> {
		return asyncMakeFromServerPacket(FightStatusRes, { status: {
			fightId: packet.fightId,
			numberOfTurn: packet.numberOfTurn,
			maxNumberOfTurn: packet.maxNumberOfTurn,
			activeFighter: await fighterStatus(context, packet.activeFighter),
			defendingFighter: await fighterStatus(context, packet.defendingFighter)
		} });
	}

	@fromServerTranslator(CommandFightHistoryItemPacket, FightLogRes)
	public static async log(context: PacketContext, packet: CommandFightHistoryItemPacket): Promise<FightLogRes> {
		const {
			fighterKeycloakId, monsterId, ...details
		} = packet;
		return asyncMakeFromServerPacket(FightLogRes, { entry: {
			...details,
			fighter: await fightParticipant(context, {
				keycloakId: fighterKeycloakId, monsterId
			})
		} });
	}

	@fromServerTranslator(CommandFightEndOfFightPacket, FightEndRes)
	public static async ended(context: PacketContext, packet: CommandFightEndOfFightPacket): Promise<FightEndRes> {
		return asyncMakeFromServerPacket(FightEndRes, { result: {
			winner: {
				...await fightParticipant(context, packet.winner), finalEnergy: packet.winner.finalEnergy, maxEnergy: packet.winner.maxEnergy
			},
			loser: {
				...await fightParticipant(context, packet.looser), finalEnergy: packet.looser.finalEnergy, maxEnergy: packet.looser.maxEnergy
			},
			draw: packet.draw,
			turns: packet.turns,
			maxTurns: packet.maxTurns
		} });
	}

	@fromServerTranslator(FightRewardPacket, FightRewardRes)
	public static async reward(context: PacketContext, packet: FightRewardPacket): Promise<FightRewardRes> {
		const petLoveChange = packet.petLoveChange;
		return asyncMakeFromServerPacket(FightRewardRes, { reward: {
			points: packet.points,
			money: packet.money,
			draw: packet.draw,
			won: packet.winnerKeycloakId === context.keycloakId,
			player1: await rankingChange(context, packet.player1),
			player2: await rankingChange(context, packet.player2),
			...petLoveChange && petLoveChange.keycloakId === context.keycloakId
				? { petLoveChange: {
					loveChange: petLoveChange.loveChange,
					reactionType: petLoveChange.reactionType,
					petId: petLoveChange.petId,
					petSex: petLoveChange.petSex,
					petNickname: petLoveChange.petNickname
				} }
				: {}
		} });
	}

	@fromServerTranslator(AIFightActionChoosePacket, FightWaitRes)
	public static wait(_context: PacketContext, packet: AIFightActionChoosePacket): Promise<FightWaitRes> { return asyncMakeFromServerPacket(FightWaitRes, { ...packet }); }

	@fromServerTranslator(CommandFightNotEnoughEnergyPacketRes, FightErrorRes)
	public static energy(_context: PacketContext, _packet: CommandFightNotEnoughEnergyPacketRes): Promise<FightErrorRes> { return failure(FIGHT_ERRORS.ENERGY); }

	@fromServerTranslator(CommandFightOpponentsNotFoundPacket, FightErrorRes)
	public static noOpponent(_context: PacketContext, _packet: CommandFightOpponentsNotFoundPacket): Promise<FightErrorRes> { return failure(FIGHT_ERRORS.NO_OPPONENT); }

	@fromServerTranslator(CommandFightRefusePacketRes, FightErrorRes)
	public static refused(_context: PacketContext, _packet: CommandFightRefusePacketRes): Promise<FightErrorRes> { return failure(FIGHT_ERRORS.REFUSED); }

	@fromServerTranslator(BuggedFightPacket, FightErrorRes)
	public static bugged(_context: PacketContext, _packet: BuggedFightPacket): Promise<FightErrorRes> { return failure(FIGHT_ERRORS.BUGGED); }
}
