import { FromServerPacket } from "./fromServer/FromServerPacket";
import { FromClientPacket } from "./fromClient/FromClientPacket";

export interface FromServerPacketLike<Packet extends FromServerPacket> {
	new(): Packet;
}

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

export interface FromClientPacketLike<Packet extends FromClientPacket> {
	new(): Packet;
}

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
