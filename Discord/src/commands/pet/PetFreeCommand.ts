import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketReq,
	CommandPetFreePacketRes,
	CommandPetFreeShelterSuccessPacketRes,
	CommandPetFreeShelterCooldownErrorPacketRes,
	CommandPetFreeShelterMissingMoneyErrorPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { printTimeBeforeDate } from "../../../../Lib/src/utils/TimeUtils";
import {
	disableRows,
	DiscordCollectorUtils
} from "../../utils/DiscordCollectorUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ReactionCollectorPetFreePacket,
	ReactionCollectorPetFreeSelectionData,
	ReactionCollectorPetFreeSelectionPacket,
	ReactionCollectorPetFreeSelectReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import { PetUtils } from "../../utils/PetUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	ActionRowBuilder,
	MessageComponentInteraction,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder,
	ButtonBuilder,
	ButtonStyle,
	Message
} from "discord.js";
import {
	Language, LANGUAGE
} from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { MessagesUtils } from "../../utils/MessagesUtils";

/**
 * Destroy a pet forever... RIP
 */
function getPacket(_interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): CommandPetFreePacketReq {
	return makePacket(CommandPetFreePacketReq, { keycloakId: keycloakUser.id });
}


export async function handleCommandPetFreePacketRes(packet: CommandPetFreePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	if (!packet.foundPet) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:petDoesntExist", { lng })
				)
			]
		});
		return;
	}
	if (packet.petCanBeFreed) {
		return;
	}
	if (packet.missingMoney! > 0) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:notEnoughMoney", {
						lng,
						money: packet.missingMoney
					})
				)
			]
		});
	}
	if (packet.cooldownRemainingTimeMs! > 0) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:cooldownPetFree", {
						lng,
						remainingTime: printTimeBeforeDate(packet.cooldownRemainingTimeMs! + new Date().valueOf())
					})
				)
			]
		});
		return;
	}
	if (packet.petOnExpedition) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:petFree.petOnExpedition", { lng })
				)
			]
		});
	}
}

export async function createPetFreeCollector(context: PacketContext, packet: ReactionCollectorPetFreePacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:petFree.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:petFree.confirmDesc", {
				lng,
				pet: PetUtils.petToShortString(lng, data.petNickname, data.petId, data.petSex)
			})
		);

	if (data.freeCost) {
		embed.setFooter({
			text: i18n.t("commands:petFree.isFeisty", {
				lng,
				cost: data.freeCost
			})
		});
	}

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Helper function to build a simple response embed with author formatting
 */
function buildSimpleResponseEmbed(
	interaction: CrowniclesInteraction,
	titleKey: string,
	description: string,
	isError: boolean = false
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t(titleKey, {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(description);

	if (isError) {
		embed.setErrorColor();
	}

	return embed;
}

export async function handleCommandPetFreeRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage ?? context.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE;
		const embed = buildSimpleResponseEmbed(
			originalInteraction,
			"commands:petFree.canceledTitle",
			i18n.t("commands:petFree.canceledDesc", { lng }),
			true
		);
		await buttonInteraction.editReply({ embeds: [embed] });
	}
}

export async function handleCommandPetFreeAcceptPacketRes(packet: CommandPetFreeAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage ?? context.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE;
		const embed = buildSimpleResponseEmbed(
			originalInteraction,
			"commands:petFree.title",
			i18n.t("commands:petFree.acceptedDesc", {
				lng,
				pet: PetUtils.petToShortString(lng, packet.petNickname, packet.petId, packet.petSex)
			})
		);
		await buttonInteraction.editReply({ embeds: [embed] });
	}
}

// Handle shelter pet free success
export async function handleCommandPetFreeShelterSuccessPacketRes(packet: CommandPetFreeShelterSuccessPacketRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);

	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage ?? context.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE;
	const petDisplay = PetUtils.petToShortString(lng, packet.petNickname, packet.petId, packet.petSex);

	let description = i18n.t("commands:petFree.acceptedDesc", {
		lng, pet: petDisplay
	});

	if (packet.freeCost > 0) {
		description += `\n${i18n.t("commands:petFree.feistyCostPaid", {
			lng, cost: packet.freeCost
		})}`;
	}

	if (packet.luckyMeat) {
		description += `\n${i18n.t("commands:petFree.luckyMeat", { lng })}`;
	}

	const embed = buildSimpleResponseEmbed(interaction, "commands:petFree.title", description);
	await interaction.editReply({
		embeds: [embed], components: []
	});
}

/**
 * Helper function to send an error embed response for shelter pet operations
 */
async function sendShelterErrorResponse(
	context: PacketContext,
	errorMessage: string
): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);

	if (!interaction) {
		return;
	}

	await interaction.editReply({
		embeds: [
			new CrowniclesErrorEmbed(
				interaction.user,
				context,
				interaction,
				errorMessage
			)
		],
		components: []
	});
}

// Handle shelter pet free cooldown error
export async function handleCommandPetFreeShelterCooldownErrorPacketRes(packet: CommandPetFreeShelterCooldownErrorPacketRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	await sendShelterErrorResponse(
		context,
		i18n.t("error:cooldownPetFree", {
			lng: interaction.userLanguage,
			remainingTime: printTimeBeforeDate(packet.cooldownRemainingTimeMs + new Date().valueOf())
		})
	);
}

