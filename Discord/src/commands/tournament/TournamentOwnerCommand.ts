import {
	PermissionsBitField
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentOwnerMenuPacketReq, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, hasMinimumGuildSize, hasTournamentChannelPermissions,
	isBotOwner, isTournamentParentChannel, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!interaction.guild) {
		return await replyTournamentError(interaction, TournamentErrorCodes.GUILD_ONLY);
	}
	if (!isBotOwner(interaction)) {
		return await replyTournamentError(interaction, TournamentErrorCodes.OWNER_ONLY);
	}
	if (!hasMinimumGuildSize(interaction)) {
		return await replyTournamentError(interaction, TournamentErrorCodes.GUILD_TOO_SMALL);
	}
	if (!isTournamentParentChannel(interaction) || !hasTournamentChannelPermissions(interaction)) {
		return await replyTournamentError(interaction, TournamentErrorCodes.MISSING_CHANNEL_PERMISSIONS);
	}
	await interaction.deferReply({ ephemeral: true });
	sendTournamentPacket(
		await createTournamentContext(interaction, user),
		makePacket(CommandTournamentOwnerMenuPacketReq, {})
	);
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-owner")
		.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator.toString()),
	getPacket,
	mainGuildCommand: false
};
