import {
	describe, expect, it
} from "vitest";
import { Maps } from "../../../src/core/maps/Maps";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import type Player from "../../../src/core/database/game/models/Player";

/** Mount Celestrum -> Celestrum Forest, whose inverse leads back to the mountain */
const FROM_MOUNT_CELESTRUM = 51;

/** Coco Village -> Celestrum Forest, whose inverse leads back into a city */
const FROM_COCO_VILLAGE = 46;

/** Reception room -> Boug-Coton, a one way link out of the castle */
const OUT_OF_THE_CASTLE = 78;

function playerOnLink(mapLinkId: number): Player {
	return { mapLinkId } as Player;
}

/*
 * Travelling backwards is forbidden by getNextPlayerAvailableMaps: only a big event outcome may grant
 * the exception, and never in a way that would defeat the guard forbidding to re-enter a city (#4559).
 */
describe("Maps.getGoBackMapLink", () => {
	it("sends the player back to the map they are coming from", () => {
		const goBackLink = Maps.getGoBackMapLink(playerOnLink(FROM_MOUNT_CELESTRUM));

		expect(goBackLink?.startMap).toBe(MapConstants.LOCATIONS_IDS.CELESTRUM_FOREST);
		expect(goBackLink?.endMap).toBe(MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM);
	});

	it("refuses to send the player back into the city they just left", () => {
		expect(Maps.getGoBackMapLink(playerOnLink(FROM_COCO_VILLAGE))).toBeNull();
	});

	it("refuses to go back through a one way link", () => {
		expect(Maps.getGoBackMapLink(playerOnLink(OUT_OF_THE_CASTLE))).toBeNull();
	});
});
