import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import {
	ErrorBannedPacket,
	ErrorMaintenancePacket,
	ErrorPacket,
	ErrorResetIsNow,
	ErrorSeasonEndIsNow
} from "../../../../Lib/src/packets/commands/ErrorPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { BlockedPacket } from "../../../../Lib/src/packets/commands/BlockedPacket";
import {
	Language,
	LANGUAGE
} from "../../../../Lib/src/Language";
import { handleClassicError } from "../../utils/ErrorUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { formatBlockedReasons } from "../../utils/BlockingReasonUtils";
import {
	ButtonInteraction
} from "discord.js";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

type BlockedReplyTarget = {
	interaction: CrowniclesInteraction | null;
	buttonInteraction: ButtonInteraction | null;
};

type EmbedReplyOptions = {
	embeds: CrowniclesEmbed[];
};

export default class ErrorHandler {
	@packetHandler(ErrorPacket)
	async errorHandler(context: PacketContext, packet: ErrorPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const embed = new CrowniclesEmbed()
			.setErrorColor()
			.setTitle(i18n.t("error:unexpectedError", { lng: interaction.userLanguage }))
			.setDescription(packet.message);

		await interaction.channel.send({ embeds: [embed] });
	}

	@packetHandler(BlockedPacket)
	async blockedHandler(context: PacketContext, packet: BlockedPacket): Promise<void> {
		const target = ErrorHandler.getBlockedReplyTarget(context);
		const lng = target.interaction?.userLanguage ?? LANGUAGE.ENGLISH;
		const embed = await ErrorHandler.buildBlockedEmbed(context, packet, lng);

		await ErrorHandler.sendBlockedEmbed(target, embed);
	}

	private static getBlockedReplyTarget(context: PacketContext): BlockedReplyTarget {
		return {
			interaction: DiscordCache.getInteraction(context.discord!.interaction),
			buttonInteraction: context.discord?.buttonInteraction
				? DiscordCache.getButtonInteraction(context.discord.buttonInteraction)
				: null
		};
	}

	private static async buildBlockedEmbed(context: PacketContext, packet: BlockedPacket, lng: Language): Promise<CrowniclesEmbed> {
		return new CrowniclesEmbed()
			.setErrorColor()
			.setTitle(i18n.t("error:titleDidntWork", {
				lng,
				pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
			}))
			.setDescription(await ErrorHandler.buildBlockedDescription(context, packet, lng));
	}

	private static async buildBlockedDescription(context: PacketContext, packet: BlockedPacket, lng: Language): Promise<string> {
		const errorReasons = formatBlockedReasons(packet.reasons, lng);
		if (context.keycloakId !== packet.keycloakId) {
			return i18n.t("error:anotherPlayerBlocked", {
				lng,
				username: await DisplayUtils.getEscapedUsername(packet.keycloakId!, lng),
				reasons: errorReasons
			});
		}

		return i18n.t("error:playerBlocked", {
			lng,
			reasons: errorReasons
		});
	}

	private static async sendBlockedEmbed(target: BlockedReplyTarget, embed: CrowniclesEmbed): Promise<void> {
		const replyOptions: EmbedReplyOptions = { embeds: [embed] };
		if (target.buttonInteraction) {
			await ErrorHandler.sendBlockedEmbedToButtonInteraction(target, replyOptions);
			return;
		}

		await ErrorHandler.sendBlockedEmbedToCommandInteraction(target.interaction, replyOptions);
	}

	private static async sendBlockedEmbedToButtonInteraction(target: BlockedReplyTarget, replyOptions: EmbedReplyOptions): Promise<void> {
		const buttonInteraction = target.buttonInteraction!;
		if (buttonInteraction.deferred) {
			await buttonInteraction.editReply(replyOptions);
			return;
		}

		if (!buttonInteraction.replied) {
			await buttonInteraction.reply(replyOptions);
			return;
		}

		await target.interaction?.channel.send(replyOptions);
	}

	private static async sendBlockedEmbedToCommandInteraction(interaction: CrowniclesInteraction | null, replyOptions: EmbedReplyOptions): Promise<void> {
		if (!interaction) {
			return;
		}

		if (interaction.deferred && !interaction.replyEdited) {
			await interaction.editReply(replyOptions);
			return;
		}

		if (!interaction.deferred && !interaction.replied) {
			await interaction.reply(replyOptions);
			return;
		}

		await interaction.channel.send(replyOptions);
	}

	@packetHandler(ErrorMaintenancePacket)
	async maintenanceHandler(context: PacketContext, _packet: ErrorMaintenancePacket): Promise<void> {
		await handleClassicError(context, "error:maintenance", {}, {
			forcedTitle: "error:maintenanceTitle"
		});
	}

	@packetHandler(ErrorBannedPacket)
	async bannedHandler(context: PacketContext, _packet: ErrorBannedPacket): Promise<void> {
		await handleClassicError(context, "error:banned");
	}

	@packetHandler(ErrorResetIsNow)
	async resetIsNowHandler(context: PacketContext, _packet: ErrorResetIsNow): Promise<void> {
		await handleClassicError(context, "error:resetIsNow");
	}

	@packetHandler(ErrorSeasonEndIsNow)
	async seasonEndIsNowHandler(context: PacketContext, _packet: ErrorResetIsNow): Promise<void> {
		await handleClassicError(context, "error:seasonEndIsNow");
	}
}
