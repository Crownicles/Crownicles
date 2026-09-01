import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentCancelPacketRes, CommandTournamentCreatePacketRes,
	CommandTournamentContextPacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketRes,
	CommandTournamentRegisterPacketRes, CommandTournamentResumePacketRes,
	CommandTournamentStatusPacketRes, CommandTournamentTopPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentFightRewardPacket } from "../../../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import {
	handleTournamentCancel, handleTournamentCreate, handleTournamentError,
	handleTournamentFightReward, handleTournamentGenerateCode, handleTournamentRegister,
	handleTournamentResume, handleTournamentStatus, handleTournamentTop
} from "../../../../commands/tournament/TournamentResponses";

export default class TournamentPacketHandlers {
	@packetHandler(CommandTournamentContextPacketRes)
	context(_context: PacketContext, _packet: CommandTournamentContextPacketRes): Promise<void> {
		return Promise.resolve();
	}

	@packetHandler(CommandTournamentGenerateCodePacketRes)
	async generateCode(context: PacketContext, packet: CommandTournamentGenerateCodePacketRes): Promise<void> {
		await handleTournamentGenerateCode(context, packet);
	}

	@packetHandler(CommandTournamentCreatePacketRes)
	async create(context: PacketContext, packet: CommandTournamentCreatePacketRes): Promise<void> {
		await handleTournamentCreate(context, packet);
	}

	@packetHandler(CommandTournamentRegisterPacketRes)
	async register(context: PacketContext, packet: CommandTournamentRegisterPacketRes): Promise<void> {
		await handleTournamentRegister(context, packet);
	}

	@packetHandler(CommandTournamentStatusPacketRes)
	async status(context: PacketContext, packet: CommandTournamentStatusPacketRes): Promise<void> {
		await handleTournamentStatus(context, packet);
	}

	@packetHandler(CommandTournamentResumePacketRes)
	async resume(context: PacketContext, packet: CommandTournamentResumePacketRes): Promise<void> {
		await handleTournamentResume(context, packet);
	}

	@packetHandler(CommandTournamentCancelPacketRes)
	async cancel(context: PacketContext, packet: CommandTournamentCancelPacketRes): Promise<void> {
		await handleTournamentCancel(context, packet);
	}

	@packetHandler(CommandTournamentTopPacketRes)
	async top(context: PacketContext, packet: CommandTournamentTopPacketRes): Promise<void> {
		await handleTournamentTop(context, packet);
	}

	@packetHandler(CommandTournamentErrorPacketRes)
	async error(context: PacketContext, packet: CommandTournamentErrorPacketRes): Promise<void> {
		await handleTournamentError(context, packet);
	}

	@packetHandler(TournamentFightRewardPacket)
	async fightReward(context: PacketContext, packet: TournamentFightRewardPacket): Promise<void> {
		await handleTournamentFightReward(context, packet);
	}
}
