import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketReq } from "../../../../../Lib/src/packets/commands/CommandTestPacket";
import { CommandTestListPacketReq } from "../../../../../Lib/src/packets/commands/CommandTestListPacket";
import {
	TestCommandReq, TestListReq
} from "../../../../../WsPackets/src/fromClient/TestReq";

export default class TestCommandClientTranslator {
	@fromClientTranslator(TestCommandReq)
	public static translateCommand(context: PacketContext, packet: TestCommandReq): Promise<CommandTestPacketReq> {
		return asyncMakePacket(CommandTestPacketReq, {
			keycloakId: context.keycloakId!,
			command: packet.command
		});
	}

	@fromClientTranslator(TestListReq)
	public static translateList(_context: PacketContext, _packet: TestListReq): Promise<CommandTestListPacketReq> {
		return asyncMakePacket(CommandTestListPacketReq, {});
	}
}
