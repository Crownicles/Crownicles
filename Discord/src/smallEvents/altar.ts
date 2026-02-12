import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import {
	disableRows, DiscordCollectorUtils
} from "../utils/DiscordCollectorUtils";
import {
	ReactionCollectorAltarContributeReaction, ReactionCollectorAltarPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorAltar";
import { ReactionCollectorRefuseReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import i18n from "../translations/i18n";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	SmallEventAltarContributedPacket,
	SmallEventAltarFirstEncounterPacket,
	SmallEventAltarNoContributionPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import { Language } from "../../../Lib/src/Language";

export async function altarCollector(context: PacketContext, packet: ReactionCollectorAltarPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data;

	// Build contribution reactions (exclude the refuse reaction), sorted by ascending amount
	const contributeReactions = packet.reactions.filter(
		r => r.type === ReactionCollectorAltarContributeReaction.name
	).sort((a, b) => (a.data as ReactionCollectorAltarContributeReaction).amount - (b.data as ReactionCollectorAltarContributeReaction).amount);

	const embed = new CrowniclesSmallEventEmbed(
		"altar",
		`${getRandomSmallEventIntro(lng)}${StringUtils.getRandomTranslation("smallEvents:altar.intro", lng, {
			poolAmount: data.poolAmount,
			poolThreshold: data.poolThreshold,
			moneyEmote: CrowniclesIcons.unitValues.money
		})}\n\n${i18n.t("smallEvents:altar.menu", { lng })}`,
		interaction.user,
		lng
	);

	const row = new ActionRowBuilder<ButtonBuilder>();

	// Create contribution buttons
	for (let idx = 0; idx < contributeReactions.length; idx++) {
		const amount = (contributeReactions[idx].data as ReactionCollectorAltarContributeReaction).amount;
		const button = new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.altarSmallEvent.contribute)!)
			.setLabel(`${amount}`)
			.setCustomId(`contribute_${idx}`)
			.setStyle(ButtonStyle.Primary);
		row.addComponents(button);
	}

	// Add refuse button
	const refuseButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.altarSmallEvent.refuse)!)
		.setCustomId("refuse")
		.setStyle(ButtonStyle.Secondary);
	row.addComponents(refuseButton);

	const msg = await interaction.editReply({
		embeds: [embed],
		components: [row]
	}) as Message;

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();

		if (buttonInteraction.customId === "refuse") {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				packet.reactions.findIndex(r => r.type === ReactionCollectorRefuseReaction.name)
			);
		}
		else if (buttonInteraction.customId.startsWith("contribute_")) {
			const sortedIdx = parseInt(buttonInteraction.customId.split("_")[1]);
			const originalIdx = packet.reactions.indexOf(contributeReactions[sortedIdx]);
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				originalIdx
			);
		}
	});

	buttonCollector.on("end", async () => {
		disableRows([row]);
		await msg.edit({ components: [row] });
	});

	return [buttonCollector];
}

function determineNoContributionStory(packet: SmallEventAltarNoContributionPacket): string {
	if (!packet.hasEnoughMoney) {
		return "notEnoughMoney";
	}
	return "refused";
}

function determineContributedStory(packet: SmallEventAltarContributedPacket): string {
	if (packet.blessingTriggered) {
		return "blessingTriggered";
	}
	return "contributed";
}

function buildAltarBonusText(packet: SmallEventAltarContributedPacket, lng: Language): string {
	let bonusText = "";
	if (packet.bonusGems > 0) {
		bonusText += `\n\n${StringUtils.getRandomTranslation("smallEvents:altar.bonusGems", lng, {
			gems: packet.bonusGems,
			gemEmote: CrowniclesIcons.unitValues.gem
		})}`;
	}
	if (packet.bonusItemGiven) {
		bonusText += `\n\n${StringUtils.getRandomTranslation("smallEvents:altar.bonusItem", lng)}`;
	}
	if (packet.badgeAwarded) {
		bonusText += `\n\n${i18n.t("smallEvents:altar.badgeAwarded", { lng })}`;
	}
	return bonusText;
}

export async function altarFirstEncounter(_packet: SmallEventAltarFirstEncounterPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"altar",
				`${getRandomSmallEventIntro(lng)}${i18n.t("smallEvents:altar.firstEncounter", { lng })}`,
				interaction.user,
				lng
			)
		]
	});
}

/**
 * Send an altar result embed after the player interacted with the collector
 */
async function sendAltarResultEmbed(
	context: PacketContext,
	story: string,
	translationParams: Record<string, unknown>,
	bonusText = ""
): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"altar",
				StringUtils.getRandomTranslation(`smallEvents:altar.${story}`, lng, translationParams) + bonusText,
				interaction.user,
				lng
			)
		]
	});
}

export async function altarNoContribution(packet: SmallEventAltarNoContributionPacket, context: PacketContext): Promise<void> {
	await sendAltarResultEmbed(context, determineNoContributionStory(packet), {
		amount: packet.amount,
		moneyEmote: CrowniclesIcons.unitValues.money,
		poolAmount: packet.newPoolAmount,
		poolThreshold: packet.poolThreshold
	});
}

export async function altarContributed(packet: SmallEventAltarContributedPacket, context: PacketContext): Promise<void> {
	const lng = context.discord!.language;
	await sendAltarResultEmbed(
		context,
		determineContributedStory(packet),
		{
			amount: packet.amount,
			moneyEmote: CrowniclesIcons.unitValues.money,
			poolAmount: packet.newPoolAmount,
			poolThreshold: packet.poolThreshold,
			blessingType: packet.blessingTriggered
				? i18n.t(`bot:blessingNames.${packet.blessingType}`, { lng })
				: ""
		},
		buildAltarBonusText(packet, lng)
	);
}
