import {FromServerPacket} from "../FromServerPacket";

/**
 * The core can reject a request while a reaction collector is still open. This is a normal
 * response, not a transport failure; exposing it lets the app keep the collector on screen and
 * retry the report once the action is resolved.
 */
export class Blocked extends FromServerPacket {
	reasons!: string[];
}
