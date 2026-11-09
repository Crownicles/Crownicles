import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportApartmentClaimRentRes } from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ApartmentRentRes } from "../../../../../WsPackets/src/fromServer/home/ApartmentRentRes";

export default class ApartmentRentServerTranslator {
	@fromServerTranslator(CommandReportApartmentClaimRentRes, ApartmentRentRes)
	public static claimed(_context: PacketContext, packet: CommandReportApartmentClaimRentRes): Promise<ApartmentRentRes> {
		return asyncMakeFromServerPacket(ApartmentRentRes, {
			mapLocationId: packet.mapLocationId, rent: packet.rentClaimed
		});
	}
}
