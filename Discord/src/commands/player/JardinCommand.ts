import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandJardinPacketReq } from "../../../../Lib/src/packets/commands/CommandJardinPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";

function getPacket(): CommandJardinPacketReq {
	return makePacket(CommandJardinPacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("jardin"),
	getPacket,
	mainGuildCommand: false
};
