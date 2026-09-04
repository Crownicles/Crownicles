import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentAdminMenuPacketRes,
	CommandTournamentCancelPacketRes, CommandTournamentCreatePacketRes,
	CommandTournamentContextPacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketRes,
	CommandTournamentOwnerMenuPacketRes,
	CommandTournamentResumePacketRes,
	CommandTournamentStatusPacketRes, CommandTournamentTopPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentFightRewardPacket } from "../../../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import {
	handleTournamentCancel, handleTournamentCreate, handleTournamentError,
	handleTournamentFightReward, handleTournamentGenerateCode,
	handleTournamentResume, handleTournamentStatus, handleTournamentTop
} from "../../../../commands/tournament/TournamentResponses";
import {
	handleTournamentAdminMenu, handleTournamentOwnerMenu
} from "../../../../commands/tournament/TournamentMenus";

export default class TournamentPacketHandlers {
	@packetHandler(CommandTournamentContextPacketRes)
	context(_context: PacketContext, _packet: CommandTournamentContextPacketRes): Promise<void> {
		return Promise.resolve();
	}

	@packetHandler(CommandTournamentAdminMenuPacketRes)
	async adminMenu(context: PacketContext, packet: CommandTournamentAdminMenuPacketRes): Promise<void> {
		await handleTournamentAdminMenu(context, packet);
	}

	@packetHandler(CommandTournamentOwnerMenuPacketRes)
	async ownerMenu(context: PacketContext, packet: CommandTournamentOwnerMenuPacketRes): Promise<void> {
		await handleTournamentOwnerMenu(context, packet);
	}

	@packetHandler(CommandTournamentGenerateCodePacketRes)
	async generateCode(context: PacketContext, packet: CommandTournamentGenerateCodePacketRes): Promise<void> {
		await handleTournamentGenerateCode(context, packet);
	}

	@packetHandler(CommandTournamentCreatePacketRes)
	async create(context: PacketContext, packet: CommandTournamentCreatePacketRes): Promise<void> {
		await handleTournamentCreate(context, packet);
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
