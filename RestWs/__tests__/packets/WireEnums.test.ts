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
import {ExpeditionConstants} from "../../../Lib/src/constants/ExpeditionConstants";
import {EXPEDITION_ERRORS, EXPEDITION_FOOD_CAUSES} from "../../../WsPackets/src/objects/PetExpedition";
import { PetFood as LibPetFood } from "../../../Lib/src/types/PetFood";
import { CommandPetFeedResult } from "../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { PetFood, PET_FEED_RESULTS } from "../../../WsPackets/src/objects/PetFood";
import {GuildBuilding as LibGuildBuilding, GUILD_DOMAIN_ERROR} from "../../../Lib/src/constants/GuildDomainConstants";
import {GuildBuilding, GUILD_DOMAIN_ERRORS} from "../../../WsPackets/src/objects/GuildDomain";
import {TopDataType as CoreTopDataType} from "../../../Lib/src/types/TopDataType";
import {TopTiming as CoreTopTiming} from "../../../Lib/src/types/TopTimings";
import {EloGameResult as CoreEloGameResult} from "../../../Lib/src/types/EloGameResult";
import {TopDataType, TopTiming, EloGameResult} from "../../../WsPackets/src/objects/Rankings";
import {Effect} from "../../../Lib/src/types/Effect";
import {PLAYER_EFFECTS} from "../../../WsPackets/src/objects/PlayerUtility";
import {HomeConstants} from "../../../Lib/src/constants/HomeConstants";
import {CHEST_ACTIONS, CHEST_ERRORS, PLANT_TRANSFER_ACTIONS, PLANT_TRANSFER_ERRORS} from "../../../WsPackets/src/objects/HomeChest";
import {RecipeType as CoreRecipeType, CookingOutputType as CoreCookingOutputType} from "../../../Lib/src/constants/CookingConstants";
import {CookingCraftErrors as CoreCookingCraftErrors} from "../../../Lib/src/types/CookingTypes";
import {RecipeType, CookingOutputType, CookingCraftErrors} from "../../../WsPackets/src/objects/Cooking";
import {GardenConstants} from "../../../Lib/src/constants/GardenConstants";
import {GardenNoAccessReason} from "../../../Lib/src/packets/commands/CommandGardenPacket";
import {GardenAccessMode} from "../../../Lib/src/types/GardenAccessMode";
import {GARDEN_OPERATIONS as CoreGardenOperations} from "../../../Lib/src/types/Garden";
import {GARDEN_OPERATIONS, GARDEN_ACCESS, GARDEN_NO_ACCESS, GARDEN_ERRORS} from "../../../WsPackets/src/objects/Garden";

/**
 * `WsPackets` is standalone by design, so it redeclares the enums it puts on the wire instead of
 * importing them from `Lib`. Nothing in the type system ties the two together: numeric enums are
 * assignable to each other, so a value reordered in `Lib` would silently change meaning for every
 * installed client. These tests are that missing link.
 */
describe("wire enums mirror their back-end counterpart", () => {
	it.each([
		["GardenOperations", GARDEN_OPERATIONS, CoreGardenOperations],
		["GardenAccess", GARDEN_ACCESS, GardenAccessMode],
		["GardenNoAccess", GARDEN_NO_ACCESS, GardenNoAccessReason],
		["GardenErrors", GARDEN_ERRORS, GardenConstants.GARDEN_ERRORS],
		["RecipeType", RecipeType, CoreRecipeType],
		["CookingOutputType", CookingOutputType, CoreCookingOutputType],
		["CookingCraftErrors", CookingCraftErrors, CoreCookingCraftErrors],
		["ChestActions", CHEST_ACTIONS, HomeConstants.CHEST_ACTIONS],
		["ChestErrors", CHEST_ERRORS, HomeConstants.CHEST_ERRORS],
		["PlantTransferActions", PLANT_TRANSFER_ACTIONS, HomeConstants.PLANT_TRANSFER_ACTIONS],
		["PlantTransferErrors", PLANT_TRANSFER_ERRORS, HomeConstants.PLANT_TRANSFER_ERRORS],
		["DeathEffect", PLAYER_EFFECTS, {DEAD: Effect.DEAD.id}],
		["TopDataType", TopDataType, CoreTopDataType],
		["TopTiming", TopTiming, CoreTopTiming],
		["EloGameResult", EloGameResult, CoreEloGameResult],
		["GuildBuilding", GuildBuilding, LibGuildBuilding],
		["GuildDomainError", GUILD_DOMAIN_ERRORS, GUILD_DOMAIN_ERROR],
		["ItemNature", ItemNature, LibItemNature],
		["ItemRarity", ItemRarity, LibItemRarity],
		["PlantId", PlantId, LibPlantId],
		["MissionType", MISSION_TYPES, LibMissionType],
		["BlessingType", BlessingType, LibBlessingType],
		["Badge", BADGE_CODES, LibBadge],
		["ExpeditionErrors", EXPEDITION_ERRORS, ExpeditionConstants.ERROR_CODES],
		["ExpeditionFoodCauses", EXPEDITION_FOOD_CAUSES, ExpeditionConstants.INSUFFICIENT_FOOD_CAUSES],
		["PetFood", PetFood, LibPetFood],
		["PetFeedResult", PET_FEED_RESULTS, CommandPetFeedResult],
		["EquipAction", EQUIP_ACTIONS, ItemConstants.EQUIP_ACTIONS],
		["EquipError", EQUIP_ERRORS, ItemConstants.EQUIP_ERRORS]
	])("%s has the same members in the same order", (_name, wireEnum, libEnum) => {
		expect(wireEnum).toStrictEqual(libEnum);
	});
});
