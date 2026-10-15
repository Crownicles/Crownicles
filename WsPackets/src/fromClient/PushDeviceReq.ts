import { FromClientPacket } from "./FromClientPacket";
import { PushPlatform } from "../objects/PushDevices";

/** The token the device's push service gave the app, and the language the app is shown in there. `sandbox` when the build is signed to debug. */
export class PushDeviceRegisterReq extends FromClientPacket {
	public static readonly wireName = "PushDeviceRegisterReq";

	token!: string;

	platform!: PushPlatform;

	sandbox!: boolean;

	language!: string;
}

/** Sent before logging out: the device must no longer receive this player's notifications. */
export class PushDeviceUnregisterReq extends FromClientPacket {
	public static readonly wireName = "PushDeviceUnregisterReq";

	token!: string;
}
