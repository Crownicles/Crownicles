import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandFightNotEnoughEnergyPacketRes,
	CommandFightOpponentsNotFoundPacket,
	CommandFightRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandFightPacket";
import {
	handleCommandFightAIFightActionChoose,
	handleCommandFightHistoryItemRes,
	handleCommandFightIntroduceFightersRes,
	handleCommandFightRefusePacketRes,
	handleCommandFightUpdateStatusRes,
	handleEndOfFight,
	handleFightReward
} from "../../commands/player/FightCommand";
import { handleClassicError } from "../../utils/ErrorUtils";
import { CommandFightIntroduceFightersPacket } from "../../../../Lib/src/packets/fights/FightIntroductionPacket";
import { CommandFightStatusPacket } from "../../../../Lib/src/packets/fights/FightStatusPacket";
import { CommandFightHistoryItemPacket } from "../../../../Lib/src/packets/fights/FightHistoryItemPacket";
import { AIFightActionChoosePacket } from "../../../../Lib/src/packets/fights/AIFightActionChoosePacket";
import { CommandFightEndOfFightPacket } from "../../../../Lib/src/packets/fights/EndOfFightPacket";
import { BuggedFightPacket } from "../../../../Lib/src/packets/fights/BuggedFightPacket";
import { FightRewardPacket } from "../../../../Lib/src/packets/fights/FightRewardPacket";

export default class FightHandler {
	@packetHandler(CommandFightRefusePacketRes)
	async refuseFight(context: PacketContext, _packet: CommandFightRefusePacketRes): Promise<void> {
		await handleCommandFightRefusePacketRes(context);
	}

	@packetHandler(CommandFightOpponentsNotFoundPacket)
	async opponentsNotFoundFight(context: PacketContext, _packet: CommandFightOpponentsNotFoundPacket): Promise<void> {
		await handleClassicError(context, "commands:fight.opponentsNotFound");
	}

	@packetHandler(CommandFightNotEnoughEnergyPacketRes)
	async notEnoughEnergy(context: PacketContext, _packet: CommandFightNotEnoughEnergyPacketRes): Promise<void> {
		await handleClassicError(context, "commands:fight.notEnoughEnergy");
	}

	@packetHandler(CommandFightIntroduceFightersPacket)
	async introduceFighters(context: PacketContext, packet: CommandFightIntroduceFightersPacket): Promise<void> {
		await handleCommandFightIntroduceFightersRes(context, packet);
	}

	@packetHandler(CommandFightStatusPacket)
	async updateFightStatus(context: PacketContext, packet: CommandFightStatusPacket): Promise<void> {
		await handleCommandFightUpdateStatusRes(context, packet);
	}

	@packetHandler(CommandFightHistoryItemPacket)
	async addHistoryItem(context: PacketContext, packet: CommandFightHistoryItemPacket): Promise<void> {
		await handleCommandFightHistoryItemRes(context, packet);
	}

	@packetHandler(AIFightActionChoosePacket)
	async aiFightActionChoose(context: PacketContext, packet: AIFightActionChoosePacket): Promise<void> {
		await handleCommandFightAIFightActionChoose(context, packet);
	}

	@packetHandler(CommandFightEndOfFightPacket)
	async endOfFight(context: PacketContext, packet: CommandFightEndOfFightPacket): Promise<void> {
		await handleEndOfFight(context, packet);
	}

	@packetHandler(BuggedFightPacket)
	async buggedFight(context: PacketContext, _packet: BuggedFightPacket): Promise<void> {
		await handleClassicError(context, "error:fightBugged");
	}

	@packetHandler(FightRewardPacket)
	async fightReward(context: PacketContext, packet: FightRewardPacket): Promise<void> {
		await handleFightReward(context, packet);
	}

}
