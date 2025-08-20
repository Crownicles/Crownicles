import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordMQTT } from "../bot/DiscordMQTT";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import {
	discordConfig, keycloakConfig, shardId
} from "../bot/CrowniclesShard";
import { CrowniclesErrorEmbed } from "../messages/CrowniclesErrorEmbed";
import i18n from "../translations/i18n";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { MessageFlags } from "discord-api-types/v10";
import { PacketConstants } from "../../../Lib/src/constants/PacketConstants";
import { RightGroup } from "../../../Lib/src/types/RightGroup";

export type AskedPlayer = {
	keycloakId?: string;
	rank?: number;
};

export abstract class PacketUtils {
	static sendPacketToBackend(context: PacketContext, packet: CrowniclesPacket): void {
		DiscordMQTT.globalMqttClient!.publish(MqttTopicUtils.getCoreTopic(discordConfig.PREFIX), JSON.stringify({
			packet: {
				name: packet.constructor.name,
				data: packet
			},
			context
		}));
	}

	/**
	 * Prepare the asked player from the crownicles interaction
	 * @param interaction
	 * @param keycloakUser
	 */
	static async prepareAskedPlayer(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<AskedPlayer | null> {
		let askedPlayer: AskedPlayer = { keycloakId: keycloakUser.id };

		const user = interaction.options.getUser("user");
		if (user) {
			const getUser = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, user.id, user.displayName);
			if (!getUser || getUser.isError || !getUser.payload.keycloakId) {
				await interaction.reply({
					embeds: [new CrowniclesErrorEmbed(interaction.user, null, interaction, i18n.t("error:playerDoesntExist", { lng: interaction.userLanguage }))],
					flags: MessageFlags.Ephemeral
				});
				return null;
			}
			askedPlayer = { keycloakId: getUser.payload.keycloakId };
		}
		const rank = interaction.options.get("rank");
		if (rank) {
			askedPlayer = { rank: <number>rank.value };
		}
		return askedPlayer;
	}

	static async createPacketContext(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<PacketContext> {
		const groups = await KeycloakUtils.getUserGroups(keycloakConfig, user.id);
		if (groups.isError) {
			throw new Error("Error while getting user groups");
		}

		return {
			frontEndOrigin: PacketConstants.FRONT_END_ORIGINS.DISCORD,
			frontEndSubOrigin: interaction.guild?.id ?? PacketConstants.FRONT_END_SUB_ORIGINS.UNKNOWN,
			keycloakId: user.id,
			discord: {
				user: interaction.user.id,
				channel: interaction.channel.id,
				interaction: interaction.id,
				language: interaction.userLanguage,
				shardId
			},
			rightGroups: groups.payload.groups as RightGroup[]
		};
	}
}
