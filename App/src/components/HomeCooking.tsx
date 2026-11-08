import {
	ReactNode, useState
} from "react";
import {
	Text, View
} from "react-native";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import {
	CookingMenuReq, CookingIgniteReq, CookingReviveReq, CookingWoodConfirmReq, CookingCraftReq, CookingPinReq, CookingUnpinReq, CookingSetSpecialtyReq
} from "ws-packets/src/fromClient/CookingReq";
import { CookingRes } from "ws-packets/src/fromServer/home/CookingRes";
import {
	CookingMenu, CookingSlot, RecipeIngredients, CookingOutcome
} from "ws-packets/src/objects/Cooking";
import { GameClient } from "@/src/networking/GameClient";
import { GAME_ENTITIES } from "@/src/store/GameEntities";
import { useGameQuery } from "@/src/store/useGameQuery";
import {
	CookingSubmit, cookingMenuFromOutcome, useCookingActions
} from "@/src/store/useCookingActions";
import { GameQueryContent } from "@/src/components/GameQueryContent";
import { HomeCookingResults } from "@/src/components/HomeCookingResults";
import { CookingSpecialties } from "@/src/components/HomeCookingSpecialties";
import {
	Button, ButtonRow, Note, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, ExpandableEntry, ExpandableList, Fact, Figures, Gauge, Lock, LockHint, useSectionStyles
} from "@/src/design/Sections";
import {
	Check, Flame
} from "@/src/design/FightIcons";
import { Theme } from "@/src/design/Theme";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";
import { formatNumber } from "@/src/display/Amounts";
import {
	materialName, plantName
} from "@/src/display/Resources";
import {
	isSpecialtyStation, recipeName, SlotRecipe, specialtyRotation, specialtyStationIcon, specialtyStationName, timePotionsNotice
} from "@/src/display/CookingDisplay";
import { i18n } from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	ingredients: {
		borderRadius: Theme.radius, backgroundColor: colors.wash, overflow: "hidden"
	}
}));

type Ingredient = {
	label: string; playerHas: number; quantity: number;
};

function ingredientList(ingredients: RecipeIngredients): Ingredient[] {
	return [
		...ingredients.plants.map(plant => ({
			label: plantName(plant.plantId), playerHas: plant.playerHas, quantity: plant.quantity
		})),
		...ingredients.materials.map(material => ({
			label: materialName(material.materialId), playerHas: material.playerHas, quantity: material.quantity
		}))
	];
}

/** Each ingredient as a bar filling up to what the recipe asks: green when the pantry holds enough, red for what is missing. */
function Ingredients({ ingredients }: { ingredients: RecipeIngredients }): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const list = ingredientList(ingredients);
	if (list.length === 0) {
		return null;
	}
	return <View style={styles.ingredients}>
		{list.map(ingredient => <Gauge
			key={ingredient.label}
			label={ingredient.label}
			value={i18n.t("app:cooking.ingredientQuantity", {
				owned: ingredient.playerHas, required: ingredient.quantity
			})}
			ratio={ingredient.quantity > 0 ? ingredient.playerHas / ingredient.quantity : 1}
			color={ingredient.playerHas >= ingredient.quantity ? colors.green : colors.red}
		/>)}
	</View>;
}

/** Why a recipe cannot be cooked yet, as precisely as the menu allows. */
function recipeLock(recipe: SlotRecipe, isIgnited: boolean): string | undefined {
	if (recipe.canCraft) {
		return undefined;
	}
	if (!isIgnited) {
		return i18n.t("app:cooking.locks.unlit");
	}
	if (recipe.timePotionsLeftThisWeek === 0) {
		return i18n.t("app:cooking.locks.timePotionsExhausted");
	}
	return ingredientList(recipe.ingredients).some(ingredient => ingredient.playerHas < ingredient.quantity)
		? i18n.t("app:cooking.locks.missingIngredients")
		: i18n.t("app:cooking.notReady");
}

function slotRecipeName(recipe: SlotRecipe): string {
	return recipe.isSecret ? i18n.t("app:cooking.secretRecipe") : recipeName(recipe.id);
}

/** A full set of specialties is said under the button that would add one more. */
function specialtyChoiceLock(menu: CookingMenu): Lock | undefined {
	const limit = menu.rules.specialtyLimit;
	return (menu.specialties?.length ?? 0) >= limit
		? { reason: i18n.t("app:cooking.specialties.full", { count: limit }) }
		: undefined;
}

