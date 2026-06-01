import { Language } from "../../../Lib/src/Language";
import { MaterialQuantity } from "../../../Lib/src/types/MaterialQuantity";
import i18n from "../translations/i18n";

/**
 * Format a list of material loot entries for display in an embed description.
 * Returns an empty string when there is nothing to show, so callers can
 * concatenate the result without an extra emptiness check.
 */
export function formatMaterialLoot(materialLoot: MaterialQuantity[] | undefined, lng: Language): string {
	if (!materialLoot || materialLoot.length === 0) {
		return "";
	}

	const lines = [i18n.t("commands:materialLoot.title", { lng })];
	for (const entry of materialLoot) {
		lines.push(i18n.t("commands:materialLoot.line", {
			lng,
			materialId: entry.materialId,
			quantity: entry.quantity
		}));
	}
	return lines.join("\n");
}