// Handle shelter pet free missing money error
export async function handleCommandPetFreeShelterMissingMoneyErrorPacketRes(packet: CommandPetFreeShelterMissingMoneyErrorPacketRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	await sendShelterErrorResponse(
		context,
		i18n.t("error:notEnoughMoney", {
			lng: interaction.userLanguage,
			money: packet.missingMoney
		})
	);
}

const selectPetCustomId = "selectPet";
const cancelCustomId = "cancel";

type ReactionMap = {
	reaction: {
		type: string;
		data: ReactionCollectorPetFreeSelectReaction;
	};
	index: number;
};

function getPetSelectMenu(
	data: ReactionCollectorPetFreeSelectionData,
	reactions: ReactionMap[],
	lng: Language
): StringSelectMenuBuilder {
	const options: StringSelectMenuOptionBuilder[] = [];

	for (const reaction of reactions) {
		const petEntityId = reaction.reaction.data.petEntityId;

		// Check if it's a shelter pet
		const shelterPet = data.shelterPets.find(sp => sp.petEntityId === petEntityId);
		if (shelterPet) {
			options.push(
				new StringSelectMenuOptionBuilder()
					.setLabel(DisplayUtils.getPetNicknameOrTypeName(shelterPet.pet.nickname, shelterPet.pet.typeId, shelterPet.pet.sex, lng))
					.setEmoji(parseEmoji(DisplayUtils.getPetIcon(shelterPet.pet.typeId, shelterPet.pet.sex))!)
					.setValue(reaction.index.toString())
					.setDescription(i18n.t("commands:petFree.shelterPetOption", {
						lng,
						rarity: DisplayUtils.getPetRarityDisplay(shelterPet.pet.rarity, lng),
						sex: DisplayUtils.getPetSexName(shelterPet.pet.sex, lng),
						loveLevel: DisplayUtils.getPetLoveLevelDisplay(shelterPet.pet.loveLevel, shelterPet.pet.sex, lng, false)
					}))
			);
		}
		else if (data.ownPet) {
			// If not in shelter pets and own pet exists, it's the player's own pet
			options.push(
				new StringSelectMenuOptionBuilder()
					.setLabel(DisplayUtils.getPetNicknameOrTypeName(data.ownPet.nickname, data.ownPet.typeId, data.ownPet.sex, lng))
					.setEmoji(parseEmoji(DisplayUtils.getPetIcon(data.ownPet.typeId, data.ownPet.sex))!)
					.setValue(reaction.index.toString())
					.setDescription(i18n.t("commands:petFree.ownPetOption", { lng }))
			);
		}
	}

	return new StringSelectMenuBuilder()
		.setPlaceholder(i18n.t("commands:petFree.selectPlaceholder", { lng }))
		.setCustomId(selectPetCustomId)
		.addOptions(options);
}

function getCancelButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		.setLabel(i18n.t("commands:petFree.cancelButton", { lng }))
		.setStyle(ButtonStyle.Secondary)
		.setCustomId(cancelCustomId);
}

// Create collector for pet selection (shelter + own pet)
export async function createPetFreeSelectionCollector(
	context: PacketContext,
	packet: ReactionCollectorPetFreeSelectionPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();

	const data = packet.data.data;
	const lng = interaction.userLanguage;

	// Build reactions map
	const selectReactions: ReactionMap[] = packet.reactions
		.map((reaction, index) => ({
			reaction: reaction as {
				type: string; data: ReactionCollectorPetFreeSelectReaction;
			},
			index
		}))
		.filter(r => r.reaction.type === ReactionCollectorPetFreeSelectReaction.name);

	const refuseReactionIndex = packet.reactions.findIndex(r => r.type !== ReactionCollectorPetFreeSelectReaction.name);

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:petFree.selectionTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:petFree.selectionDesc", { lng }));

	const selectMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(getPetSelectMenu(data, selectReactions, lng));

	const buttonRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(getCancelButton(lng));

	const components = [selectMenuRow, buttonRow];

	const msg = await interaction.editReply({
		embeds: [embed],
		components
	}) as Message;

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async (collectedInteraction: MessageComponentInteraction) => {
		if (collectedInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(collectedInteraction.user, collectedInteraction, lng);
			return;
		}

		if (collectedInteraction.customId === cancelCustomId) {
			await collectedInteraction.deferReply();
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				collectedInteraction,
				refuseReactionIndex
			);
			collector.stop();
			return;
		}

		if (collectedInteraction.customId === selectPetCustomId && collectedInteraction.isStringSelectMenu()) {
			const selectedIndex = parseInt((collectedInteraction as StringSelectMenuInteraction).values[0], 10);
			await collectedInteraction.deferReply();
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				collectedInteraction,
				selectedIndex
			);
			collector.stop();
		}
	});

	collector.on("end", async (_collected, reason) => {
		if (reason === "time") {
			disableRows(components);
			await msg.edit({ components });
		}
	});

	return [collector];
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petFree"),
	getPacket,
	mainGuildCommand: false
};
