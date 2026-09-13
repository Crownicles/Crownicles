import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {CookingMenuReq, CookingIgniteReq, CookingReviveReq, CookingWoodConfirmReq, CookingCraftReq, CookingPinReq, CookingUnpinReq} from "ws-packets/src/fromClient/CookingReq";
import {CookingRes} from "ws-packets/src/fromServer/home/CookingRes";
import {CookingMenu, CookingSlot, RecipeIngredients, CraftResult, CookingOutcome} from "ws-packets/src/objects/Cooking";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {CookingRequest, cookingMenuFromOutcome, useCookingActions} from "@/src/store/useCookingActions";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {AppIcons} from "@/src/AppIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type CookingActions = {pending: boolean; submit: (request: CookingRequest) => Promise<void>};
type RecipeSelection = {slotIndex: number; recipe: NonNullable<CookingSlot["recipe"]>};

function Ingredients({ingredients}: {ingredients: RecipeIngredients}): ReactNode {
	return <>
		{ingredients.plants.map(plant => <KeyValue key={plant.plantId} label={`${AppIcons.getIcon(`plants.${plant.plantId}`)} ${i18n.t(`models:plants.${plant.plantId}`)}`} value={i18n.t("app:cooking.ingredientQuantity", {owned: plant.playerHas, required: plant.quantity})} />)}
		{ingredients.materials.map(material => <KeyValue key={material.materialId} label={i18n.t(`models:materials.${material.materialId}`)} value={i18n.t("app:cooking.ingredientQuantity", {owned: material.playerHas, required: material.quantity})} />)}
	</>;
}

function recipeName(recipe: NonNullable<CookingSlot["recipe"]>): string {
	return recipe.isSecret ? i18n.t("app:cooking.secretRecipe") : i18n.t(`models:cooking.recipes.${recipe.id}`);
}

function RecipeSlot({slot, actions, onSelect}: {slot: CookingSlot; actions: CookingActions; onSelect: (selection: RecipeSelection) => void}): ReactNode {
	const {recipe, slotIndex} = slot;
	if (!recipe) return <Note>{i18n.t("app:cooking.emptySlot", {slot: slotIndex + 1})}</Note>;
	return <>
		<SectionHeader>{recipeName(recipe)}</SectionHeader>
		<Panel><KeyValue label={i18n.t("app:cooking.recipeLevel")} value={formatNumber(recipe.level)} /><Ingredients ingredients={recipe.ingredients} /></Panel>
		{!recipe.canCraft ? <Note>{i18n.t("app:cooking.notReady")}</Note> : null}
		<ButtonRow>
			<Button variant="primary" disabled={actions.pending || !recipe.canCraft} onPress={(): void => onSelect({slotIndex, recipe})}>{i18n.t("app:cooking.craft")}</Button>
			{!recipe.isSecret ? <Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingPinReq, {recipeId: recipe.id, fromIgnitedView: true}))}>{i18n.t("app:cooking.pin")}</Button> : null}
		</ButtonRow>
	</>;
}

function PinnedRecipe({menu, actions}: {menu: CookingMenu; actions: CookingActions}): ReactNode {
	if (!menu.pinnedRecipe) return null;
	const {pinnedRecipe} = menu;
	return <>
		<SectionHeader>{i18n.t("app:cooking.pinned")}</SectionHeader>
		<Panel><KeyValue label={i18n.t(`models:cooking.recipes.${pinnedRecipe.recipeId}`)} value={formatNumber(pinnedRecipe.level)} /><Ingredients ingredients={pinnedRecipe.ingredients} /></Panel>
		<ButtonRow><Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingUnpinReq, {fromIgnitedView: menu.isIgnited}))}>{i18n.t("app:cooking.unpin")}</Button></ButtonRow>
	</>;
}

function PetFoodResult({food}: {food: NonNullable<CraftResult["petFood"]>}): ReactNode {
	return <>
		<KeyValue label={i18n.t(`models:foods.${food.type}`, {count: food.quantity, context: "capitalized"})} value={i18n.t("app:cooking.foodStored", {quantity: food.quantity, stored: food.storedQuantity})} />
		{food.fedFromSurplus ? <Note>{i18n.t("app:cooking.petFed")}</Note> : null}
		{food.surplusMaterialId ? <KeyValue label={i18n.t(`models:materials.${food.surplusMaterialId}`)} value={formatNumber(food.surplusMaterialQuantity ?? 0)} /> : null}
	</>;
}

function CraftRewards({result}: {result: CraftResult}): ReactNode {
	return <>
		{result.potionId ? <KeyValue label={i18n.t("app:cooking.potion")} value={i18n.t(`models:potions.${result.potionId}`)} /> : null}
		{result.failedPotionId ? <KeyValue label={i18n.t("app:cooking.consolation")} value={i18n.t(`models:potions.${result.failedPotionId}`)} /> : null}
		{result.petFood ? <PetFoodResult food={result.petFood} /> : null}
		{result.material ? <KeyValue label={i18n.t(`models:materials.${result.material.materialId}`)} value={formatNumber(result.material.quantity)} /> : null}
		{result.materialSaved ? <Note>{i18n.t("app:cooking.savedMaterial", {material: i18n.t(`models:materials.${result.materialSaved}`)})}</Note> : null}
		{result.bonusOutput ? <Note>{i18n.t("app:cooking.bonusOutput")}</Note> : null}
	</>;
}

