import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { PushPlatform } from "../../types/PushDevices";
import { Language } from "../../Language";

/** The app gives the token its push service assigned to this device, to be reached with the app closed. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPushDeviceRegisterReq extends CrowniclesPacket {
	token!: string;

	platform!: PushPlatform;

	sandbox!: boolean;

	language!: Language;
}

/** The device must no longer be reached: the player logged out, or the push service refused its token. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPushDeviceUnregisterReq extends CrowniclesPacket {
	token!: string;
}

/** The device will now receive the player's notifications. */
@sendablePacket(PacketDirection.NONE)
export class CommandPushDeviceRes extends CrowniclesPacket {}
