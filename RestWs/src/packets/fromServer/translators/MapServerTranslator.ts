import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandMapDisplayRes } from "../../../../../Lib/src/packets/commands/CommandMapPacket";
import { MapConstants } from "../../../../../Lib/src/constants/MapConstants";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { MapRes } from "../../../../../WsPackets/src/fromServer/report/MapRes";

function mapImageUrl(name: string, forced: boolean): string {
	return forced ? MapConstants.FORCED_MAPS_URL.replace("{name}", encodeURIComponent(name)) : MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", encodeURIComponent(name));
}

export default class MapServerTranslator {
	@fromServerTranslator(CommandMapDisplayRes, MapRes)
	public static map(_context: PacketContext, packet: CommandMapDisplayRes): Promise<MapRes> {
		return asyncMakeFromServerPacket(MapRes, {
			mapId: packet.mapId,
			mapType: packet.mapType,
			hasArrived: packet.hasArrived,
			cities: packet.cities,
			imageUrl: mapImageUrl(packet.mapLink.name, packet.mapLink.forced),
			...packet.mapLink.fallback ? { fallbackImageUrl: mapImageUrl(packet.mapLink.fallback, packet.mapLink.forced) } : {}
		});
	}
}