/**
 * What else a recipe of a rotating station offers: keeping it in sight, or making it a specialty. A time potion
 * out of reach until next week is not worth pinning.
 */
function RecipeOptions({
	slot, recipe, menu, actions, onToggle
}: {
	slot: CookingSlot; recipe: SlotRecipe; menu: CookingMenu; actions: CookingSubmit; onToggle: () => void;
}): ReactNode {
	const pinnable = recipe.timePotionsLeftThisWeek !== 0;
	const specialtiesUnlocked = menu.rules.specialtyLimit > 0;
	if (recipe.isSecret || isSpecialtyStation(slot, menu) || !pinnable && !specialtiesUnlocked) {
		return null;
	}
	const specialtyLock = specialtiesUnlocked ? specialtyChoiceLock(menu) : undefined;
	return <>
		<ButtonRow>
			{pinnable
				? <Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingPinReq, {
					recipeId: recipe.id, fromIgnitedView: true
				}))}>{i18n.t("app:cooking.pin")}</Button>
				: null}
			{specialtiesUnlocked
				? <Button disabled={actions.pending || specialtyLock !== undefined} onPress={(): void => {
					onToggle();
					actions.submit(makeFromClientPacket(CookingSetSpecialtyReq, {
						slotIndex: slot.slotIndex, recipeId: recipe.id
					})).catch(console.error);
				}}>{i18n.t("app:cooking.specialties.add")}</Button>
				: null}
		</ButtonRow>
		{specialtyLock ? <LockHint lock={specialtyLock} /> : null}
	</>;
}

/** A recipe is cooked from its own entry, next to the ingredients it will consume. */
function RecipeSlot({
	slot, menu, actions, expanded, onToggle
}: {
	slot: CookingSlot; menu: CookingMenu; actions: CookingSubmit; expanded: boolean; onToggle: () => void;
}): ReactNode {
	const sectionStyles = useSectionStyles();
	const {
		recipe, slotIndex
	} = slot;
	if (!recipe) {
		return <Note>{i18n.t("app:cooking.emptySlot", { slot: slotIndex + 1 })}</Note>;
	}
	const lock = recipeLock(recipe, menu.isIgnited);
	const notice = timePotionsNotice(recipe, menu);
	const caption = lock ?? notice;
	return <ExpandableEntry
		label={slotRecipeName(recipe)}
		{...caption ? { caption } : {}}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:cooking.recipeLevelShort", { level: recipe.level })}</Text>}
		dimmed={!recipe.canCraft}
		expanded={expanded}
		onToggle={onToggle}
	>
		<Ingredients ingredients={recipe.ingredients} />
		{lock && notice ? <Note>{notice}</Note> : null}
		<ActionBanner
			icon={Check}
			label={i18n.t("app:cooking.craft")}
			pending={actions.pending}
			{...lock ? { lock: { reason: lock } } : {}}
			onPress={(): void => {
				onToggle();
				actions.submit(makeFromClientPacket(CookingCraftReq, {
					slotIndex, recipeId: recipe.id
				})).catch(console.error);
			}}
		/>
		<RecipeOptions slot={slot} recipe={recipe} menu={menu} actions={actions} onToggle={onToggle} />
	</ExpandableEntry>;
}

/** The station offering the chef's specialties, one per ignition, set apart from the rotating ones. */
function SpecialtyStation({
	slot, menu, children
}: {
	slot: CookingSlot; menu: CookingMenu; children: ReactNode;
}): ReactNode {
	const icon = specialtyStationIcon(menu);
	const rotation = specialtyRotation(slot, menu);
	return <>
		<SectionHeader {...icon ? { icon } : {}}>{specialtyStationName(menu)}</SectionHeader>
		<ExpandableList>{children}</ExpandableList>
		{rotation ? <Note>{rotation}</Note> : null}
	</>;
}

