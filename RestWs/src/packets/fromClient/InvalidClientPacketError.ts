/**
 * Raised when a client packet cannot be turned into a back-end packet because its content is not
 * usable. Separated from other failures so the WebSocket server can drop the packet and log it as a
 * client mistake rather than as a server error.
 */
export class InvalidClientPacketError extends Error {
	public constructor(reason: string) {
		super(reason);
		this.name = "InvalidClientPacketError";
	}
}
