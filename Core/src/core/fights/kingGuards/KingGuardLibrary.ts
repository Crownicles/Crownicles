import Player from "../../database/game/models/Player";
import PetEntity from "../../database/game/models/PetEntity";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import {
	Class, ClassDataController
} from "../../../data/Class";
import { KingGuardData } from "../../../data/KingGuard";
import { WeaponDataController } from "../../../data/Weapon";
import { ArmorDataController } from "../../../data/Armor";
import { PotionDataController } from "../../../data/Potion";
import { ObjectItemDataController } from "../../../data/ObjectItem";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { KingGuardIdentity } from "../../../../../Lib/src/utils/KingGuardIdentity";

export type KingGuardEquipment = Pick<KingGuardData, "weapon" | "armor" | "potionId" | "objectId">;

/**
 * A guard of the library ready to fight: its player and pet are never persisted
 */
export type KingGuard = {
	data: KingGuardData;
	player: Player;
	guardClass: Class;
	activeObjects: PlayerActiveObjects;
	pet: PetEntity | null;

	// Level of the player when the guard was chosen
	playerLevel: number;
};

/**
 * Equipped items of a guard, from the ids of the library (checked by the library data test)
 * @param equipment
 */
export function buildKingGuardActiveObjects(equipment: KingGuardEquipment): PlayerActiveObjects {
	return {
		weapon: {
			item: WeaponDataController.instance.getById(equipment.weapon.id)!,
			itemLevel: equipment.weapon.level,
			itemEnchantmentId: equipment.weapon.enchantmentId
		},
		armor: {
			item: ArmorDataController.instance.getById(equipment.armor.id)!,
			itemLevel: equipment.armor.level,
			itemEnchantmentId: equipment.armor.enchantmentId
		},
		potion: { item: PotionDataController.instance.getById(equipment.potionId)! },
		object: { item: ObjectItemDataController.instance.getById(equipment.objectId)! }
	};
}

/**
 * Build a guard of the library as an unsaved player with its equipment and pet
 * @param data - The guard in the library
 * @param playerLevel - Level of the player it is going to fight
 */
export function buildKingGuard(data: KingGuardData, playerLevel: number): KingGuard {
	return {
		data,
		player: Player.build({
			keycloakId: KingGuardIdentity.toKeycloakId(data.id),
			level: data.level,
			class: data.classId,
			petId: null
		}),
		guardClass: ClassDataController.instance.getById(data.classId)!,
		activeObjects: buildKingGuardActiveObjects(data),
		pet: data.pet
			? PetEntity.build({
				typeId: data.pet.typeId,
				sex: data.pet.sex,
				nickname: null,
				lovePoints: PetConstants.BASE_LOVE
			})
			: null,
		playerLevel
	};
}
