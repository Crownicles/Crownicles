import {makePacket, PacketContext} from "../../../Lib/src/packets/DraftBotPacket";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorReactPacket,
	ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {DiscordCache} from "../bot/DiscordCache";
import {KeycloakUser} from "../../../Lib/src/keycloak/KeycloakUser";
import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, MessageComponentInteraction, parseEmoji} from "discord.js";
import {DraftBotIcons} from "../../../Lib/src/DraftBotIcons";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {DraftbotInteraction} from "../messages/DraftbotInteraction";
import {sendInteractionNotForYou} from "./ErrorUtils";
import {PacketUtils} from "./PacketUtils";
import {keycloakConfig, shardId} from "../bot/DraftBotShard.js";
import {KeycloakUtils} from "../../../Lib/src/keycloak/KeycloakUtils.js";
import {ReactionCollectorReturnType} from "../packetHandlers/handlers/ReactionCollectorHandlers";
import {DiscordMQTT} from "../bot/DiscordMQTT";
import {RequirementEffectPacket} from "../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import {Effect} from "../../../Lib/src/types/Effect";

export class DiscordCollectorUtils {
	private static choiceListEmotes = ["1⃣", "2⃣", "3⃣", "4⃣", "5⃣", "6⃣", "7⃣", "8⃣", "9⃣"];

	static sendReaction(packet: ReactionCollectorCreationPacket, context: PacketContext, userKeycloakId: KeycloakUser["id"], button: MessageComponentInteraction | null, reactionIndex: number): void {
		const responsePacket = makePacket(
			ReactionCollectorReactPacket,
			{
				id: packet.id,
				keycloakId: userKeycloakId,
				reactionIndex
			}
		);

		if (button && button.isButton()) {
			DiscordCache.cacheButtonInteraction(button);
		}

		PacketUtils.sendPacketToBackend({
			keycloakId: userKeycloakId,
			discord: {
				user: context.discord!.user,
				channel: context.discord!.channel,
				interaction: context.discord!.interaction,
				buttonInteraction: button?.id,
				language: context.discord!.language,
				shardId
			}
		}, responsePacket);
	}

	static async createAcceptRefuseCollector(
		interaction: DraftbotInteraction,
		messageContentOrEmbed: DraftBotEmbed | string,
		reactionCollectorCreationPacket: ReactionCollectorCreationPacket,
		context: PacketContext,
		options?: {
			canInitiatorRefuse?: boolean,
			acceptedUsersId?: string[],
			anyoneCanReact?: boolean,
			emojis?: {
				accept?: string,
				refuse?: string
			}
		}
	): Promise<ReactionCollectorReturnType> {
		const emojis = {
			accept: DraftBotIcons.collectors.accept,
			refuse: DraftBotIcons.collectors.refuse,
			...options?.emojis
		};
		const userDiscordIds: string[] = [context.discord!.user];
		if (options?.acceptedUsersId) {
			userDiscordIds.pop();
			for (const id of options.acceptedUsersId) {
				const user = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, id);
				if (user) {
					userDiscordIds.push(user.attributes.discordId![0]);
				}
			}
		}

		const row = new ActionRowBuilder<ButtonBuilder>();

		// Create buttons
		const acceptCustomId = "accept";
		const buttonAccept = new ButtonBuilder()
			.setEmoji(parseEmoji(emojis.accept)!)
			.setCustomId(acceptCustomId)
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(buttonAccept);

		const buttonRefuse = new ButtonBuilder()
			.setEmoji(parseEmoji(emojis.refuse)!)
			.setCustomId("refuse")
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(buttonRefuse);

		const sendFunction = reactionCollectorCreationPacket.mainPacket ? interaction.editReply : interaction.channel.send;

		// Edit message
		let msg: Message;
		if (messageContentOrEmbed instanceof DraftBotEmbed) {
			msg = await sendFunction({
				embeds: [messageContentOrEmbed],
				components: [row]
			}) as Message;
		}
		else {
			msg = await sendFunction({
				content: messageContentOrEmbed,
				components: [row]
			}) as Message;
		}