function PinnedRecipe({
	menu, actions
}: {
	menu: CookingMenu; actions: CookingSubmit;
}): ReactNode {
	if (!menu.pinnedRecipe) {
		return null;
	}
	const { pinnedRecipe } = menu;
	return <>
		<SectionHeader>{i18n.t("app:cooking.pinned")}</SectionHeader>
		<ExpandableList><Fact label={i18n.t(`models:cooking.recipes.${pinnedRecipe.recipeId}`)} value={i18n.t("app:cooking.recipeLevelShort", { level: pinnedRecipe.level })} /></ExpandableList>
		<Ingredients ingredients={pinnedRecipe.ingredients} />
		<ButtonRow><Button disabled={actions.pending} onPress={(): Promise<void> => actions.submit(makeFromClientPacket(CookingUnpinReq, { fromIgnitedView: menu.isIgnited }))}>{i18n.t("app:cooking.unpin")}</Button></ButtonRow>
	</>;
}

/** Reviving burns wood, so it says so before being pressed instead of asking afterwards. */
function FurnaceActions({
	isIgnited, actions
}: {
	isIgnited: boolean; actions: CookingSubmit;
}): ReactNode {
	const [revive, setRevive] = useState(false);
	if (!isIgnited) {
		return <ActionBanner
			icon={Flame}
			label={i18n.t("app:cooking.ignite")}
			pending={actions.pending}
			onPress={(): void => {
				actions.submit(makeFromClientPacket(CookingIgniteReq, {})).catch(console.error);
			}}
		/>;
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
function WoodConfirmation({
	outcome, actions
}: {
	outcome: CookingOutcome | null; actions: CookingSubmit;
}): ReactNode {
	if (outcome?.kind !== "woodConfirmation") {
		return null;
	}
	const confirm = (accepted: boolean): Promise<void> => actions.submit(makeFromClientPacket(CookingWoodConfirmReq, { accepted }));
	return <>
		<SectionHeader>{i18n.t("app:cooking.rareWood")}</SectionHeader>
		<Note>{i18n.t("app:cooking.confirmWood", {
			material: i18n.t(`models:materials.${outcome.woodMaterialId}`), rarity: i18n.t(`items:raritiesWithoutEmote.${outcome.woodRarity}`)
		})}</Note>
		<ButtonRow>
			<Button variant="primary" disabled={actions.pending} onPress={(): Promise<void> => confirm(true)}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={actions.pending} onPress={(): Promise<void> => confirm(false)}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</>;
}

function CookingContent({ menu }: { menu: CookingMenu }): ReactNode {
	const actions = useCookingActions();
	const [openSlot, setOpenSlot] = useState<number>();
	const station = menu.currentSlots.find(slot => isSpecialtyStation(slot, menu));
	const slotEntry = (slot: CookingSlot): ReactNode => <RecipeSlot
		key={slot.slotIndex}
		slot={slot}
		menu={menu}
		actions={actions}
		expanded={openSlot === slot.slotIndex}
		onToggle={(): void => setOpenSlot(openSlot === slot.slotIndex ? undefined : slot.slotIndex)}
	/>;
	return <>
		<Figures items={[
			{
				caption: i18n.t("app:cooking.level"), value: formatNumber(menu.cookingLevel)
			},
			{
				caption: i18n.t("app:cooking.grade"), value: i18n.t(`models:cooking.grades.${menu.cookingGrade}`)
			},
			{
				caption: i18n.t("app:cooking.furnace"), value: i18n.t(menu.isIgnited ? "app:cooking.lit" : "app:cooking.unlit")
			}
		]} />
		{actions.message ? <Note>{actions.message}</Note> : null}
		<HomeCookingResults outcome={actions.outcome} />
		<PinnedRecipe menu={menu} actions={actions} />
		<ExpandableList>{menu.currentSlots.filter(slot => !isSpecialtyStation(slot, menu)).map(slotEntry)}</ExpandableList>
		{station ? <SpecialtyStation slot={station} menu={menu}>{slotEntry(station)}</SpecialtyStation> : null}
		<FurnaceActions isIgnited={menu.isIgnited} actions={actions} />
		<WoodConfirmation outcome={actions.outcome} actions={actions} />
		<CookingSpecialties menu={menu} actions={actions} />
	</>;
}

export function HomeCooking(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.COOKING, () => GameClient.request(makeFromClientPacket(CookingMenuReq, {}), CookingRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.COOKING}>{packet => {
		const menu = cookingMenuFromOutcome(packet.outcome);
		return menu ? <CookingContent menu={menu} /> : <Note>{i18n.t("app:cooking.unavailable")}</Note>;
	}}</GameQueryContent>;
}
