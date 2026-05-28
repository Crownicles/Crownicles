import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MainItemDetails } from "../../../../../../Lib/src/types/MainItemDetails";

/**
 * Minimal shape needed to render an upgrade item detail block.
 * Both the standard and royal blacksmiths satisfy this contract.
 */
export type UpgradeItemForDisplay = {
	details: MainItemDetails;
	upgradeCost: number;
	missingMaterialsCost: number;
	hasAllMaterials: boolean;
	requiredMaterials: {
		materialId: number;
		playerQuantity: number;
		quantity: number;
	}[];
};

/**
 * Build the description block shown on the "upgrade item detail" screen.
 *
 * Shared between the standard and royal blacksmiths so the matériaux
 * breakdown stays consistent. `extraLines` lets the royal variant inject
 * gem cost / level info above the materials section.
 */
export function buildUpgradeDetailDescription(params: {
	item: UpgradeItemForDisplay;
	lng: Language;
	titleKey: string;
	titleParams: Record<string, unknown>;
	missingOfferKey?: string;
	extraLines?: string[];
}): string {
	const {
		item, lng, titleKey, titleParams, missingOfferKey, extraLines
	} = params;
	const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);

	const materialLines = item.requiredMaterials.map(material => {
		const icon = CrowniclesIcons.materials[material.materialId] ?? CrowniclesIcons.collectors.question;
		const materialName = i18n.t(`models:materials.${material.materialId}`, { lng });
		const hasEnough = material.playerQuantity >= material.quantity;
		const statusIcon = hasEnough ? CrowniclesIcons.collectors.accept : CrowniclesIcons.collectors.refuse;
		return `${statusIcon} ${icon} **${materialName}** : ${material.playerQuantity}/${material.quantity}`;
	});

	let description = i18n.t(titleKey, {
		lng,
		itemDisplay,
		materials: materialLines.join("\n"),
		...titleParams
	});

	if (extraLines && extraLines.length > 0) {
		description += `\n\n${extraLines.join("\n")}`;
	}

	if (!item.hasAllMaterials && missingOfferKey) {
		description += `\n\n${i18n.t(missingOfferKey, {
			lng,
			missingMaterialsCost: item.missingMaterialsCost
		})}`;
	}

	return description;
}
