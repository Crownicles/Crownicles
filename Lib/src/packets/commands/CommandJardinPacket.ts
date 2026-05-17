import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * Reasons why the /jardin command cannot grant access to a garden.
 */
export const JardinNoAccessReason = {

	/** The player does not own a home, so they have no garden at all. */
	NO_HOME: "noHome",

	/** The player is away from their home and does not own the Cœur Sylvestre talisman. */
	NO_TALISMAN: "noTalisman",

	/** The player owns a home but its level does not unlock the garden yet. */
	NO_GARDEN: "noGarden"
} as const;
export type JardinNoAccessReason = typeof JardinNoAccessReason[keyof typeof JardinNoAccessReason];

/**
 * Request packet: player invoked /jardin.
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandJardinPacketReq extends CrowniclesPacket {}

/**
 * Response packet: /jardin refused, send a narrative reply.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJardinNoAccessRes extends CrowniclesPacket {
	reason!: JardinNoAccessReason;
}
