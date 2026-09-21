import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {CookingMenuReq, CookingIgniteReq, CookingReviveReq, CookingWoodConfirmReq, CookingCraftReq, CookingPinReq, CookingUnpinReq} from "ws-packets/src/fromClient/CookingReq";
import {CookingRes} from "ws-packets/src/fromServer/home/CookingRes";
import {CookingMenu, CookingSlot, RecipeIngredients, CookingOutcome} from "ws-packets/src/objects/Cooking";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {CookingRequest, cookingMenuFromOutcome, useCookingActions} from "@/src/store/useCookingActions";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {HomeCookingResults} from "@/src/components/HomeCookingResults";
import {Button, ButtonRow, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Fact, sectionStyles} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {materialName, plantName} from "@/src/display/Resources";
import {i18n} from "@/src/translations/i18n";

type CookingActions = {pending: boolean; submit: (request: CookingRequest) => Promise<void>};

function Ingredients({ingredients}: {ingredients: RecipeIngredients}): ReactNode {
	return <>
		{ingredients.plants.map(plant => <Fact key={plant.plantId} label={plantName(plant.plantId)} value={i18n.t("app:cooking.ingredientQuantity", {owned: plant.playerHas, required: plant.quantity})} />)}
		{ingredients.materials.map(material => <Fact key={material.materialId} label={materialName(material.materialId)} value={i18n.t("app:cooking.ingredientQuantity", {owned: material.playerHas, required: material.quantity})} />)}
	</>;
}

function recipeName(recipe: NonNullable<CookingSlot["recipe"]>): string {
	return recipe.isSecret ? i18n.t("app:cooking.secretRecipe") : i18n.t(`models:cooking.recipes.${recipe.id}`);
}

/** A recipe is cooked from its own entry, next to the ingredients it will consume. */
function RecipeSlot({slot, actions, expanded, onToggle}: {
	slot: CookingSlot; actions: CookingActions; expanded: boolean; onToggle: () => void;
}): ReactNode {
	const {recipe, slotIndex} = slot;
	if (!recipe) return <Note>{i18n.t("app:cooking.emptySlot", {slot: slotIndex + 1})}</Note>;
	return <ExpandableEntry
		label={recipeName(recipe)}
		{...recipe.canCraft ? {} : {caption: i18n.t("app:cooking.notReady")}}
		end={<Text style={sectionStyles.caption}>{formatNumber(recipe.level)}</Text>}
		dimmed={!recipe.canCraft}
		expanded={expanded}
		onToggle={onToggle}
	>
		<Fact label={i18n.t("app:cooking.recipeLevel")} value={formatNumber(recipe.level)} />
		<Ingredients ingredients={recipe.ingredients} />
		<ActionBanner
			icon={Check}
			label={i18n.t("app:cooking.craft")}
			pending={actions.pending}
			{...recipe.canCraft ? {} : {lock: {reason: i18n.t("app:cooking.notReady")}}}
			onPress={(): void => {
				onToggle();
				actions.submit(makeFromClientPacket(CookingCraftReq, {slotIndex, recipeId: recipe.id})).catch(console.error);
			}}
		/>
		{!recipe.isSecret ? <ButtonRow><Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingPinReq, {recipeId: recipe.id, fromIgnitedView: true}))}>{i18n.t("app:cooking.pin")}</Button></ButtonRow> : null}
	</ExpandableEntry>;
}

function PinnedRecipe({menu, actions}: {menu: CookingMenu; actions: CookingActions}): ReactNode {
	if (!menu.pinnedRecipe) return null;
	const {pinnedRecipe} = menu;
	return <>
		<SectionHeader>{i18n.t("app:cooking.pinned")}</SectionHeader>
		<ExpandableList><Fact label={i18n.t(`models:cooking.recipes.${pinnedRecipe.recipeId}`)} value={formatNumber(pinnedRecipe.level)} /><Ingredients ingredients={pinnedRecipe.ingredients} /></ExpandableList>
		<ButtonRow><Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingUnpinReq, {fromIgnitedView: menu.isIgnited}))}>{i18n.t("app:cooking.unpin")}</Button></ButtonRow>
	</>;
}

/** Reviving burns wood, so it says so before being pressed instead of asking afterwards. */
function FurnaceActions({isIgnited, actions}: {isIgnited: boolean; actions: CookingActions}): ReactNode {
	const [revive, setRevive] = useState(false);
	if (!isIgnited) {
		return <ButtonRow><Button variant="primary" disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingIgniteReq, {}))}>{i18n.t("app:cooking.ignite")}</Button></ButtonRow>;
	}
	return <ExpandableList><ExpandableEntry
		label={i18n.t("app:cooking.revive")}
		caption={i18n.t("app:cooking.confirmRevive")}
		dimmed={actions.pending}
		expanded={revive}
		onToggle={(): void => setRevive(!revive)}
	>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:cooking.revive")}
			pending={actions.pending}
			onPress={(): void => {
				setRevive(false);
				actions.submit(makeFromClientPacket(CookingReviveReq, {})).catch(console.error);
			}}
		/>
	</ExpandableEntry></ExpandableList>;
}

/** The furnace asks the player whether a rare wood may burn: both answers are a real reply to Core. */
function WoodConfirmation({outcome, actions}: {outcome: CookingOutcome | null; actions: CookingActions}): ReactNode {
	if (outcome?.kind !== "woodConfirmation") return null;
	const confirm = (accepted: boolean): Promise<void> => actions.submit(makeFromClientPacket(CookingWoodConfirmReq, {accepted}));
	return <>
		<SectionHeader>{i18n.t("app:cooking.rareWood")}</SectionHeader>
		<Note>{i18n.t("app:cooking.confirmWood", {material: i18n.t(`models:materials.${outcome.woodMaterialId}`), rarity: i18n.t(`items:raritiesWithoutEmote.${outcome.woodRarity}`)})}</Note>
		<ButtonRow>
			<Button variant="primary" disabled={actions.pending} onPress={(): Promise<void> => confirm(true)}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={actions.pending} onPress={(): Promise<void> => confirm(false)}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</>;
}

function CookingContent({menu}: {menu: CookingMenu}): ReactNode {
	const actions = useCookingActions();
	const [openSlot, setOpenSlot] = useState<number>();
	return <>
		<ExpandableList><Fact label={i18n.t("app:cooking.level")} value={formatNumber(menu.cookingLevel)} /><Fact label={i18n.t("app:cooking.grade")} value={i18n.t(`models:cooking.grades.${menu.cookingGrade}`)} /><Fact label={i18n.t("app:cooking.furnace")} value={i18n.t(menu.isIgnited ? "app:cooking.lit" : "app:cooking.unlit")} /></ExpandableList>
		{actions.message ? <Note>{actions.message}</Note> : null}
		<HomeCookingResults outcome={actions.outcome} />
		<PinnedRecipe menu={menu} actions={actions} />
		<ExpandableList>{menu.currentSlots.map(slot => <RecipeSlot
			key={slot.slotIndex}
			slot={slot}
			actions={actions}
			expanded={openSlot === slot.slotIndex}
			onToggle={(): void => setOpenSlot(openSlot === slot.slotIndex ? undefined : slot.slotIndex)}
		/>)}</ExpandableList>
		<FurnaceActions isIgnited={menu.isIgnited} actions={actions} />
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
