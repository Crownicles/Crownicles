import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetTransferPacketReq,
	CommandPetTransferSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	MessageActionRowComponentBuilder, SlashCommandBuilder
} from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import {
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ReactionCollectorPetTransferData,
	ReactionCollectorPetTransferDepositReaction,
	ReactionCollectorPetTransferPacket,
	ReactionCollectorPetTransferSwitchReaction,
	ReactionCollectorPetTransferWithdrawReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetTransfer";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Message,
	MessageComponentInteraction,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import {
	LANGUAGE, Language
} from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import {
	disableRows, DiscordCollectorUtils
} from "../../utils/DiscordCollectorUtils";
import { MessagesUtils } from "../../utils/MessagesUtils";
import { escapeUsername } from "../../utils/StringUtils";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandPetTransferPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandPetTransferPacketReq, {});
}

export async function handlePetTransferSuccess(context: PacketContext, packet: CommandPetTransferSuccessPacket): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);

	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage ?? context.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE;

	const oldPetDisplay = packet.oldPet ? DisplayUtils.getOwnedPetInlineDisplay(packet.oldPet, lng) : null;
	const newPetDisplay = packet.newPet ? DisplayUtils.getOwnedPetInlineDisplay(packet.newPet, lng) : null;

	const i18nDescriptionKey = `commands:petTransfer.confirm${oldPetDisplay && newPetDisplay ? "Switch" : oldPetDisplay ? "Deposit" : "Withdraw"}`;

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:petTransfer.confirmTransferTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(i18nDescriptionKey, {
					lng,
					oldPet: oldPetDisplay,
					newPet: newPetDisplay
				}))
		]
	});
}

type ReactionMap = {
	reaction: {
		type: string;
		data: ReactionCollectorReaction;
	};
	index: number;
};

const depositCustomId = "deposit";
const switchCustomId = "switch";
const withdrawCustomId = "withdraw";
const refuseCustomId = "refuse";
const backCustomId = "back";

function getMainMenuComponents(
	data: ReactionCollectorPetTransferData,
	reactions: {
		deposit?: ReactionMap;
		switches: ReactionMap[];
		withdraws: ReactionMap[];
		refuse?: ReactionMap;
	},
	lng: Language
): ActionRowBuilder<ButtonBuilder>[] {
	const rows = [];

	if (reactions.deposit) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.petTransfer.deposit)!)
				.setLabel(i18n.t("commands:petTransfer.depositButton", {
					lng,
					pet: DisplayUtils.getOwnedPetInlineDisplay(data.ownPet!, lng)
				}))
				.setStyle(ButtonStyle.Secondary)
				.setCustomId(depositCustomId)
		));
	}

	if (reactions.switches.length > 0) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.petTransfer.switch)!)
				.setLabel(i18n.t("commands:petTransfer.switchButton", {
					lng,
					pet: DisplayUtils.getOwnedPetInlineDisplay(data.ownPet!, lng)
				}))
				.setStyle(ButtonStyle.Secondary)
				.setCustomId(switchCustomId)
		));
	}

	if (reactions.withdraws.length > 0) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.petTransfer.withdraw)!)
				.setLabel(i18n.t("commands:petTransfer.withdrawButton", { lng }))
				.setStyle(ButtonStyle.Secondary)
				.setCustomId(withdrawCustomId)
		));
	}

	rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setLabel(i18n.t("commands:petTransfer.refuseButton", { lng }))
			.setStyle(ButtonStyle.Secondary)
			.setCustomId(refuseCustomId)
	));

	return rows;
}

function getBackButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.back)!)
		.setLabel(i18n.t("commands:petTransfer.backButton", { lng }))
		.setStyle(ButtonStyle.Secondary)
		.setCustomId(backCustomId);
}

function getShelterPetSelectMenu(
	data: ReactionCollectorPetTransferData,
	reactions: ReactionMap[],
	placeHolder: string,
	lng: Language
): StringSelectMenuBuilder {
	return new StringSelectMenuBuilder()
		.setPlaceholder(placeHolder)
		.setCustomId("switchSelect")
		.addOptions(reactions.map(reaction => {
			const reactionData = reaction.reaction.data as ReactionCollectorPetTransferSwitchReaction;
			const shelterPet = data.shelterPets.find(pet => pet.petEntityId === reactionData.petEntityId)!;
			return new StringSelectMenuOptionBuilder()
				.setLabel(DisplayUtils.getPetNicknameOrTypeName(shelterPet.pet.nickname, shelterPet.pet.typeId, shelterPet.pet.sex, lng))
				.setEmoji(parseEmoji(DisplayUtils.getPetIcon(shelterPet.pet.typeId, shelterPet.pet.sex))!)
				.setValue(reaction.index.toString())
				.setDescription(i18n.t("commands:petTransfer.selectMenuPetDetails", {
					lng,
					rarity: DisplayUtils.getPetRarityDisplay(shelterPet.pet.rarity, lng),
					sex: DisplayUtils.getPetSexName(shelterPet.pet.sex, lng),
					loveLevel: DisplayUtils.getPetLoveLevelDisplay(shelterPet.pet.loveLevel, shelterPet.pet.sex, lng, false)
				}));
		}));
}

function getSwitchComponents(
	data: ReactionCollectorPetTransferData,
	reactions: ReactionMap[],
	lng: Language
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const rows = [];

	rows.push(new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(
			getShelterPetSelectMenu(
				data,
				reactions,
				i18n.t("commands:petTransfer.switchPlaceholder", {
					lng,
					pet: DisplayUtils.getOwnedPetInlineDisplay(data.ownPet!, lng)
				}),
				lng
			)
		));

	rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(getBackButton(lng)));

	return rows;
}

