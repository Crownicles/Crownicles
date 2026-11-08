import { AppIcons } from "@/src/AppIcons";
import { i18n } from "@/src/translations/i18n";
import { MaterialQuantity } from "ws-packets/src/objects/MaterialQuantity";

/** Materials wear their own emoji wherever they are listed, and the generic pouch when the pack has none. */
export function materialName(materialId: number): string {
	const icon = AppIcons.getIconOrNull(`materials.${materialId}`) ?? AppIcons.getIcon("inventory.stock");
	return `${icon} ${i18n.t(`models:materials.${materialId}`)}`;
}

/** The materials in the alphabetical order of their names in the player's language, as Discord lists them. */
export function sortByMaterialName(materials: MaterialQuantity[]): MaterialQuantity[] {
	return materials
		.map(material => ({
			material, name: i18n.t(`models:materials.${material.materialId}`)
		}))
		.sort((first, second) => first.name.localeCompare(second.name, i18n.language))
		.map(({ material }) => material);
}

export function plantName(plantId: number): string {
	return `${AppIcons.getIcon(`plants.${plantId}`)} ${i18n.t(`models:plants.${plantId}`)}`;
}
