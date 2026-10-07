import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

/** Materials wear their own emoji wherever they are listed, and the generic pouch when the pack has none. */
export function materialName(materialId: number): string {
	const icon = AppIcons.getIconOrNull(`materials.${materialId}`) ?? AppIcons.getIcon("inventory.stock");
	return `${icon} ${i18n.t(`models:materials.${materialId}`)}`;
}

export function plantName(plantId: number): string {
	return `${AppIcons.getIcon(`plants.${plantId}`)} ${i18n.t(`models:plants.${plantId}`)}`;
}
