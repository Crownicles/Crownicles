import {
	describe, expect, it
} from "vitest";
import {
	ItemNature as LibItemNature, ItemRarity as LibItemRarity, ItemConstants
} from "../../../Lib/src/constants/ItemConstants";
import {PlantId as LibPlantId} from "../../../Lib/src/constants/PlantConstants";
import { ItemNature } from "../../../WsPackets/src/objects/ItemNature";
import { ItemRarity } from "../../../WsPackets/src/objects/ItemRarity";
import {PlantId} from "../../../WsPackets/src/objects/PlantId";
import {EQUIP_ACTIONS, EQUIP_ERRORS} from "../../../WsPackets/src/objects/EquipCategoryData";
import { MissionType as LibMissionType } from "../../../Lib/src/types/CompletedMission";
import { MISSION_TYPES } from "../../../WsPackets/src/objects/Mission";
import { BlessingType as LibBlessingType } from "../../../Lib/src/constants/BlessingConstants";
import { BlessingType } from "../../../WsPackets/src/objects/BlessingType";
import { Badge as LibBadge } from "../../../Lib/src/types/Badge";
import { BADGE_CODES } from "../../../WsPackets/src/objects/Badge";

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
		["PlantId", PlantId, LibPlantId],
		["MissionType", MISSION_TYPES, LibMissionType],
		["BlessingType", BlessingType, LibBlessingType],
		["Badge", BADGE_CODES, LibBadge],
		["EquipAction", EQUIP_ACTIONS, ItemConstants.EQUIP_ACTIONS],
		["EquipError", EQUIP_ERRORS, ItemConstants.EQUIP_ERRORS]
	])("%s has the same members in the same order", (_name, wireEnum, libEnum) => {
		expect(wireEnum).toStrictEqual(libEnum);
	});
});
