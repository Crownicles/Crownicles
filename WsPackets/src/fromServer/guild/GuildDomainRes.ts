import { FromServerPacket } from "../FromServerPacket";
import {
	GuildDomainOutcome, GuildDomainSnapshot
} from "../../objects/GuildDomain";

export class GuildDomainInfoRes extends FromServerPacket {
	public static readonly wireName = "GuildDomainInfoRes";

	data?: GuildDomainSnapshot;
}

export class GuildDomainRes extends FromServerPacket {
	public static readonly wireName = "GuildDomainRes";

	outcome!: GuildDomainOutcome;
}
