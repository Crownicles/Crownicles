import {ReactNode} from "react";
import {CraftResult, CookingOutcome} from "ws-packets/src/objects/Cooking";
import {KeyValue, Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {formatNumber} from "@/src/display/Amounts";
import {materialName} from "@/src/display/Resources";
import {i18n} from "@/src/translations/i18n";

function PetFoodResult({food}: {food: NonNullable<CraftResult["petFood"]>}): ReactNode {
	return <>
		<KeyValue label={i18n.t(`models:foods.${food.type}`, {count: food.quantity, context: "capitalized"})} value={i18n.t("app:cooking.foodStored", {quantity: food.quantity, stored: food.storedQuantity})} />
		{food.fedFromSurplus ? <Note>{i18n.t("app:cooking.petFed")}</Note> : null}
		{food.surplusMaterialId ? <KeyValue label={materialName(food.surplusMaterialId)} value={formatNumber(food.surplusMaterialQuantity ?? 0)} /> : null}
	</>;
}

function CraftRewards({result}: {result: CraftResult}): ReactNode {
	return <>
		{result.potionId ? <KeyValue label={i18n.t("app:cooking.potion")} value={i18n.t(`models:potions.${result.potionId}`)} /> : null}
		{result.failedPotionId ? <KeyValue label={i18n.t("app:cooking.consolation")} value={i18n.t(`models:potions.${result.failedPotionId}`)} /> : null}
		{result.petFood ? <PetFoodResult food={result.petFood} /> : null}
		{result.material ? <KeyValue label={materialName(result.material.materialId)} value={formatNumber(result.material.quantity)} /> : null}
		{result.materialSaved ? <Note>{i18n.t("app:cooking.savedMaterial", {material: i18n.t(`models:materials.${result.materialSaved}`)})}</Note> : null}
		{result.bonusOutput ? <Note>{i18n.t("app:cooking.bonusOutput")}</Note> : null}
	</>;
}

function CookingProgress({result}: {result: CraftResult}): ReactNode {
	return <>
		{result.cookingLevelUp ? <Note>{i18n.t("app:cooking.levelUp", {level: result.menu.cookingLevel, grade: i18n.t(`models:cooking.grades.${result.menu.cookingGrade}`)})}</Note> : null}
		{result.discoveredRecipes?.map(recipe => <Note key={recipe.recipeId}>{i18n.t("app:cooking.discovered", {recipe: i18n.t(`models:cooking.recipes.${recipe.recipeId}`), level: recipe.level})}</Note>)}
	</>;
}

function CraftedResult({result}: {result: CraftResult}): ReactNode {
	if (result.error) return null;
	return <>
		<SectionHeader>{i18n.t(result.success ? "app:cooking.success" : "app:cooking.failed")}</SectionHeader>
		<Panel><CraftRewards result={result} /><KeyValue label={i18n.t("app:cooking.xpGained")} value={formatNumber(result.cookingXpGained)} /></Panel>
		<CookingProgress result={result} />
	</>;
}

export function HomeCookingResults({outcome}: {outcome: CookingOutcome | null}): ReactNode {
	if (!outcome) return null;
	switch (outcome.kind) {
		case "furnace": return <Note>{i18n.t(outcome.woodConsumed ? "app:cooking.woodConsumed" : "app:cooking.woodSaved", {material: i18n.t(`models:materials.${outcome.woodMaterialId}`)})}</Note>;
		case "crafted": return <CraftedResult result={outcome.result} />;
		default: return null;
	}
}