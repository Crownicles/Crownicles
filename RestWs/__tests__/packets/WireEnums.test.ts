import {
	describe, expect, it
} from "vitest";
import {
	ItemNature as LibItemNature, ItemRarity as LibItemRarity
} from "../../../Lib/src/constants/ItemConstants";
import {PlantId as LibPlantId} from "../../../Lib/src/constants/PlantConstants";
import { ItemNature } from "../../../WsPackets/src/objects/ItemNature";
import { ItemRarity } from "../../../WsPackets/src/objects/ItemRarity";
import {PlantId} from "../../../WsPackets/src/objects/PlantId";

/**
 * `WsPackets` is standalone by design, so it redeclares the enums it puts on the wire instead of
 * importing them from `Lib`. Nothing in the type system ties the two together: numeric enums are
 * assignable to each other, so a value reordered in `Lib` would silently change meaning for every
 * installed client. These tests are that missing link.
 */
describe("wire enums mirror their back-end counterpart", () => {
	it.each([
		["ItemNature", ItemNature, LibItemNature],
		["ItemRarity", ItemRarity, LibItemRarity],
		["PlantId", PlantId, LibPlantId]
	])("%s has the same members in the same order", (_name, wireEnum, libEnum) => {
		expect(wireEnum).toStrictEqual(libEnum);
	});
});
