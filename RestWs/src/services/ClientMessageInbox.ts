import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { WebSocketConstants } from "../constants/WebSocketConstants";

type ClientMessageHandler = (message: string) => Promise<void>;

/**
 * The app sends what it queued as soon as its socket opens, while the server is still checking its token:
 * those messages wait here and are handled in the order they came once the player is known.
 */
export class ClientMessageInbox {
	private held: string[] = [];

	private heldBytes = 0;

	private overflowed = false;

	private handler: ClientMessageHandler | null = null;

	public receive(message: string): Promise<void> {
		if (this.handler) {
			return this.handler(message);
		}
		this.hold(message);
		return Promise.resolve();
	}

	/** From now on every message is handled, starting with the ones that waited. */
	public async open(handler: ClientMessageHandler): Promise<void> {
		this.handler = handler;
		const held = this.held;
		this.held = [];
		this.heldBytes = 0;
		await Promise.all(held.map(message => handler(message)));
	}

	private hold(message: string): void {
		if (this.held.length >= WebSocketConstants.MAX_HELD_MESSAGES || this.heldBytes + message.length > WebSocketConstants.MAX_HELD_BYTES) {
			if (!this.overflowed) {
				this.overflowed = true;
				CrowniclesLogger.warn("Dropped client messages sent before their token was checked", {
					heldMessages: this.held.length,
					heldBytes: this.heldBytes
				});
			}
			return;
		}
		this.held.push(message);
		this.heldBytes += message.length;
	}
}
