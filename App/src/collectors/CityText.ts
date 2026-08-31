import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function compactCityDescription(description: string): string {
	const firstParagraph = description.split("\n\n")[0].trim();
	const firstSentence = firstParagraph.match(/^.*?[.!?](?:\s|$)/)?.[0];
	return (firstSentence ?? firstParagraph).trim();
}

export function formatMoney(value: number): string {
	return `${value.toLocaleString("fr-FR")} ${AppIcons.getIcon("unitValues.money")}`;
}

export function materialSummary(materials: {materialId: number; quantity: number; playerQuantity: number}[]): string {
	return materials.map(material => `${material.quantity} × ${i18n.t(`models:materials.${material.materialId}`)} (${material.playerQuantity})`).join(", ");
}
