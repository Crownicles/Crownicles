import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	CommandFriendlyFightErrorPacketRes,
	CommandFriendlyFightPacketReq
} from "../../../../Lib/src/packets/commands/CommandFriendlyFightPacket";
import { handleClassicError } from "../../utils/ErrorUtils";
import { deferFightInteraction } from "./FightInteractionUtils";

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandFriendlyFightPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}
	await deferFightInteraction(interaction);
	return makePacket(CommandFriendlyFightPacketReq, { askedPlayer });
}

export async function handleCommandFriendlyFightError(context: PacketContext, packet: CommandFriendlyFightErrorPacketRes): Promise<void> {
	await handleClassicError(context, `commands:friendlyFight.errors.${packet.error}`);
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("friendlyFight")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("friendlyFight", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("friendlyFight", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
