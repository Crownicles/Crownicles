import {
	BaseMessageOptions, Message
} from "discord.js";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { minutesToMilliseconds } from "../../../Lib/src/utils/TimeUtils";
import { DiscordCache } from "../bot/DiscordCache";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export abstract class CrowniclesCachedMessage<T extends CrowniclesPacket = CrowniclesPacket> {
	// Duration of the message's cached life in minutes
	abstract readonly duration: number;

	// The id of the original message
	readonly originalMessageId: string;

	// Message linked to this cached message
	storedMessage?: Message;

	// Toggleable variable to know if we should reupload the message
	reuploadMessage = false;

	constructor(originalMessageId: string) {
		this.originalMessageId = originalMessageId;
	}

	get cacheKey(): string {
		return `${this.originalMessageId}-${this.type}`;
	}

	// The type of the message, each interaction can store one cached message per type
	abstract get type(): string;

	// Function to call when you need to do something with the cached message
	abstract updateMessage(packet: T, context: PacketContext): Promise<ReactionCollectorReturnTypeOrNull>;

	async update(packet: T, context: PacketContext): Promise<ReactionCollectorReturnTypeOrNull> {
		return await this.updateMessage(packet, context);
	}

	async post(options: BaseMessageOptions): Promise<Message | null> {
		if (this.reuploadMessage) {
			this.storedMessage?.delete().then();
			this.storedMessage = undefined;
			this.reuploadMessage = false;
		}
		if (this.storedMessage) {
			return await this.storedMessage.edit(options);
		}
		const mainMessage = DiscordCache.getInteraction(this.originalMessageId);
		if (!mainMessage) {
			return null;
		}
		const message = await mainMessage.channel.send(options) as Message;
		this.storedMessage = message;
		return message;
	}

	async delete(): Promise<void> {
		if (this.storedMessage) {
			await this.storedMessage.delete();
		}
		this.storedMessage = undefined;
	}
}

type MessageLike<Message extends CrowniclesCachedMessage> = new (originalMessageId: string) => Message;

export abstract class CrowniclesCachedMessages {
	static cachedMessages: Map<string, CrowniclesCachedMessage> = new Map<string, CrowniclesCachedMessage>();

	static createCachedMessage(message: CrowniclesCachedMessage): void {
		CrowniclesCachedMessages.cachedMessages.set(message.cacheKey, message);
		setTimeout(() => {
			CrowniclesCachedMessages.remove(message.cacheKey);
		}, minutesToMilliseconds(message.duration));
	}

	/**
	 * Remove a cached message from its key
	 * @param cacheKey
	 */
	static remove(cacheKey: string): void {
		CrowniclesCachedMessages.cachedMessages.delete(cacheKey);
	}

	/**
	 * Remove all cached messages from a message id
	 * @param originalMessageId
	 * @param removeCallback
	 */
	static removeAllFromMessageId(originalMessageId: string, removeCallback: (cachedMessage: CrowniclesCachedMessage) => void): void {
		CrowniclesCachedMessages.cachedMessages.forEach((message, key) => {
			if (key.startsWith(originalMessageId)) {
				CrowniclesCachedMessages.remove(key);
				removeCallback(message);
			}
		});
	}

	static getOrCreate<Packet extends CrowniclesPacket, Message extends CrowniclesCachedMessage<Packet>>(originalMessageId: string, MessageLike: MessageLike<Message>): Message {
		const type = new MessageLike("").type;
		const message = CrowniclesCachedMessages.cachedMessages.get(`${originalMessageId}-${type}`);
		if (!message) {
			const newMessage = new MessageLike(originalMessageId);
			CrowniclesCachedMessages.createCachedMessage(newMessage);
			return newMessage;
		}
		return message as Message;
	}

	static markAsReupload(message: CrowniclesCachedMessage): void {
		CrowniclesCachedMessages.cachedMessages.get(message.cacheKey)!.reuploadMessage = true;
	}
}
