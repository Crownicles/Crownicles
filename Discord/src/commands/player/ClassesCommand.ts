import {
	CommandClassesChangeSuccessPacket,
	CommandClassesPacketReq
} from "../../../../Lib/src/packets/commands/CommandClassesPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ReactionCollectorChangeClassPacket,
	ReactionCollectorChangeClassReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	InteractionCollector,
	Message,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { dateDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { ReactionCollectorResetTimerPacketReq } from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import {
	DiscordCollectorUtils,
	disableRows
} from "../../utils/DiscordCollectorUtils";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the packet
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandClassesPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandClassesPacketReq, {});
}

export async function handleCommandClassesChangeSuccessPacket(packet: CommandClassesChangeSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);

	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;
	const title = i18n.t("commands:classes.success", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	});
	const description = i18n.t("commands:classes.newClass", {
		lng,
		name: i18n.t(`models:classes.${packet.classId}`, { lng })
	});

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(title, interaction.user)
				.setDescription(description)
		]
	});
}

export async function handleChangeClassReactionCollector(context: PacketContext, packet: ReactionCollectorChangeClassPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const data = packet.data.data;
	const classesReactions = packet.reactions
		.filter((r): r is {
			type: string; data: ReactionCollectorChangeClassReaction;
		} => r.type === ReactionCollectorChangeClassReaction.name)
		.map(r => r.data);

	const mainEmbed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:classes.title", { lng }))
		.setDescription(i18n.t("commands:classes.desc", { lng }))
		.addFields(classesReactions.map(reaction => ({
			name: DisplayUtils.getClassDisplay(reaction.classId, lng),
			value: i18n.t(`commands:classes.description.${reaction.classId}`, { lng })
		})));

	const refuseCustomId = "refuse";
	const acceptCustomId = "validate";

	const mainEmbedRow = new ActionRowBuilder<StringSelectMenuBuilder>();
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("classSelectionMenu")
		.setPlaceholder(i18n.t("commands:classes.chooseClass", { lng }));
	for (const reaction of classesReactions) {
		selectMenu.addOptions(new StringSelectMenuOptionBuilder()
			.setLabel(i18n.t(`models:classes.${reaction.classId}`, { lng }))
			.setValue(reaction.classId.toString())
			.setEmoji(parseEmoji(CrowniclesIcons.classes[reaction.classId])!));
	}

	selectMenu.addOptions(new StringSelectMenuOptionBuilder()
		.setLabel(i18n.t("commands:classes.refuse", { lng }))
		.setValue(refuseCustomId)
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!));

	mainEmbedRow.addComponents(selectMenu);

	const msg = await interaction?.editReply({
		embeds: [mainEmbed],
		components: [mainEmbedRow]
	}) as Message;

	let validateCollector: InteractionCollector<never>;

	const selectCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	selectCollector.on("collect", async (selectMenuInteraction: StringSelectMenuInteraction) => {
		if (selectMenuInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(selectMenuInteraction.user, selectMenuInteraction, lng);
			return;
		}

		await selectMenuInteraction.deferReply();

		disableRows([mainEmbedRow]);

		await msg.edit({
			embeds: [mainEmbed],
			components: [mainEmbedRow]
		});

		const selectedOption = selectMenuInteraction.values[0];

		if (selectedOption === refuseCustomId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				selectMenuInteraction,
				packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name)
			);
			return;
		}

		// Reset the collector timer, so it doesn't end while the user is still choosing either to validate or refuse
		PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));

		const classDetails = data.classesDetails.find(details => details.id === parseInt(selectedOption, 10))!;

		const validateClassChangeEmbed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:classes.confirm", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t("commands:classes.display", {
				lng,
				name: i18n.t("models:classWithStatsFormat", {
					lng,
					id: classDetails.id,
					energy: classDetails.energy,
					attack: classDetails.attack,
					defense: classDetails.defense,
					speed: classDetails.speed,
					initialBreath: classDetails.initialBreath,
					maxBreath: classDetails.maxBreath,
					breathRegen: classDetails.breathRegen,
					health: classDetails.health
				}),
				description: i18n.t(`commands:classes.description.${classDetails.id}`, {
					lng
				}),
				time: dateDisplay(new Date(Date.now() + data.cooldownSeconds * 1000))
			}));

		const validateRow = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.accept)!)
				.setCustomId(acceptCustomId)
				.setStyle(ButtonStyle.Secondary))
			.addComponents(new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
				.setCustomId(refuseCustomId)
				.setStyle(ButtonStyle.Secondary));

		const validateMsg = await selectMenuInteraction.editReply({
			embeds: [validateClassChangeEmbed],
			components: [validateRow]
		}) as Message;

		validateCollector = validateMsg.createMessageComponentCollector() as unknown as InteractionCollector<never>;

		validateCollector.on("collect", async (validateInteraction: ButtonInteraction) => {
			if (validateInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(validateInteraction.user, validateInteraction, lng);
				return;
			}

			await validateInteraction.deferReply();

			if (validateInteraction.customId === refuseCustomId) {
				DiscordCollectorUtils.sendReaction(
					packet,
					context,
					context.keycloakId!,
					validateInteraction,
					packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name)
				);
				return;
			}

			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				validateInteraction,
				classesReactions.findIndex(reaction => reaction.classId === classDetails.id)
			);
		});

		validateCollector.on("end", async () => {
			const disabledRow = new ActionRowBuilder<ButtonBuilder>();
			validateRow.components.forEach(component => {
				const button = ButtonBuilder.from(component).setDisabled(true);
				disabledRow.addComponents(button);
			});

			await validateMsg.edit({
				components: [disabledRow]
			});
		});
	});

	selectCollector.on("end", async () => {
		const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>();
		mainEmbedRow.components.forEach(component => {
			const selectMenu = StringSelectMenuBuilder.from(component).setDisabled(true);
			disabledRow.addComponents(selectMenu);
		});

		await msg.edit({
			components: [disabledRow]
		});
		if (validateCollector && !validateCollector.ended) {
			validateCollector.stop();
		}
	});

	return [selectCollector];
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("classes"),
	getPacket,
	mainGuildCommand: false
};
