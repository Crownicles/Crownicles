import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketReq } from "../../../../Lib/src/packets/commands/CommandBlessingPacketReq";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";

function getPacket(_interaction: CrowniclesInteraction): CommandBlessingPacketReq {
	return makePacket(CommandBlessingPacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("blessing"),
	getPacket,
	mainGuildCommand: false
};
