import {
	expect, vi
} from "vitest";
import {
	ButtonInteraction, CommandInteraction, Message, ReactionCollector
} from "discord.js";
// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import { readFileSync } from "fs";
import { resolve } from "path";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { DiscordMQTT } from "../../src/bot/DiscordMQTT";
import { BotUtils } from "../../src/utils/BotUtils";
import { PacketUtils } from "../../src/utils/PacketUtils";
import {
	ReactionCollector as CoreReactionCollector, ReactionCollectorCreationPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesInteraction } from "../../src/messages/CrowniclesInteraction";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { Language } from "../../../Lib/src/Language";
import { ColorConstants } from "../../../Lib/src/constants/ColorConstants";
import {
	ItemCategory, ItemNature, ItemRarity
} from "../../../Lib/src/constants/ItemConstants";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { fakeCollectorMessage } from "../bot/fakeCollectorMessage";
import { knownPlayers } from "./DiscordRenderMocks";

/**
 * Shared fixtures to render a Core packet through the Discord front-end and inspect what the player sees.
 * The vi.mock factories of the test files load the mock objects of this module through a dynamic import, since they are hoisted
 */

export const ERROR_COLOR = parseInt(ColorConstants.ERROR.slice(1), 16);

export type FakeUser = {
	id: string;
	username: string;
	displayName: string;
	bot: boolean;
	displayAvatarURL: () => string;
	toString: () => string;
};

export function fakeUser(name: string): FakeUser {
	return {
		id: `${name}-discord-id`,
		username: name,
		displayName: name,
		bot: false,
		displayAvatarURL: (): string => `https://avatar/${name}`,
		toString: (): string => `<@${name}-discord-id>`
	};
}

export type RenderedMessage = {
	method: string;
	payload: unknown;
};

/**
 * Command interaction recording every message it displays
 */
export type FakeInteraction = {
	id: string;
	userLanguage: Language;
	user: FakeUser;
	channel: {
		id: string;
		send: (payload: unknown) => Promise<Message>;
	};
	guild: null;
	replied: boolean;
	deferred: boolean;
	messages: RenderedMessage[];
	collectors: ReactionCollector[];

	/**
	 * Reactions added by the bot on the displayed messages
	 */
	reactions: string[];
	reply: (payload: unknown) => Promise<Message>;
	editReply: (payload: unknown) => Promise<Message>;
	followUp: (payload: unknown) => Promise<Message>;
	respond: (payload: unknown) => Promise<Message>;
	replyWithMessage: (payload: unknown) => Promise<Message>;
	deferReply: () => Promise<void>;
	deleteReply: () => Promise<void>;
	isButton: () => boolean;
	isStringSelectMenu: () => boolean;
	isCommand: () => boolean;
};

let interactionCount = 0;

/**
 * Create a command interaction, cache it like CommandsManager does and return it with the context Core answers with
 */
export function fakeCommand(userName = "Player", lng: Language = "fr"): {
	interaction: FakeInteraction; context: PacketContext;
} {
	const user = fakeUser(userName);
	const messages: RenderedMessage[] = [];
	const collectors: ReactionCollector[] = [];
	const reactions: string[] = [];
	const record = (method: string) => (payload: unknown): Promise<Message> => {
		messages.push({
			method, payload
		});
		return Promise.resolve(Object.assign(fakeCollectorMessage(collectors), {
			react: (emoji: string): Promise<void> => {
				reactions.push(emoji);
				return Promise.resolve();
			},
			edit: (edition: unknown): Promise<void> => {
				messages.push({
					method: "message.edit",
					payload: edition
				});
				return Promise.resolve();
			},
			delete: (): Promise<void> => Promise.resolve()
		}) as Message);
	};
	interactionCount++;
	const interaction: FakeInteraction = {
		id: `command-${interactionCount}`,
		userLanguage: lng,
		user,
		channel: {
			id: "channel-id",
			send: record("channel.send")
		},
		guild: null,
		replied: false,
		deferred: true,
		messages,
		collectors,
		reactions,
		reply: record("reply"),
		editReply: record("editReply"),
		followUp: record("followUp"),
		respond: record("respond"),
		replyWithMessage: record("replyWithMessage"),
		deferReply: (): Promise<void> => Promise.resolve(),
		deleteReply: (): Promise<void> => Promise.resolve(),
		isButton: (): boolean => false,
		isStringSelectMenu: (): boolean => false,
		isCommand: (): boolean => true
	};
	// The fake implements the members of CrowniclesInteraction the front-end calls, not the whole discord.js class
	DiscordCache.cacheInteraction(interaction as unknown as CrowniclesInteraction);
	const context = {
		keycloakId: `${userName}-keycloak-id`,
		discord: {
			interaction: interaction.id,
			user: user.id,
			channel: "channel-id",
			language: lng
		}
	} as PacketContext;
	knownPlayers.set(context.keycloakId!, userName);
	return {
		interaction, context
	};
}

/**
 * A click cached by the front-end is cast to CrowniclesInteraction, whose methods call the discord.js prototype ones:
 * record what they display in the messages of the fake click
 */
