import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * Reasons why the /garden command cannot grant access to a garden.
 */
export const GardenNoAccessReason = {

	/** The player does not own a home, so they have no garden at all. */
	NO_HOME: "noHome",

	/** The player is away from their home and does not own the Cœur Sylvestre talisman. */
	NO_TALISMAN: "noTalisman",

	/** The player owns a home but its level does not unlock the garden yet. */
	NO_GARDEN: "noGarden"
} as const;
export type GardenNoAccessReason = typeof GardenNoAccessReason[keyof typeof GardenNoAccessReason];

/**
 * Request packet: player invoked /garden.
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGardenPacketReq extends CrowniclesPacket {}

/**
 * Response packet: /garden refused, send a narrative reply.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGardenNoAccessRes extends CrowniclesPacket {
	reason!: GardenNoAccessReason;
}

/**
 * Response packet: /garden was closed normally.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGardenClosedRes extends CrowniclesPacket {}
