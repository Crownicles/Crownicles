import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorReactPacket,
	ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../bot/DiscordCache";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	InteractionUpdateOptions,
	Message,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction,
	MessageEditOptions,
	parseEmoji,
	ReactionCollector,
	StringSelectMenuInteraction
} from "discord.js";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { getErrorReason } from "../../../Lib/src/utils/ErrorUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import {
	CrowniclesInteraction, SendManner
} from "../messages/CrowniclesInteraction";
import { sendInteractionNotForYou } from "./ErrorUtils";
import { PacketUtils } from "./PacketUtils";
import {
	keycloakConfig, shardId
} from "../bot/CrowniclesShard.js";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils.js";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordMQTT } from "../bot/DiscordMQTT";
import { RequirementEffectPacket } from "../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { Effect } from "../../../Lib/src/types/Effect";
import { PacketConstants } from "../../../Lib/src/constants/PacketConstants";
import { DiscordConstants } from "../DiscordConstants";
import { Language } from "../../../Lib/src/Language";

type SendingContext = {
	packet: ReactionCollectorCreationPacket;
	context: PacketContext;
};

type SendingValues = {
	embed: CrowniclesEmbed | string;
	items: string[];
};

/**
 * Ids of the component interaction answering a click, in the context sent to Core
 */
type RespondingComponentIds = Pick<NonNullable<PacketContext["discord"]>, "buttonInteraction" | "stringSelectMenuInteraction">;

/**
 * Disables all components in the provided action rows
 * @param rows - Array of action rows containing components to disable
 */
export function disableRows(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): void {
	rows.forEach(row => {
		row.components.forEach(component => {
			component.setDisabled(true);
		});
	});
}

/**
 * Add a button to the last row, creating a new row if the current one is full (max 5 buttons per row).
 * @param rows - Array of action rows to add the button to
 * @param button - The button to add
 */
export function addButtonToRow(rows: ActionRowBuilder<ButtonBuilder>[], button: ButtonBuilder): void {
	if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
		rows.push(new ActionRowBuilder<ButtonBuilder>());
	}
	rows[rows.length - 1].addComponents(button);
}

export abstract class DiscordCollectorUtils {
	private static choiceListEmotes = [
		"1⃣",
		"2⃣",
		"3⃣",
		"4⃣",
		"5⃣",
		"6⃣",
		"7⃣",
		"8⃣",
		"9⃣"
	];

	/**
	 * Component interactions whose acknowledgement failed: unless acknowledged another way, Discord accepts no answer to them
	 */
	private static readonly unacknowledgedComponents = new WeakSet<MessageComponentInteraction>();

	/**
	 * Wait for the acknowledgement of a component interaction (deferReply, deferUpdate, update...) without ever throwing.
	 * Discord rejects an acknowledgement sent more than 3 seconds after the click, which happens when the shard lags: the
	 * click must still be forwarded to Core, otherwise the player stays blocked until the collector ends (#5059).
	 * Acknowledge before any other request to Discord, so that the slow requests do not consume the 3 seconds.
	 * @returns whether the interaction was acknowledged
	 */
	static async acknowledgeComponent(interaction: MessageComponentInteraction, acknowledgement: Promise<unknown>): Promise<boolean> {
		try {
			await acknowledgement;
			return true;
		}
		catch (error) {
			DiscordCollectorUtils.unacknowledgedComponents.add(interaction);
			CrowniclesLogger.warn("Component interaction could not be acknowledged, handling the click anyway", {
				customId: interaction.customId,
				reason: getErrorReason(error),
				interactionAgeMs: Date.now() - interaction.createdTimestamp
			});
			return false;
		}
	}

	/**
	 * Defer the update of the message of a clicked component without ever throwing (see acknowledgeComponent)
	 * @returns whether the interaction was acknowledged
	 */
	static deferUpdate(interaction: MessageComponentInteraction): Promise<boolean> {
		return DiscordCollectorUtils.acknowledgeComponent(interaction, interaction.deferUpdate());
	}

	/**
	 * Defer the reply to a clicked component without ever throwing (see acknowledgeComponent)
	 * @returns whether the interaction was acknowledged
	 */
	static deferReply(interaction: MessageComponentInteraction): Promise<boolean> {
		return DiscordCollectorUtils.acknowledgeComponent(interaction, interaction.deferReply());
	}

	/**
	 * Edit a message whose update is only cosmetic (e.g. disabling the buttons of a collector), so that a failure of the
	 * edit cannot prevent the click from being forwarded to Core
	 */
	static async editWithoutBlocking(message: Message, options: MessageEditOptions): Promise<void> {
		try {
			await message.edit(options);
		}
		catch (error) {
			CrowniclesLogger.warn("Collector message could not be edited, handling the click anyway", {
				messageId: message.id,
				reason: getErrorReason(error)
			});
		}
	}

