import {
	CommandUpdatePacketReq, CommandUpdatePacketRes
} from "../../../../Lib/src/packets/commands/CommandUpdatePacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class UpdateCommand {
	@commandRequires(CommandUpdatePacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[]): void {
		response.push(makePacket(CommandUpdatePacketRes, {
			coreVersion: process.env.npm_package_version
		}));
	}
}
