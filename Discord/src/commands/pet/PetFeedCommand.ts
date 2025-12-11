import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetFeedPacketReq,
	CommandPetFeedSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ReactionCollectorPetFeedWithGuildFoodReaction,
	ReactionCollectorPetFeedWithGuildPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorPetFeedWithoutGuildPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandPetFeedPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandPetFeedPacketReq, {});
}

export async function handleCommandPetFeedSuccessPacket(packet: CommandPetFeedSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);

	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;
	const title = i18n.t("commands:petFeed.resultTitle", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	});
	const description = i18n.t(`commands:petFeed.result.${packet.result}`, { lng });

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(title, interaction.user)
				.setDescription(description)
		]
	});
}

export async function handleCommandPetFeedWithGuildCollector(context: PacketContext, packet: ReactionCollectorPetFeedWithGuildPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const data = packet.data.data;
	const foodReactions = packet.reactions.map((reaction, index) => ({
		reaction,
		index
	}))
		.filter((r): r is { reaction: { type: string; data: ReactionCollectorPetFeedWithGuildFoodReaction }; index: number } => r.reaction.type === ReactionCollectorPetFeedWithGuildFoodReaction.name);
	const refuseIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);

	const rowFood = new ActionRowBuilder<ButtonBuilder>();
	let foodsList = "";

	for (const foodReaction of foodReactions) {
		const foodData = foodReaction.reaction.data as ReactionCollectorPetFeedWithGuildFoodReaction;
		foodsList += `${i18n.t("commands:petFeed.feedFoodBullet", {
			lng,
			food: StringUtils.capitalizeFirstLetter(DisplayUtils.getFoodDisplay(foodData.food, 1, lng, true)), // Singular here even if there is more than one food
			amount: foodData.amount,
			maxAmount: foodData.maxAmount
		})}\n`;
		rowFood.addComponents(new ButtonBuilder()
			.setCustomId(foodReaction.index.toString())
			.setStyle(ButtonStyle.Secondary)
			.setEmoji(CrowniclesIcons.foods[foodData.food]));
	}

	const refuseCustomId = "refuse";
	const rowRefuse = new ActionRowBuilder<ButtonBuilder>();
	rowRefuse.addComponents(new ButtonBuilder()
		.setCustomId(refuseCustomId)
		.setStyle(ButtonStyle.Secondary)
		.setLabel(i18n.t("commands:petFeed.cancelButton", { lng }))
		.setEmoji(CrowniclesIcons.collectors.refuse));

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:petFeed.feedTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(`${i18n.t("commands:petFeed.feedDescription", {
			lng,
			pet: DisplayUtils.getOwnedPetInlineDisplay(data.pet, lng)
		})}\n\n${foodsList}`);

	const msg = await interaction?.editReply({
		embeds: [embed],
		components: [rowFood, rowRefuse]
	}) as Message;

	const msgCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	msgCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();

		if (buttonInteraction.customId === refuseCustomId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				refuseIndex
			);
			return;
		}

		DiscordCollectorUtils.sendReaction(
			packet,
			context,
			context.keycloakId!,
			buttonInteraction,
			parseInt(buttonInteraction.customId, 10)
		);
	});

	msgCollector.on("end", async () => {
		rowFood.components.forEach(component => {
			component.setDisabled(true);
		});

		rowRefuse.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({
			components: [rowFood, rowRefuse]
		});
	});

	return [msgCollector];
}

export async function handleCommandPetFeedWithoutGuildCollector(context: PacketContext, packet: ReactionCollectorPetFeedWithoutGuildPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const data = packet.data.data;

	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:petFeed.feedTitle", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:petFeed.feedWithoutGuildDesc", {
				lng,
				pet: DisplayUtils.getOwnedPetInlineDisplay(data.pet, lng),
				food: StringUtils.capitalizeFirstLetter(DisplayUtils.getFoodDisplay(data.food, 1, lng, true)),
				price: data.price
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petFeed"),
	getPacket,
	mainGuildCommand: false
};
