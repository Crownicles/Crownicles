import { packetHandler } from "../PacketHandler";
import { RequirementEffectPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	effectsErrorTextValue, replyEphemeralErrorMessage
} from "../../utils/ErrorUtils";
import { RequirementGuildNeededPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementGuildNeededPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { RequirementGuildRolePacket } from "../../../../Lib/src/packets/commands/requirements/RequirementGuildRolePacket";
import { RequirementLevelPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementLevelPacket";
import { RequirementRightPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementRightPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { RequirementWherePacket } from "../../../../Lib/src/packets/commands/requirements/RequirementWherePacket";
import { RequirementOracleNotMetPacket } from "../../../../Lib/src/packets/commands/CommandBlessingPacket";
import { MessagesUtils } from "../../utils/MessagesUtils";
import { MessageFlags } from "discord-api-types/v10";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { ButtonInteraction } from "discord.js";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

/**
 * Interaction answered with an effect error, and whether its deferred reply belongs to that answer and can be replaced
 */
type EffectReplyTarget = {
	interaction: ButtonInteraction | CrowniclesInteraction | null;
	ownsDeferredReply: boolean;
};

export default class CommandRequirementHandlers {
	/**
	 * Shared helper: fetches the interaction from cache, checks it exists,
	 * then replies with a translated ephemeral error message.
	 */
	private static async replyRequirementError(
		context: PacketContext,
		translationKey: string,
		translationParams?: Record<string, unknown>
	): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		await replyEphemeralErrorMessage(
			context,
			interaction,
			i18n.t(translationKey, {
				lng: interaction.userLanguage, ...translationParams
			})
		);
	}

	/**
	 * A click that could not be acknowledged accepts no answer: the effect then follows up the command, whose reply holds
	 * the collector and is kept
	 */
	private static getEffectReplyTarget(context: PacketContext): EffectReplyTarget {
		const clickId = context.discord!.buttonInteraction;
		const buttonInteraction = clickId ? DiscordCache.getButtonInteraction(clickId) : null;
		if (buttonInteraction) {
			return {
				interaction: buttonInteraction, ownsDeferredReply: true
			};
		}
		return {
			interaction: DiscordCache.getInteraction(context.discord!.interaction),
			ownsDeferredReply: !clickId
		};
	}

	@packetHandler(RequirementEffectPacket)
	async requirementEffect(context: PacketContext, packet: RequirementEffectPacket): Promise<void> {
		const {
			interaction, ownsDeferredReply
		} = CommandRequirementHandlers.getEffectReplyTarget(context);
		const lng = context.discord!.language!;

		const effectsText = effectsErrorTextValue(await DisplayUtils.getEscapedUsername(context.keycloakId!, lng), lng, true, packet.currentEffectId, packet.remainingTime);
		if (!interaction) {
			return;
		}
		if (ownsDeferredReply && interaction.deferred) {
			await interaction.deleteReply();
		}

		// Without a bind, context is lost for "this"
		await (interaction.replied || interaction.deferred ? interaction.followUp.bind(interaction) : interaction.reply.bind(interaction))({
			embeds: [
				new CrowniclesEmbed()
					.setErrorColor()
					.formatAuthor(effectsText.title, MessagesUtils.getClickUser(context) ?? interaction.user)
					.setDescription(effectsText.description)
			],
			flags: MessageFlags.Ephemeral
		});
	}

	@packetHandler(RequirementGuildNeededPacket)
	async requirementGuildNeeded(context: PacketContext, _packet: RequirementGuildNeededPacket): Promise<void> {
		await CommandRequirementHandlers.replyRequirementError(context, "error:notInAGuild");
	}

	@packetHandler(RequirementGuildRolePacket)
	async requirementGuildRole(context: PacketContext, _packet: RequirementGuildRolePacket): Promise<void> {
		await CommandRequirementHandlers.replyRequirementError(context, "error:notAuthorizedError");
	}

	@packetHandler(RequirementLevelPacket)
	async requirementLevel(context: PacketContext, packet: RequirementLevelPacket): Promise<void> {
		await CommandRequirementHandlers.replyRequirementError(context, "error:levelTooLow", { level: packet.requiredLevel });
	}

	@packetHandler(RequirementRightPacket)
	static async requirementRight(context: PacketContext, _packet: RequirementRightPacket): Promise<void> {
		await CommandRequirementHandlers.replyRequirementError(context, "error:notAuthorizedRight");
	}

	@packetHandler(RequirementWherePacket)
	async requirementWhere(context: PacketContext, _packet: RequirementWherePacket): Promise<void> {
		const interaction = MessagesUtils.getCurrentInteraction(context);
		await replyEphemeralErrorMessage(context, interaction, i18n.t("error:commandNotAvailableHere", { lng: interaction.userLanguage }));
	}

	@packetHandler(RequirementOracleNotMetPacket)
	async requirementOracleNotMet(context: PacketContext, _packet: RequirementOracleNotMetPacket): Promise<void> {
		const interaction = MessagesUtils.getCurrentInteraction(context);
		await replyEphemeralErrorMessage(context, interaction, i18n.t("error:oracleNotMet", { lng: interaction.userLanguage }));
	}
}
