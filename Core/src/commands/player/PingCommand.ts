import {
	CommandPingPacketReq, CommandPingPacketRes
} from "../../../../Lib/src/packets/commands/CommandPingPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class PingCommand {
	@commandRequires(CommandPingPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[], _player: Player, packet: CommandPingPacketReq): void {
		response.push(makePacket(CommandPingPacketRes, {
			clientTime: packet.time
		}));
	}
}