function CookingResult({outcome}: {outcome: CookingOutcome | null}): ReactNode {
	if (outcome?.kind === "furnace") return <Note>{i18n.t(outcome.woodConsumed ? "app:cooking.woodConsumed" : "app:cooking.woodSaved", {material: i18n.t(`models:materials.${outcome.woodMaterialId}`)})}</Note>;
	if (outcome?.kind !== "crafted" || outcome.result.error) return null;
	const {result} = outcome;
	return <>
		<SectionHeader>{i18n.t(result.success ? "app:cooking.success" : "app:cooking.failed")}</SectionHeader>
		<Panel><CraftRewards result={result} /><KeyValue label={i18n.t("app:cooking.xpGained")} value={formatNumber(result.cookingXpGained)} /></Panel>
		{result.cookingLevelUp ? <Note>{i18n.t("app:cooking.levelUp", {level: result.menu.cookingLevel, grade: i18n.t(`models:cooking.grades.${result.menu.cookingGrade}`)})}</Note> : null}
		{result.discoveredRecipes?.map(recipe => <Note key={recipe.recipeId}>{i18n.t("app:cooking.discovered", {recipe: i18n.t(`models:cooking.recipes.${recipe.recipeId}`), level: recipe.level})}</Note>)}
	</>;
}

function FurnaceActions({isIgnited, actions}: {isIgnited: boolean; actions: CookingActions}): ReactNode {
	const [revive, setRevive] = useState(false);
	const confirmRevive = (): void => {
		setRevive(false);
		actions.submit(makeFromClientPacket(CookingReviveReq, {})).catch(console.error);
	};
	return <>
		<ButtonRow>{isIgnited
			? <Button disabled={actions.pending} onPress={(): void => setRevive(true)}>{i18n.t("app:cooking.revive")}</Button>
			: <Button variant="primary" disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingIgniteReq, {}))}>{i18n.t("app:cooking.ignite")}</Button>}</ButtonRow>
		{revive ? <Confirmation title={i18n.t("app:cooking.revive")} message={i18n.t("app:cooking.confirmRevive")} onRequestClose={(): void => setRevive(false)}><ButtonRow><Button variant="primary" disabled={actions.pending} onPress={confirmRevive}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setRevive(false)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation> : null}
	</>;
}

function WoodConfirmation({outcome, actions}: {outcome: CookingOutcome | null; actions: CookingActions}): ReactNode {
	if (outcome?.kind !== "woodConfirmation") return null;
	const confirm = (accepted: boolean): Promise<void> => actions.submit(makeFromClientPacket(CookingWoodConfirmReq, {accepted}));
	return <Confirmation title={i18n.t("app:cooking.rareWood")} message={i18n.t("app:cooking.confirmWood", {material: i18n.t(`models:materials.${outcome.woodMaterialId}`), rarity: i18n.t(`items:raritiesWithoutEmote.${outcome.woodRarity}`)})} onRequestClose={(): void => {confirm(false).catch(console.error);}}><ButtonRow><Button variant="primary" disabled={actions.pending} onPress={(): Promise<void> => confirm(true)}>{i18n.t("app:collector.accept")}</Button><Button disabled={actions.pending} onPress={(): Promise<void> => confirm(false)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation>;
}

function CookingContent({menu}: {menu: CookingMenu}): ReactNode {
	const actions = useCookingActions();
	const [selection, setSelection] = useState<RecipeSelection | null>(null);
	const confirm = (): void => {
		if (!selection) return;
		setSelection(null);
		actions.submit(makeFromClientPacket(CookingCraftReq, {slotIndex: selection.slotIndex, recipeId: selection.recipe.id})).catch(console.error);
	};
	return <>
		<Panel><KeyValue label={i18n.t("app:cooking.level")} value={formatNumber(menu.cookingLevel)} /><KeyValue label={i18n.t("app:cooking.grade")} value={i18n.t(`models:cooking.grades.${menu.cookingGrade}`)} /><KeyValue label={i18n.t("app:cooking.furnace")} value={i18n.t(menu.isIgnited ? "app:cooking.lit" : "app:cooking.unlit")} /></Panel>
		{actions.message ? <Note>{actions.message}</Note> : null}
		<CookingResult outcome={actions.outcome} />
		<PinnedRecipe menu={menu} actions={actions} />
		{menu.currentSlots.map(slot => <RecipeSlot key={slot.slotIndex} slot={slot} actions={actions} onSelect={setSelection} />)}
		<FurnaceActions isIgnited={menu.isIgnited} actions={actions} />
		{selection ? <Confirmation title={i18n.t("app:cooking.craft")} message={i18n.t("app:cooking.confirmCraft", {recipe: recipeName(selection.recipe)})} onRequestClose={(): void => setSelection(null)}><ButtonRow><Button variant="primary" disabled={actions.pending} onPress={confirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow></Confirmation> : null}
		<WoodConfirmation outcome={actions.outcome} actions={actions} />
	</>;
}

export function HomeCooking(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.COOKING, () => GameClient.request(makeFromClientPacket(CookingMenuReq, {}), CookingRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.COOKING}>{packet => {
		const menu = cookingMenuFromOutcome(packet.outcome);
		return menu ? <CookingContent menu={menu} /> : <Note>{i18n.t("app:cooking.unavailable")}</Note>;
	}}</GameQueryContent>;
}