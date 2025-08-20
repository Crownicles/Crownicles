import "../index"; // Import so it will verify decorators if we use CrowniclesPacket
import { Language } from "../Language";
import { RightGroup } from "../types/RightGroup";

const AllPackets = new Map<string, PacketDirection>();

export enum PacketDirection {
	NONE,
	FRONT_TO_BACK,
	BACK_TO_FRONT
}

export function sendablePacket(direction: PacketDirection) {
	/*
	 * This decorator applies onto any packet (which looks like classes, and so functions) so disabling
	 * the unsafe function type is okay, as it's only called during bot initialisation
	 */
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return function(constructor: Function): void {
		AllPackets.set(constructor.name, direction);
	};
}

export class CrowniclesPacket {
}

export interface PacketContext {
	frontEndOrigin: string;

	frontEndSubOrigin: string;

	keycloakId?: string;

	discord?: {
		user: string;
		interaction: string;
		buttonInteraction?: string;
		stringSelectMenuInteraction?: string;
		channel: string;
		language: Language;
		shardId: number;
	};

	webSocket?: Record<string, never>;

	rightGroups?: RightGroup[];

	// Used when waiting for an answer
	packetId?: string;
}

export interface PacketLike<Packet extends CrowniclesPacket> {
	new(): Packet;
}


export function makePacket<Packet extends CrowniclesPacket>(PacketObject: PacketLike<Packet>, { ...args }: Packet): Packet {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return instance;
}

export function asyncMakePacket<Packet extends CrowniclesPacket>(PacketObject: PacketLike<Packet>, { ...args }: Packet): Promise<Packet> {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return Promise.resolve(instance);
}
