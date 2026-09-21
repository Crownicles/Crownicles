import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandMapDisplayRes} from "../../../Lib/src/packets/commands/CommandMapPacket";
import {MapReq} from "../../../WsPackets/src/fromClient/MapReq";
import MapClientTranslator from "../../src/packets/fromClient/translators/MapClientTranslator";
import MapServerTranslator from "../../src/packets/fromServer/translators/MapServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
describe("world map protocol", () => {
	it("uses a supported language without letting the client select another player", async () => {
		const request = Object.assign(new MapReq(), {language: "fr", keycloakId: "other"});
		expect(await MapClientTranslator.map(CONTEXT, request)).toEqual({language: "fr"});
		expect(() => MapClientTranslator.map(CONTEXT, {...request, language: "invalid"})).toThrow("Invalid map language");
	});
	it("uses the official positioned map and keeps its language fallback", async () => {
		const packet = await MapServerTranslator.map(CONTEXT, makePacket(CommandMapDisplayRes, {mapId: 10, mapType: "ci", hasArrived: false, cities: [{id: "ville_forte", mapLocationId: 10, services: [], shops: []}], mapLink: {name: "fr_10_11_", fallback: "en_10_11_", forced: false}}));
		expect(packet.imageUrl).toBe("https://crownicles.com/public/ressources/mapsCursed/fr_10_11_map.jpg");
		expect(packet.fallbackImageUrl).toBe("https://crownicles.com/public/ressources/mapsCursed/en_10_11_map.jpg");
		expect(JSON.parse(JSON.stringify(packet))).not.toHaveProperty("cities");
	});
	it("preserves special map images selected by Core", async () => {
		const packet = await MapServerTranslator.map(CONTEXT, makePacket(CommandMapDisplayRes, {mapId: 10, mapType: "ci", hasArrived: false, cities: [], mapLink: {name: "boat", forced: true}}));
		expect(packet.imageUrl).toBe("https://crownicles.com/public/ressources/maps/boat.jpg");
		expect(JSON.parse(JSON.stringify(packet))).not.toHaveProperty("fallbackImageUrl");
	});
});
