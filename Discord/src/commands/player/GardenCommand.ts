import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGardenPacketReq } from "../../../../Lib/src/packets/commands/CommandGardenPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandGardenPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandGardenPacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("garden"),
	getPacket,
	mainGuildCommand: false
};
