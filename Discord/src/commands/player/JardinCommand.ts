import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandJardinPacketReq } from "../../../../Lib/src/packets/commands/CommandJardinPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandJardinPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandJardinPacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("jardin"),
	getPacket,
	mainGuildCommand: false
};