function getWithdrawComponents(
	data: ReactionCollectorPetTransferData,
	reactions: ReactionMap[],
	lng: Language
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
	const rows = [];

	rows.push(new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(
			getShelterPetSelectMenu(
				data,
				reactions,
				i18n.t("commands:petTransfer.withdrawPlaceholder", { lng }),
				lng
			)
		));

	rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(getBackButton(lng)));

	return rows;
}

async function showMenu(
	interaction: MessageComponentInteraction,
	embed: CrowniclesEmbed,
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[]
): Promise<ActionRowBuilder<MessageActionRowComponentBuilder>[]> {
	await interaction.update({
		embeds: [embed],
		components
	});
	return components;
}

async function sendButtonReaction(
	interaction: MessageComponentInteraction,
	packet: ReactionCollectorPetTransferPacket,
	context: PacketContext,
	reaction: ReactionMap
): Promise<void> {
	await interaction.deferReply();
	DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, interaction, reaction.index);
}

async function sendSelectedPetReaction(
	interaction: StringSelectMenuInteraction,
	packet: ReactionCollectorPetTransferPacket,
	context: PacketContext,
	display: {
		embed: CrowniclesEmbed;
		components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	}
): Promise<void> {
	await interaction.deferUpdate();
	DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, interaction, parseInt(interaction.values[0], 10));

	// Immediately disable all components to prevent further clicks
	disableRows(display.components);
	await interaction.editReply({
		embeds: [display.embed],
		components: display.components
	});
}

/**
 * Dispatch on the interaction itself rather than on the menu shown when it was clicked:
 * a stale or double click can deliver a main menu button while a sub menu is displayed
 */
async function handlePetTransferCollect(
	packet: ReactionCollectorPetTransferPacket,
	context: PacketContext,
	reactions: {
		depositReaction?: ReactionMap;
		refuseReaction?: ReactionMap;
	},
	discord: {
		collectedInteraction: MessageComponentInteraction;
		mainMenuEmbed: CrowniclesEmbed;
		switchComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[];
		withdrawComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[];
		mainMenuComponents: ActionRowBuilder<ButtonBuilder>[];
		currentComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	}
): Promise<ActionRowBuilder<MessageActionRowComponentBuilder>[]> {
	const {
		collectedInteraction: interaction, currentComponents
	} = discord;

	if (interaction.isStringSelectMenu()) {
		await sendSelectedPetReaction(interaction, packet, context, {
			embed: discord.mainMenuEmbed,
			components: currentComponents
		});
		return currentComponents;
	}

	switch (interaction.customId) {
		case depositCustomId:
			await sendButtonReaction(interaction, packet, context, reactions.depositReaction!);
			return currentComponents;
		case refuseCustomId:
			await sendButtonReaction(interaction, packet, context, reactions.refuseReaction!);
			return currentComponents;
		case switchCustomId:
			return await showMenu(interaction, discord.mainMenuEmbed, discord.switchComponents);
		case withdrawCustomId:
			return await showMenu(interaction, discord.mainMenuEmbed, discord.withdrawComponents);
		case backCustomId:
			return await showMenu(interaction, discord.mainMenuEmbed, discord.mainMenuComponents);
		default:
			return currentComponents;
	}
}


export async function handlePetTransferReactionCollector(context: PacketContext, packet: ReactionCollectorPetTransferPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const data = packet.data.data;
	const depositReaction = packet.reactions.map((reaction, index) => ({
		reaction,
		index
	}))
		.find(reaction => reaction.reaction.type === ReactionCollectorPetTransferDepositReaction.name);
	const switchReactions = packet.reactions.map((reaction, index) => ({
		reaction,
		index
	}))
		.filter(reaction => reaction.reaction.type === ReactionCollectorPetTransferSwitchReaction.name);
	const withdrawReactions = packet.reactions.map((reaction, index) => ({
		reaction,
		index
	}))
		.filter(reaction => reaction.reaction.type === ReactionCollectorPetTransferWithdrawReaction.name);
	const refuseReaction = packet.reactions.map((reaction, index) => ({
		reaction,
		index
	}))
		.find(reaction => reaction.reaction.type === ReactionCollectorRefuseReaction.name);

	const mainMenuEmbed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:petTransfer.chooseActionTitle", { lng }), interaction.user)
		.setDescription(i18n.t("commands:petTransfer.chooseActionDesc", { lng }));

	const mainMenuComponents = getMainMenuComponents(data, {
		deposit: depositReaction,
		switches: switchReactions,
		withdraws: withdrawReactions,
		refuse: refuseReaction
	}, lng);
	const switchComponents = switchReactions.length !== 0 ? getSwitchComponents(data, switchReactions, lng) : [];
	const withdrawComponents = withdrawReactions.length !== 0 ? getWithdrawComponents(data, withdrawReactions, lng) : [];

	const msg = await interaction?.editReply({
		embeds: [mainMenuEmbed],
		components: mainMenuComponents
	}) as Message;

	let currentComponents: ActionRowBuilder<MessageActionRowComponentBuilder>[] = mainMenuComponents;

	const msgCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	msgCollector.on("collect", async (collectedInteraction: MessageComponentInteraction) => {
		if (collectedInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(collectedInteraction.user, collectedInteraction, lng);
			return;
		}

		currentComponents = await handlePetTransferCollect(
			packet,
			context,
			{
				depositReaction,
				refuseReaction
			},
			{
				collectedInteraction,
				mainMenuEmbed,
				switchComponents,
				withdrawComponents,
				mainMenuComponents,
				currentComponents
			}
		);
	});


	msgCollector.on("end", () => {
		// Disable buttons instead of removing them
		disableRows(currentComponents);

		msg.edit({
			embeds: [mainMenuEmbed],
			components: currentComponents
		});
	});

	return [msgCollector];
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petTransfer") as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
