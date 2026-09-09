import { FromServerPacket } from "./fromServer/FromServerPacket";
import { FromClientPacket } from "./fromClient/FromClientPacket";

/**
 * Identifier a packet travels under between the app and RestWs.
 *
 * Every packet class declares it as a literal instead of letting it be read from the class name.
 * The app ships as a minified bundle where class names are mangled, and a back-end rename must not
 * silently change what published apps send.
 */
export type PacketWireName = string;

/**
 * Reads the wire identifier of an already built packet.
 *
 * TypeScript types `Object.prototype.constructor` as `Function`, which carries no static members,
 * so reaching the identifier declared by the packet class needs a cast.
 */
export function wireNameOf(packet: FromClientPacket | FromServerPacket): PacketWireName {
	return (packet.constructor as unknown as { readonly wireName: PacketWireName }).wireName;
}

export type FromServerPacketLike<Packet extends FromServerPacket> = (new () => Packet) & { readonly wireName: PacketWireName };

export function makeFromServerPacket<Packet extends FromServerPacket>(PacketObject: FromServerPacketLike<Packet>, { ...args }: Packet): Packet {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return instance;
}

export function asyncMakeFromServerPacket<Packet extends FromServerPacket>(PacketObject: FromServerPacketLike<Packet>, { ...args }: Packet): Promise<Packet> {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return Promise.resolve(instance);
}

export type FromClientPacketLike<Packet extends FromClientPacket> = (new () => Packet) & { readonly wireName: PacketWireName };

export function makeFromClientPacket<Packet extends FromClientPacket>(PacketObject: FromClientPacketLike<Packet>, { ...args }: Packet): Packet {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return instance;
}

export function asyncMakeFromClientPacket<Packet extends FromClientPacket>(PacketObject: FromClientPacketLike<Packet>, { ...args }: Packet): Promise<Packet> {
	const instance = new PacketObject();
	Object.assign(instance, args);
	return Promise.resolve(instance);
}
