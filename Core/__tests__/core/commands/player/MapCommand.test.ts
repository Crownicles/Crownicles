import {describe, expect, it, vi} from "vitest";
import {MapCommand} from "../../../../src/commands/player/MapCommand";
import type {Player} from "../../../../src/core/database/game/models/Player";
import {MapConstants} from "../../../../../Lib/src/constants/MapConstants";
import {LANGUAGE} from "../../../../../Lib/src/Language";
import {makePacket} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {CommandMapDisplayRes, CommandMapPacketReq} from "../../../../../Lib/src/packets/commands/CommandMapPacket";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => descriptor,
	CommandUtils: {DISALLOWED_EFFECTS: {NOT_STARTED_OR_DEAD: []}, WHERE: {EVERYWHERE: []}}
}));
vi.mock("../../../../src/core/maps/Maps", () => ({Maps: {isArrived: () => false}}));
vi.mock("../../../../src/data/MapLink", () => ({MapLinkDataController: {instance: {getById: () => ({})}}}));
vi.mock("../../../../src/data/City", () => ({CityDataController: {instance: {getAllValues: () => []}}}));
vi.mock("../../../../src/core/missions/MissionsController", () => ({MissionsController: {update: vi.fn()}}));

function playerDepartingFrom(startMapId: number): Player {
	return {
		mapLinkId: 1,
		getPreviousMap: () => ({id: startMapId, attribute: MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT}),
		getDestination: () => ({id: MapConstants.LOCATIONS_IDS.CLAIRE_DE_VILLE, type: "ci"})
	} as Player;
}

describe("first map of the royal contest", () => {
	it("uses the available destination map instead of a missing castle-to-city image", async () => {
		const response: CommandMapDisplayRes[] = [];
		await new MapCommand().execute(response, playerDepartingFrom(MapConstants.LOCATIONS_IDS.RECEPTION_ROOM), makePacket(CommandMapPacketReq, {language: LANGUAGE.FRENCH}));
		expect(response[0].mapLink).toEqual({name: "fr_23_", fallback: "en_23_", forced: false});
	});

	it("preserves the normal route image on later journeys", async () => {
		const response: CommandMapDisplayRes[] = [];
		await new MapCommand().execute(response, playerDepartingFrom(MapConstants.LOCATIONS_IDS.HOWLING_WOODS), makePacket(CommandMapPacketReq, {language: LANGUAGE.FRENCH}));
		expect(response[0].mapLink).toEqual({name: "fr_22_23_", fallback: "en_22_23_", forced: false});
	});
});