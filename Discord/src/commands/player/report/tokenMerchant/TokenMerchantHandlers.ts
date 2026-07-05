import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportTokenMerchantBoughtRes,
	CommandReportTokenMerchantCharityRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorTokenMerchantData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorTokenMerchant";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, parseEmoji
} from "discord.js";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	DiscordCollectorUtils, disableRows
} from "../../../../utils/DiscordCollectorUtils";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../../../../Lib/src/Language";
import { ShopConstants } from "../../../../../../Lib/src/constants/ShopConstants";
import i18n from "../../../../translations/i18n";
import { escapeUsername } from "../../../../utils/StringUtils";

const BUY_BUTTON_PREFIX = "buy_";
const REFUSE_BUTTON_ID = "refuse";

/**
 * Build the token merchant offer embed.
 */
function buildMerchantEmbed(
	interaction: NonNullable<ReturnType<typeof DiscordCache.getInteraction>>,
	lng: Language,
	data: ReactionCollectorTokenMerchantData
): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.tokenMerchant.title", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.tokenMerchant.description", {
			lng,
			pricePerToken: data.pricePerToken,
			playerMoney: data.playerMoney,
			playerTokens: data.playerTokens,
			maxDaily: ShopConstants.MAX_DAILY_TOKEN_BUYOUTS,
			maxWeekly: ShopConstants.MAX_WEEKLY_TOKEN_BUYOUTS
		}));
}

/**
 * Build one buy button per available bundle, then a refuse button. The
 * button order MUST match the collector's reactions order so the reaction
 * index resolves to the right bundle on the backend.
 */
function buildMerchantButtons(data: ReactionCollectorTokenMerchantData, lng: Language): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>();

	data.amounts.forEach((amount, index) => {
		row.addComponents(new ButtonBuilder()
			.setCustomId(`${BUY_BUTTON_PREFIX}${index}`)
			.setLabel(i18n.t("commands:report.tokenMerchant.buyButton", {
				lng,
				count: amount,
				price: amount * data.pricePerToken
			}))
			.setEmoji(parseEmoji(CrowniclesIcons.unitValues.token)!)
			.setStyle(ButtonStyle.Primary));
	});

	row.addComponents(new ButtonBuilder()
		.setCustomId(REFUSE_BUTTON_ID)
		.setLabel(i18n.t("commands:report.tokenMerchant.refuseButton", { lng }))
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		.setStyle(ButtonStyle.Secondary));

	return row;
}

type MerchantCollectorState = {
	context: PacketContext;
	packet: ReactionCollectorCreationPacket;
	lng: Language;
	row: ActionRowBuilder<ButtonBuilder>;
	msg: Message;
	embed: CrowniclesEmbed;
	refuseIndex: number;
};

/**
 * Handle a click on a merchant button: disable the offer, defer the reply and
 * forward the resolved reaction index to the backend.
 */
async function onMerchantButtonCollect(buttonInteraction: ButtonInteraction, state: MerchantCollectorState): Promise<void> {
	const {
		context, packet, lng, row, msg, embed, refuseIndex
	} = state;
	if (buttonInteraction.user.id !== context.discord?.user) {
		await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
		return;
	}

	disableRows([row]);
	await msg.edit({
		embeds: [embed],
		components: [row]
	});

	await buttonInteraction.deferReply();

	const reactionIndex = buttonInteraction.customId.startsWith(BUY_BUTTON_PREFIX)
		? Number.parseInt(buttonInteraction.customId.slice(BUY_BUTTON_PREFIX.length), 10)
		: refuseIndex;
	DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
}

/**
 * Disable the merchant offer buttons when the collector ends.
 */
async function onMerchantCollectorEnd(state: MerchantCollectorState): Promise<void> {
	const {
		row, msg, embed
	} = state;
	disableRows([row]);
	await msg.edit({
		embeds: [embed],
		components: [row]
	}).catch(() => null);
}

/**
 * Render the token merchant collector (offer + buy/refuse buttons).
 */
export async function createTokenMerchantCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const data = packet.data.data as ReactionCollectorTokenMerchantData;

	const embed = buildMerchantEmbed(interaction, lng, data);
	const row = buildMerchantButtons(data, lng);

	const msg = await interaction.followUp({
		embeds: [embed],
		components: [row]
	});
	if (!msg) {
		return null;
	}

	const refuseIndex = data.amounts.length;
	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	const state: MerchantCollectorState = {
		context, packet, lng, row, msg, embed, refuseIndex
	};
	buttonCollector.on("collect", (buttonInteraction: ButtonInteraction) => onMerchantButtonCollect(buttonInteraction, state));
	buttonCollector.on("end", () => onMerchantCollectorEnd(state));

	return [buttonCollector];
}

/**
 * Send a merchant result embed, editing the deferred buy button reply when
 * the result follows a purchase, or following up the report message when
 * the merchant answered immediately (charity / cannot afford / limit).
 */
async function replyMerchantResult(context: PacketContext, embed: CrowniclesEmbed): Promise<void> {
	const buttonInteractionId = context.discord?.buttonInteraction;
	const buttonInteraction = buttonInteractionId ? DiscordCache.getButtonInteraction(buttonInteractionId) : undefined;
	if (buttonInteraction) {
		await buttonInteraction.editReply({ embeds: [embed] });
		return;
	}

	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	await interaction?.followUp({ embeds: [embed] });
}

/**
 * Build a merchant result embed from a title and description key.
 */
function buildResultEmbed(
	context: PacketContext,
	titleKey: string,
	descriptionKey: string,
	descriptionParams: Record<string, unknown> = {},
	isError = false
): CrowniclesEmbed | null {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t(titleKey, {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t(descriptionKey, {
			lng,
			...descriptionParams
		}));
	if (isError) {
		embed.setErrorColor();
	}
	return embed;
}

export async function handleTokenMerchantBought(packet: CommandReportTokenMerchantBoughtRes, context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.boughtTitle", "commands:report.tokenMerchant.boughtDescription", { count: packet.amount });
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantTooMuch(context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.tooMuchTitle", "commands:report.tokenMerchant.tooMuchDescription", {}, true);
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantFull(context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.fullTitle", "commands:report.tokenMerchant.fullDescription", {}, true);
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantRefuse(context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.refuseTitle", "commands:report.tokenMerchant.refuseDescription", {}, true);
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantCannotAfford(context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.cannotAffordTitle", "commands:report.tokenMerchant.cannotAffordDescription", {}, true);
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantCharity(packet: CommandReportTokenMerchantCharityRes, context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.charityTitle", "commands:report.tokenMerchant.charityDescription", { count: packet.amount });
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}

export async function handleTokenMerchantCharityAlreadyUsed(context: PacketContext): Promise<void> {
	const embed = buildResultEmbed(context, "commands:report.tokenMerchant.charityAlreadyUsedTitle", "commands:report.tokenMerchant.charityAlreadyUsedDescription", {}, true);
	if (embed) {
		await replyMerchantResult(context, embed);
	}
}
