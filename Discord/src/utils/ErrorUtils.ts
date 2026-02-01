import {
	MessageComponentInteraction, User
} from "discord.js";
import { CrowniclesErrorEmbed } from "../messages/CrowniclesErrorEmbed";
import {
	LANGUAGE, Language
} from "../../../Lib/src/Language";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import i18n from "../translations/i18n";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { escapeUsername } from "../../../Lib/src/utils/StringUtils";
import { millisecondsToMinutes } from "../../../Lib/src/utils/TimeUtils";
import { Effect } from "../../../Lib/src/types/Effect";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { MessagesUtils } from "./MessagesUtils";
import { MessageFlags } from "discord-api-types/v10";

/**
 * Reply to an interaction with an ephemeral error PREFER {@link sendErrorMessage} for most cases
 * @param context
 * @param interaction
 * @param reason
 */
export async function replyEphemeralErrorMessage(context: PacketContext | null, interaction: CrowniclesInteraction, reason: string): Promise<void> {
	if (interaction.deferred) {
		await interaction.deleteReply();
	}

	// Without a bind, context is lost for "this"
	await (interaction.replied || interaction.deferred ? interaction.followUp.bind(interaction) : interaction.reply.bind(interaction))({
		embeds: [new CrowniclesErrorEmbed(interaction.user, context, interaction, reason)],
		flags: MessageFlags.Ephemeral
	});
}

export enum SendManner {
	SEND = "SEND",
	REPLY = "REPLY",
	FOLLOWUP = "FOLLOWUP",
	EDIT_REPLY = "EDIT_REPLY"
}

/**
 * Sends an error message
 * @param user
 * @param context
 * @param interaction
 * @param reason
 * @param isCancelling - true if the error is a cancelling error
 * @param isBlockedError - set to false if you don't want the "this user is blocked" message when selecting a different user than the one who invoked the command
 * @param sendManner
 */
export async function sendErrorMessage(
	user: User,
	context: PacketContext,
	interaction: CrowniclesInteraction,
	reason: string,
	{
		isCancelling = false,
		isBlockedError = true,
		sendManner = SendManner.SEND
	}: {
		isCancelling?: boolean;
		isBlockedError?: boolean;
		sendManner?: SendManner;
	} = {}
): Promise<void> {
	const sendArg = {
		embeds: [new CrowniclesErrorEmbed(user, context, interaction, reason, isCancelling, isBlockedError)]
	};
	switch (sendManner) {
		case SendManner.REPLY:
			await interaction.reply(sendArg);
			break;
		case SendManner.EDIT_REPLY:
			await interaction.editReply(sendArg);
			break;
		case SendManner.FOLLOWUP:
			await interaction.followUp(sendArg);
			break;
		default:
			await interaction.channel.send(sendArg);
			break;
	}
}

export async function sendInteractionNotForYou(
	user: User,
	interaction: MessageComponentInteraction,
	lng: Language
): Promise<void> {
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setDescription(i18n.t("error:interactionNotForYou", { lng }))
				.setErrorColor()
				.formatAuthor(i18n.t("error:titleDidntWork", {
					lng,
					pseudo: escapeUsername(user.displayName)
				}), user)
		],
		flags: MessageFlags.Ephemeral
	});
}

/**
 * Get the translation key for the description of an effect
 * @param effectId
 * @param self
 */
function getDescriptionTranslationKey(effectId: string, self: boolean): string {
	switch (effectId) {
		case Effect.NO_EFFECT.id:
			return "error:notPossibleWithoutStatus";
		case Effect.NOT_STARTED.id:
			return `error:effects.notStartedHint.${self ? "self" : "other"}`;
		case Effect.DEAD.id:
			return `error:effects.deadHint.${self ? "self" : "other"}`;
		default:
			return self ? "error:pleaseWaitForHeal" : "error:pleaseWaitForHisHeal";
	}
}

/**
 * Send an error message if the user has an effect
 * @param escapedPseudo
 * @param lng
 * @param self
 * @param effectId
 * @param effectRemainingTime
 */
export function effectsErrorTextValue(escapedPseudo: string, lng: Language, self: boolean, effectId: string, effectRemainingTime: number): {
	title: string;
	description: string;
} {
	return {
		title: i18n.t(`error:effects.${effectId}.${self ? "self" : "other"}`, {
			lng,
			pseudo: escapedPseudo
		}),
		description: i18n.t(`{emote:effects.${effectId}} $t(${getDescriptionTranslationKey(effectId, self)})`, {
			lng,
			time: i18n.formatDuration(millisecondsToMinutes(effectRemainingTime), lng)
		})
	};
}

/**
 * Handle classical errors
 * @param context
 * @param errorKey
 * @param replacements
 * @param opts
 */
export async function handleClassicError(context: PacketContext, errorKey: string, replacements: {
	[key: string]: unknown;
} = {}, opts: {
	ephemeral?: boolean; forcedTitle?: string;
} = {}): Promise<void> {
	const interactionToRespondTo = MessagesUtils.getCurrentInteraction(context);
	const lng = interactionToRespondTo.userLanguage ?? context.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE;

	const embed = new CrowniclesErrorEmbed(
		interactionToRespondTo.user,
		context,
		interactionToRespondTo,
		i18n.t(errorKey, {
			lng,
			...replacements
		})
	);

	if (opts.forcedTitle) {
		embed.setTitle(i18n.t(opts.forcedTitle, {
			lng,
			...replacements
		}));
	}

	await (!interactionToRespondTo.replied
		? interactionToRespondTo.deferred
			? interactionToRespondTo.editReply.bind(interactionToRespondTo)
			: interactionToRespondTo.reply.bind(interactionToRespondTo)
		: interactionToRespondTo.followUp.bind(interactionToRespondTo)
	)({
		embeds: [embed],
		flags: opts.ephemeral ? MessageFlags.Ephemeral as number : 0
	});
}
