import { EventEmitter } from "node:events";
import {
	Message, ReactionCollector
} from "discord.js";

type CollectorOptions = ConstructorParameters<typeof ReactionCollector>[1];

/**
 * Bare client accepting the listeners a real discord.js collector registers
 */
class FakeClient extends EventEmitter {
	incrementMaxListeners(): void {
		this.setMaxListeners(this.getMaxListeners() + 1);
	}

	decrementMaxListeners(): void {
		this.setMaxListeners(Math.max(this.getMaxListeners() - 1, 0));
	}
}

/**
 * Message whose collectors are real discord.js collectors, so their timers behave as in production.
 * Component collectors are backed by a reaction collector: both share the timer logic of the discord.js Collector base class
 * @param createdCollectors - Receives every collector created on the message
 */
export function fakeCollectorMessage(createdCollectors: ReactionCollector[] = []): Message {
	const createCollector = (options: CollectorOptions): ReactionCollector => {
		const collector = new ReactionCollector(message as never, options);
		createdCollectors.push(collector);
		return collector;
	};
	const message = {
		id: "menu-message",
		client: new FakeClient(),
		edit: (): Promise<void> => Promise.resolve(),
		createReactionCollector: createCollector,
		createMessageComponentCollector: createCollector
	};
	return message as never;
}

export function wait(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export type DeferredReply = {
	editReply: () => Promise<Message>;
	resolve: () => void;
};

/**
 * Reply that the test resolves itself, to simulate a slow Discord API
 * @param createdCollectors - Receives every collector created on the replied message
 */
export function deferredReply(createdCollectors: ReactionCollector[] = []): DeferredReply {
	let resolve!: () => void;
	const reply = new Promise<Message>(resolveReply => {
		resolve = (): void => resolveReply(fakeCollectorMessage(createdCollectors));
	});
	return {
		editReply: (): Promise<Message> => reply,
		resolve
	};
}