function recordCastClickAnswers(): void {
	for (const method of ["reply", "editReply", "followUp"] as const) {
		vi.spyOn(CommandInteraction.prototype, method).mockImplementation(function (this: { messages?: RenderedMessage[] }, payload: unknown) {
			this.messages?.push({
				method, payload
			});
			const message = fakeCollectorMessage();
			return Promise.resolve(Object.assign(message, { resource: { message } }) as never);
		});
	}
}

/**
 * Translation keys requested during the test without existing in any language
 */
const missingTranslations: string[] = [];
let missingTranslationsTracked = false;

/**
 * Register the mention of every slash command, as CommandsManager does when the bot starts, and record the missing translations.
 * Call it once the translations are loaded, in a beforeAll
 */
export function setupRendering(): void {
	const builder = JSON.parse(readFileSync(resolve(__dirname, "../../../Lang/en/discordBuilder.json"), "utf8")) as Record<string, {
		name?: string; options?: Record<string, { name?: string }>;
	}>;
	for (const command of Object.values(builder)) {
		if (!command.name) {
			continue;
		}
		BotUtils.commandsMentions.set(command.name, `</${command.name}:0>`);
		for (const option of Object.values(command.options ?? {})) {
			BotUtils.commandsMentions.set(`${command.name} ${option.name}`, `</${command.name} ${option.name}:0>`);
		}
	}
	recordCastClickAnswers();
	if (!missingTranslationsTracked) {
		missingTranslationsTracked = true;
		i18next.default.options.saveMissing = true;
		i18next.default.on("missingKey", (_languages: readonly string[], namespace: string, key: string) => {
			missingTranslations.push(`${namespace}:${key}`);
		});
	}
}

/**
 * Route a packet from Core to the request awaiting it or else to the handler registered for it, as DiscordMQTT does
 */
export async function dispatch(context: PacketContext, packet: CrowniclesPacket): Promise<void> {
	if (await DiscordMQTT.asyncPacketSender.handleResponse(context, packet.constructor.name, packet)) {
		return;
	}
	const listener = DiscordMQTT.packetListener.getListener(packet.constructor.name);
	expect(listener, `no handler registered for ${packet.constructor.name}`).toBeDefined();
	await listener?.(context, packet);
}

/**
 * Text the player sees in a displayed message: content, embeds and components serialized as Discord receives them
 */
export function renderedText(message: RenderedMessage): string {
	return typeof message.payload === "string" ? message.payload : JSON.stringify(message.payload);
}

export type RenderedEmbed = {
	title?: string;
	description?: string;
	author?: { name: string };
	color?: number;
	fields?: {
		name: string; value: string;
	}[];
	footer?: { text: string };
	image?: { url: string };
	thumbnail?: { url: string };
};

export type RenderedComponent = {
	type: number;
	custom_id?: string;
	label?: string;
	disabled?: boolean;
	style?: number;
	url?: string;
	placeholder?: string;
	options?: {
		label: string; value: string; description?: string;
	}[];
	components?: RenderedComponent[];
};

type JsonPayload = {
	content?: string;
	embeds?: RenderedEmbed[];
	components?: RenderedComponent[];
};

function toJson(message: RenderedMessage): JsonPayload {
	return typeof message.payload === "string" ? { content: message.payload } : JSON.parse(JSON.stringify(message.payload)) as JsonPayload;
}

export function embedsOf(message: RenderedMessage): RenderedEmbed[] {
	return toJson(message).embeds ?? [];
}

/**
 * Every interactive component (buttons and select menus) of a message, flattened from their action rows
 */
export function componentsOf(message: RenderedMessage): RenderedComponent[] {
	return (toJson(message).components ?? []).flatMap(row => row.components ?? [row]);
}

const NAMESPACES = [
	"advices",
	"bot",
	"commands",
	"discordBuilder",
	"embeds",
	"error",
	"events",
	"items",
	"kingGuards",
	"models",
	"notifications",
	"smallEvents"
];
const RAW_KEY = new RegExp(`\\b(${NAMESPACES.join("|")}):[A-Za-z]`);

/**
 * Check that no translation was missing so far and that a displayed message contains no untranslated key, missing emote, missing command or broken interpolation
 */
export function expectFullyTranslated(message: RenderedMessage): void {
	const text = renderedText(message);
	expect(missingTranslations.splice(0)).toEqual([]);
	expect(text).not.toMatch(RAW_KEY);
	expect(text).not.toContain("NOT FOUND");
	expect(text).not.toContain("{{");
	expect(text).not.toMatch(/\{[A-Za-z]+\}/);
	expect(text).not.toMatch(/\bundefined\b/);
	expect(text).not.toMatch(/\bNaN\b/);
	expect(text).not.toContain("[object Object]");
}

/**
 * The only message displayed by the interaction, checked to be fully translated
 */
export function singleMessage(interaction: { messages: RenderedMessage[] }): RenderedMessage {
	expect(interaction.messages).toHaveLength(1);
	expectFullyTranslated(interaction.messages[0]);
	return interaction.messages[0];
}

