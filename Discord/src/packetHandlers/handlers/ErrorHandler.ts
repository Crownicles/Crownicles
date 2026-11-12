import { packetHandler } from "../PacketHandler";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import {
	ErrorBannedPacket,
	ErrorInternalPacket,
	ErrorMaintenancePacket,
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
import { escapeCodeBlock } from "discord.js";
import { SendManner } from "../../messages/CrowniclesInteraction";
import { MessagesUtils } from "../../utils/MessagesUtils";

export default class ErrorHandler {
	@packetHandler(BlockedPacket)
	async blockedHandler(context: PacketContext, packet: BlockedPacket): Promise<void> {
		const commandInteraction = DiscordCache.getInteraction(context.discord!.interaction);
		const target = MessagesUtils.getButtonClick(context) ?? commandInteraction;
		if (!target) {
			return;
		}
		const lng = commandInteraction?.userLanguage ?? LANGUAGE.ENGLISH;
		const embed = await ErrorHandler.buildBlockedEmbed(context, packet, lng);

		// An interaction already answered keeps its answer: the blocking reasons are sent in the channel
		await target.respond({ embeds: [embed] }, target.replied ? { manner: SendManner.SEND } : {});
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

	@packetHandler(ErrorInternalPacket)
	async internalErrorHandler(context: PacketContext, packet: ErrorInternalPacket): Promise<void> {
		// The interaction often expired already, since the packet that failed took long enough to break
		if (!DiscordCache.getInteraction(context.discord!.interaction)) {
			return;
		}

		// The reason lands inside a code block: a backtick in it would break out of the fence
		await handleClassicError(context, "error:internalError", { reason: escapeCodeBlock(packet.reason) }, { ephemeral: true });
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
