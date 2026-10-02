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
const currentLink = vi.hoisted(() => ({value: {} as {forcedImage?: string}}));
vi.mock("../../../../src/data/MapLink", () => ({MapLinkDataController: {instance: {getById: () => currentLink.value}}}));
vi.mock("../../../../src/data/City", () => ({CityDataController: {instance: {getAllValues: () => []}}}));
vi.mock("../../../../src/core/missions/MissionsController", () => ({MissionsController: {update: vi.fn()}}));
const choosingDestination = vi.hoisted(() => ({value: false}));
vi.mock("../../../../src/core/utils/BlockingUtils", () => ({BlockingUtils: {isPlayerBlockedWithReason: (): boolean => choosingDestination.value}}));

function playerDepartingFrom(startMapId: number): Player {
	return {
		keycloakId: "player",
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

describe("map while choosing the next destination", () => {
	it.each([
		{
			name: "the Halloween map after a haunted road",
			link: {forcedImage: "halloween_map"},
			departure: {id: 39, attribute: MapConstants.MAP_ATTRIBUTES.HAUNTED},
			destination: {id: 40, type: "hauntedHouse"},
			expected: {name: "halloween_map_fr", forced: true}
		},
		{
			name: "the location's own picture when it has one",
			link: {forcedImage: "road_to_boat"},
			departure: {id: 1005, attribute: MapConstants.MAP_ATTRIBUTES.PVE_ISLAND},
			destination: {id: 1999, type: "pveExit", forcedImage: "boat_left"},
			expected: {name: "boat_left", forced: true}
		}
	])("shows $name on arrival, from the forced maps", async ({link, departure, destination, expected}) => {
		choosingDestination.value = true;
		currentLink.value = link;
		const response: CommandMapDisplayRes[] = [];
		await new MapCommand().execute(response, {
			keycloakId: "player",
			mapLinkId: 1,
			getPreviousMap: () => departure,
			getDestination: () => destination
		} as Player, makePacket(CommandMapPacketReq, {language: LANGUAGE.FRENCH}));
		choosingDestination.value = false;
		currentLink.value = {};
		expect(response[0].mapLink).toEqual(expected);
	});
	it("shows the player at the reached location rather than on the finished road", async () => {
		choosingDestination.value = true;
		const response: CommandMapDisplayRes[] = [];
		await new MapCommand().execute(response, playerDepartingFrom(MapConstants.LOCATIONS_IDS.HOWLING_WOODS), makePacket(CommandMapPacketReq, {language: LANGUAGE.FRENCH}));
		choosingDestination.value = false;
		expect(response[0].hasArrived).toBe(true);
		expect(response[0].mapLink).toEqual({name: "fr_23_", fallback: "en_23_", forced: false});
	});
});