		// Create a button collector
		const buttonCollector = msg.createMessageComponentCollector({
			time: reactionCollectorCreationPacket.endTime - Date.now()
		});

		// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (!options?.anyoneCanReact && (!options?.canInitiatorRefuse || buttonInteraction.user.id !== context.discord?.user || buttonInteraction.customId !== "refuse")
				&& !userDiscordIds.find(userDiscordId => userDiscordId === buttonInteraction.user.id)) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, interaction.userLanguage);
				return;
			}

			const reactingPlayerKeycloakId = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, buttonInteraction.user.id, buttonInteraction.user.displayName);
			if (reactingPlayerKeycloakId) {
				await buttonInteraction.deferReply();
				DiscordCollectorUtils.sendReaction(
					reactionCollectorCreationPacket,
					context,
					reactingPlayerKeycloakId,
					buttonInteraction,
					reactionCollectorCreationPacket.reactions.findIndex((reaction) =>
						reaction.type === (buttonInteraction.customId === acceptCustomId
							? ReactionCollectorAcceptReaction.name
							: ReactionCollectorRefuseReaction.name))
				);
			}
			else {
				const listener = DiscordMQTT.packetListener.getListener(RequirementEffectPacket.name);
				if (listener) {
					await listener(context, makePacket(RequirementEffectPacket, {
						remainingTime: -1,
						currentEffectId: Effect.NOT_STARTED.id
					}));
				}
			}
		});

		return [buttonCollector];
	}

	static async createChoiceListCollector(
		interaction: DraftbotInteraction,
		messageContentOrEmbed: DraftBotEmbed | string,
		reactionCollectorCreationPacket: ReactionCollectorCreationPacket,
		context: PacketContext,
		items: string[],
		canRefuse: boolean
	): Promise<ReactionCollectorReturnType> {
		if (items.length > DiscordCollectorUtils.choiceListEmotes.length) {
			throw "Too many items to display";
		}

		let choiceDesc = "";
		const row = new ActionRowBuilder<ButtonBuilder>();
		// Create buttons
		for (let i = 0; i < items.length; ++i) {
			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(DiscordCollectorUtils.choiceListEmotes[i])!)
				.setCustomId(i.toString())
				.setStyle(ButtonStyle.Secondary);
			row.addComponents(button);
			choiceDesc += `${DiscordCollectorUtils.choiceListEmotes[i]} - ${items[i]}\n`;
		}

		if (canRefuse) {
			const buttonRefuse = new ButtonBuilder()
				.setEmoji(parseEmoji(DraftBotIcons.collectors.refuse)!)
				.setCustomId("refuse")
				.setStyle(ButtonStyle.Secondary);
			row.addComponents(buttonRefuse);
		}

		// Add a choice description to the embed
		if (messageContentOrEmbed instanceof DraftBotEmbed) {
			messageContentOrEmbed.setDescription((messageContentOrEmbed.data.description ?? "") + choiceDesc);
		}
		else {
			messageContentOrEmbed += choiceDesc;
		}

		// Edit message
		const msg: Message = await (interaction.replied ? interaction.followUp : interaction.deferred ? interaction.editReply : interaction.reply)({
			components: [row],
			...messageContentOrEmbed instanceof DraftBotEmbed
				? {embeds: [messageContentOrEmbed]}
				: {content: messageContentOrEmbed}
		});

		// Create button collector
		const buttonCollector = msg.createMessageComponentCollector({
			time: reactionCollectorCreationPacket.endTime - Date.now()
		});

		// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, interaction.userLanguage);
				return;
			}

			await buttonInteraction.deferReply();
			if (buttonInteraction.customId !== "refuse") {
				DiscordCollectorUtils.sendReaction(reactionCollectorCreationPacket, context, context.keycloakId!, buttonInteraction, parseInt(buttonInteraction.customId));
			}
		});

		return [buttonCollector];
	}
}