	/**
	 * Update the message of a component interaction, falling back to a message edit when the interaction expired, so
	 * that the displayed view always matches the state of the menu
	 * @returns whether the interaction was acknowledged
	 */
	static async updateComponentMessage(interaction: MessageComponentInteraction, options: InteractionUpdateOptions & MessageEditOptions): Promise<boolean> {
		if (await DiscordCollectorUtils.acknowledgeComponent(interaction, interaction.update(options))) {
			return true;
		}
		await DiscordCollectorUtils.editWithoutBlocking(interaction.message, options);
		return false;
	}

	/**
	 * Time left before Core's deadline for the collector, never zero so that discord.js still arms its timer
	 */
	static getRemainingCollectorTime(packet: ReactionCollectorCreationPacket): number {
		return Math.max(packet.endTime - Date.now(), DiscordConstants.MIN_COLLECTOR_TIME);
	}

	/**
	 * Create a collector that only follows the lifetime of the Core reaction collector, for menus handling their components
	 * with their own collectors. Core's stop packet ends it and Core's timer resets push its deadline back, but its own
	 * deadline still ends it when the stop packet is lost, so the collectors cache releases it and the menus it captures
	 */
	static createCoreLifecycleCollector(message: Message, packet: ReactionCollectorCreationPacket): ReactionCollector {
		return message.createReactionCollector({
			time: DiscordCollectorUtils.getRemainingCollectorTime(packet)
		});
	}

	/**
	 * Add a button to the last row, creating a new row if the current one is full.
	 */
	static addButtonToRow(rows: ActionRowBuilder<ButtonBuilder>[], button: ButtonBuilder): void {
		addButtonToRow(rows, button);
	}

	/**
	 * Whether the acknowledgement of the interaction failed and it was not acknowledged another way (a concurrent
	 * acknowledgement of the same click fails with "already acknowledged" but leaves it answerable)
	 */
	private static isUnanswerable(component: MessageComponentInteraction): boolean {
		return DiscordCollectorUtils.unacknowledgedComponents.has(component) && !component.deferred && !component.replied;
	}

	/**
	 * Return the id of the clicked component for the packet context, and cache the interaction through which Core's
	 * response is displayed. An interaction whose acknowledgement failed (expired, Discord unavailable...) can no longer
	 * be answered: only its author is cached, so that the response falls back to the command interaction while still
	 * knowing a click happened and who made it (see MessagesUtils.editClickReply and MessagesUtils.getClickUser)
	 */
	private static cacheRespondingComponent(component: MessageComponentInteraction | null, lng: Language): RespondingComponentIds {
		if (component?.isButton()) {
			DiscordCollectorUtils.cacheClick(component, lng, DiscordCache.cacheButtonInteraction);
			return { buttonInteraction: component.id };
		}
		if (component?.isStringSelectMenu()) {
			DiscordCollectorUtils.cacheClick(component, lng, DiscordCache.cacheStringSelectMenuInteraction);
			return { stringSelectMenuInteraction: component.id };
		}
		return {};
	}

	/**
	 * Cache the click cast to CrowniclesInteraction, in the language of the command it answers
	 */
	private static cacheClick(component: ButtonInteraction | StringSelectMenuInteraction, lng: Language, cache: (click: CrowniclesInteraction) => void): void {
		if (DiscordCollectorUtils.isUnanswerable(component)) {
			DiscordCache.cacheUnanswerableClickUser(component.id, component.user);
			return;
		}
		cache(CrowniclesInteraction.cast(component, lng));
	}

	static sendReaction(
		packet: ReactionCollectorCreationPacket,
		context: PacketContext,
		userKeycloakId: string,
		component: MessageComponentInteraction | null,
		reactionIndex: number
	): void {
		const responsePacket = makePacket(
			ReactionCollectorReactPacket,
			{
				id: packet.id,
				keycloakId: userKeycloakId,
				reactionIndex
			}
		);

		PacketUtils.sendPacketToBackend({
			frontEndOrigin: PacketConstants.FRONT_END_ORIGINS.DISCORD,
			frontEndSubOrigin: context.frontEndSubOrigin,
			keycloakId: userKeycloakId,
			discord: {
				user: context.discord!.user,
				channel: context.discord!.channel,
				interaction: context.discord!.interaction,
				...DiscordCollectorUtils.cacheRespondingComponent(component, context.discord!.language),
				language: context.discord!.language,
				shardId
			}
		}, responsePacket);
	}

