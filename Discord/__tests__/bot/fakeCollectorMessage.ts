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
 */
export function fakeCollectorMessage(): Message {
	const message = {
		id: "menu-message",
		client: new FakeClient(),
		edit: (): Promise<void> => Promise.resolve(),
		createReactionCollector: (options: CollectorOptions): ReactionCollector => new ReactionCollector(message as never, options),
		createMessageComponentCollector: (options: CollectorOptions): ReactionCollector => new ReactionCollector(message as never, options)
	};
	return message as never;
}

export function wait(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}
