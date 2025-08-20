import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../../CrowniclesPacket";
import { GuildRole } from "../../../types/GuildRole";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RequirementGuildRolePacket extends CrowniclesPacket {
	roleNeeded!: GuildRole;
}