export function lastMessage(interaction: { messages: RenderedMessage[] }): RenderedMessage {
	const message = interaction.messages.at(-1);
	expect(message).toBeDefined();
	expectFullyTranslated(message as RenderedMessage);
	return message as RenderedMessage;
}

function stat(value: number): MainItemDetails["attack"] {
	return {
		baseValue: value,
		upgradeValue: 0,
		maxValue: Infinity
	};
}

/**
 * Weapon or armor as Core describes it in its packets
 */
export function mainItem(itemCategory: ItemCategory.WEAPON | ItemCategory.ARMOR, id: number, values: {
	attack?: number; defense?: number; speed?: number;
} = {}): MainItemDetails {
	return {
		id,
		rarity: ItemRarity.RARE,
		itemCategory,
		itemLevel: 0,
		attack: stat(values.attack ?? 0),
		defense: stat(values.defense ?? 0),
		speed: stat(values.speed ?? 0)
	};
}

/**
 * Potion or object as Core describes it in its packets
 */
export function supportItem(itemCategory: ItemCategory.POTION | ItemCategory.OBJECT, id: number, nature = ItemNature.NONE, power = 0): SupportItemDetails {
	return {
		id,
		rarity: ItemRarity.RARE,
		nature,
		power,
		maxPower: power,
		itemCategory
	};
}

/**
 * Click on a button or a select menu of a displayed message, recording what Discord is asked to display in answer
 */
export type FakeClick = {
	id: string;
	user: FakeUser;
	customId: string;
	values: string[];
	createdTimestamp: number;
	deferred: boolean;
	replied: boolean;
	channel: object;
	messages: RenderedMessage[];
	message: { edit: (payload: unknown) => Promise<void> };
	isButton: () => boolean;
	isStringSelectMenu: () => boolean;
	isCommand: () => boolean;
	reply: (payload: unknown) => Promise<void>;
	update: (payload: unknown) => Promise<void>;
	editReply: (payload: unknown) => Promise<void>;
	followUp: (payload: unknown) => Promise<void>;
	deferUpdate: () => Promise<void>;
	deferReply: () => Promise<void>;
};

let clickCount = 0;

export function fakeClick(user: FakeUser, customId: string, values: string[] = []): FakeClick {
	const messages: RenderedMessage[] = [];
	const record = (method: string) => (payload: unknown): Promise<void> => {
		messages.push({
			method, payload
		});
		return Promise.resolve();
	};
	clickCount++;
	const click: FakeClick = {
		id: `click-${clickCount}`,
		user,
		customId,
		values,
		createdTimestamp: Date.now(),
		deferred: false,
		replied: false,
		channel: {},
		messages,
		message: { edit: (payload: unknown): Promise<void> => record("message.edit")(payload) },
		isButton: (): boolean => values.length === 0,
		isStringSelectMenu: (): boolean => values.length > 0,
		isCommand: (): boolean => false,
		reply: record("reply"),
		update: record("update"),
		editReply: record("editReply"),
		followUp: record("followUp"),
		deferUpdate: (): Promise<void> => {
			click.deferred = true;
			return Promise.resolve();
		},
		deferReply: (): Promise<void> => {
			click.deferred = true;
			return Promise.resolve();
		}
	};
	return click;
}

/**
 * Click on a collector of a displayed message and let the asynchronous handling of the click run
 */
export async function clickOn(collector: ReactionCollector, click: FakeClick): Promise<void> {
	collector.emit("collect", click, click.user);
	await new Promise(resolveClick => setTimeout(resolveClick, 0));
}

let collectorCount = 0;

/**
 * Creation packet of a Core collector, built by the collector class Core uses
 */
export function collectorPacket(collector: CoreReactionCollector, endTime = Date.now() + 60_000): ReactionCollectorCreationPacket {
	collectorCount++;
	return Object.assign(new ReactionCollectorCreationPacket(), collector.creationPacket(`collector-${collectorCount}`, endTime));
}

/**
 * Packets sent to Core so far, optionally only those of a given class
 */
export function sentPackets<T extends CrowniclesPacket>(packetClass?: abstract new () => T): {
	context: PacketContext; packet: T;
}[] {
	return vi.mocked(PacketUtils.sendPacketToBackend).mock.calls
		.filter(([, packet]) => !packetClass || packet instanceof packetClass)
		.map(([context, packet]) => ({
			context, packet: packet as T
		}));
}

/**
 * Click of the player on a menu of his command, cached as the front-end does before telling Core, with the context Core
 * answers the click with
 */
export function answeredClick(command: {
	interaction: FakeInteraction; context: PacketContext;
}, customId = "menu-button"): {
	click: FakeClick; context: PacketContext;
} {
	const click = fakeClick(command.interaction.user, customId);
	// The fake implements the members of a button interaction the front-end calls, not the whole discord.js class
	DiscordCache.cacheButtonInteraction(CrowniclesInteraction.cast(click as unknown as ButtonInteraction, command.interaction.userLanguage));
	return {
		click,
		context: {
			...command.context,
			discord: {
				...command.context.discord!,
				buttonInteraction: click.id
			}
		}
	};
}