	static async createAcceptRefuseCollector(
		interaction: CrowniclesInteraction,
		messageContentOrEmbed: CrowniclesEmbed | string,
		reactionCollectorCreationPacket: ReactionCollectorCreationPacket,
		context: PacketContext,
		options?: {
			canInitiatorRefuse?: boolean;
			acceptedUsersId?: string[];
			anyoneCanReact?: boolean;
			emojis?: {
				accept?: string;
				refuse?: string;
			};
			notDeferReply?: boolean;
			indexes?: {
				accept?: number;
				refuse?: number;
			};
		}
	): Promise<ReactionCollectorReturnTypeOrNull> {
		const emojis = {
			accept: CrowniclesIcons.collectors.accept,
			refuse: CrowniclesIcons.collectors.refuse,
			...options?.emojis
		};
		const userDiscordIds: string[] = [context.discord!.user];
		if (options?.acceptedUsersId) {
			userDiscordIds.pop();
			for (const id of options.acceptedUsersId) {
				const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, id);
				if (!getUser.isError) {
					userDiscordIds.push(getUser.payload.user.attributes.discordId![0]);
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
		if (messageContentOrEmbed instanceof CrowniclesEmbed) {
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

			const getReactingPlayer = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, buttonInteraction.user.id, buttonInteraction.user.displayName);
			if (!getReactingPlayer.isError && getReactingPlayer.payload.keycloakId) {
				if (!options?.notDeferReply) {
					await DiscordCollectorUtils.deferReply(buttonInteraction);
				}
				else {
					disableRows([row]);

					await DiscordCollectorUtils.editWithoutBlocking(msg, {
						...messageContentOrEmbed instanceof CrowniclesEmbed
							? { embeds: [messageContentOrEmbed] }
							: { content: messageContentOrEmbed },
						components: [row]
					});
				}

				const reactionIndex = buttonInteraction.customId === acceptCustomId
					? options?.indexes?.accept ?? reactionCollectorCreationPacket.reactions.findIndex(reaction => reaction.type === ReactionCollectorAcceptReaction.name)
					: options?.indexes?.refuse ?? reactionCollectorCreationPacket.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);

				DiscordCollectorUtils.sendReaction(
					reactionCollectorCreationPacket,
					context,
					getReactingPlayer.payload.keycloakId,
					buttonInteraction,
					reactionIndex
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

		buttonCollector.on("end", async () => {
			disableRows([row]);

			await msg.edit({ components: [row] });
		});

		return [buttonCollector];
	}

	static async createChoiceListCollector(
		interaction: CrowniclesInteraction,
		{
			packet,
			context
		}: SendingContext,
		{
			embed,
			items
		}: SendingValues,
		options: {
			refuse: {
				can: boolean; reactionIndex?: number;
			};
			additionalButtons?: {
				button: ButtonBuilder;
				text?: string;
				emoji?: string;
			}[];
			sendManner?: SendManner;
			deferUpdate?: boolean;
		}
	): Promise<ReactionCollectorReturnTypeOrNull> {
		if (items.length > DiscordCollectorUtils.choiceListEmotes.length) {
			throw "Too many items to display";
		}

		let choiceDesc = "";
		const rows = [new ActionRowBuilder<ButtonBuilder>()];

		// Create buttons
		for (let i = 0; i < items.length; ++i) {
			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(DiscordCollectorUtils.choiceListEmotes[i])!)
				.setCustomId(i.toString())
				.setStyle(ButtonStyle.Secondary);

			DiscordCollectorUtils.addButtonToRow(rows, button);

			choiceDesc += `${DiscordCollectorUtils.choiceListEmotes[i]} - ${items[i]}\n`;
		}

		if (options.additionalButtons) {
			for (const additionalButton of options.additionalButtons) {
				DiscordCollectorUtils.addButtonToRow(rows, additionalButton.button);
				if (additionalButton.text && additionalButton.emoji) {
					choiceDesc += `${additionalButton.emoji} - ${additionalButton.text}\n`;
				}
			}
		}

		if (options.refuse.can) {
			const buttonRefuse = new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
				.setCustomId("refuse")
				.setStyle(ButtonStyle.Secondary);

			DiscordCollectorUtils.addButtonToRow(rows, buttonRefuse);
		}

		// Add a choice description to the embed
		if (embed instanceof CrowniclesEmbed) {
			embed.setDescription((embed.data.description ?? "") + choiceDesc);
		}
		else {
			embed += choiceDesc;
		}

		const msg = await interaction.respond({
			components: rows,
			...embed instanceof CrowniclesEmbed
				? { embeds: [embed] }
				: { content: embed }
		}, { manner: options.sendManner });

		if (!msg) {
			return null;
		}

		// Create button collector
		const buttonCollector = msg.createMessageComponentCollector({
			time: packet.endTime - Date.now()
		});

		// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
		buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, interaction.userLanguage);
				return;
			}

			await (options.deferUpdate ? DiscordCollectorUtils.deferUpdate(buttonInteraction) : DiscordCollectorUtils.deferReply(buttonInteraction));
			if (buttonInteraction.customId !== "refuse") {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, parseInt(buttonInteraction.customId, 10));
			}
			else {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, options.refuse.reactionIndex!);
			}
		});

		buttonCollector.on("end", async () => {
			disableRows(rows);

			await msg.edit({ components: rows });
		});

		return [buttonCollector];
	}
}
