import {
	PermissionsBitField
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentAdminMenuPacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, hasMinimumGuildSize, hasTournamentChannelPermissions,
	isGuildAdministrator, isTournamentParentChannel, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!interaction.guild) {
		return await replyTournamentError(interaction, "guildOnly");
	}
	if (!isGuildAdministrator(interaction)) {
		return await replyTournamentError(interaction, "administratorOnly");
	}
	if (!hasMinimumGuildSize(interaction)) {
		return await replyTournamentError(interaction, "guildTooSmall");
	}
	if (!isTournamentParentChannel(interaction) || !hasTournamentChannelPermissions(interaction)) {
		return await replyTournamentError(interaction, "missingChannelPermissions");
	}
	await interaction.deferReply({ ephemeral: true });
	sendTournamentPacket(
		await createTournamentContext(interaction, user),
		makePacket(CommandTournamentAdminMenuPacketReq, {})
	);
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-admin")
		.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator.toString()),
	getPacket,
	mainGuildCommand: false
};
