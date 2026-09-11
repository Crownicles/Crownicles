import { FromServerPacket } from "../FromServerPacket";

export class BlessingRes extends FromServerPacket {
	public static readonly wireName = "BlessingRes";

	public activeBlessingType!: number;

	public blessingEndAt?: number;

	public poolAmount!: number;

	public poolThreshold!: number;

	public lastTriggeredBy?: string;

	public topContributor?: string;

	public topContributorAmount?: number;

	public totalContributors!: number;

	public poolExpiresAt!: number;
}
