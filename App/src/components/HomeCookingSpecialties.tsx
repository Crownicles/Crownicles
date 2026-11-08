import {
	ReactNode, useState
} from "react";
import { Text } from "react-native";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import { CookingRemoveSpecialtyReq } from "ws-packets/src/fromClient/CookingReq";
import {
	CookingMenu, CookingSpecialty
} from "ws-packets/src/objects/Cooking";
import { CookingSubmit } from "@/src/store/useCookingActions";
import {
	Button, ButtonRow, Note, SectionHeader
} from "@/src/design/Primitives";
import {
	ExpandableEntry, ExpandableList, useSectionStyles
} from "@/src/design/Sections";
import {
	recipeName, specialtyStationIcon, specialtyStationName
} from "@/src/display/CookingDisplay";
import { i18n } from "@/src/translations/i18n";

/** A specialty is let go from its own entry; Core offers the next one on the station in its place. */
function SpecialtyEntry({
	specialty, menu, actions, expanded, onToggle
}: {
	specialty: CookingSpecialty; menu: CookingMenu; actions: CookingSubmit; expanded: boolean; onToggle: () => void;
}): ReactNode {
	const sectionStyles = useSectionStyles();
	return <ExpandableEntry
		label={recipeName(specialty.recipeId)}
		{...specialty.canCraft ? { caption: i18n.t("app:cooking.specialties.ready") } : {}}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:cooking.recipeLevelShort", { level: specialty.level })}</Text>}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ButtonRow><Button disabled={actions.pending} onPress={(): void => {
			onToggle();
			actions.submit(makeFromClientPacket(CookingRemoveSpecialtyReq, {
				recipeId: specialty.recipeId, fromIgnitedView: menu.isIgnited
			})).catch(console.error);
		}}>{i18n.t("app:cooking.specialties.remove")}</Button></ButtonRow>
	</ExpandableEntry>;
}

/**
 * The recipes an experienced cook keeps at hand, as many as their level allows: they are chosen among the
 * recipes of the lit furnace, and the next unlock is told in advance.
 */
export function CookingSpecialties({
	menu, actions
}: {
	menu: CookingMenu; actions: CookingSubmit;
}): ReactNode {
	const [open, setOpen] = useState<string>();
	const {
		specialtyLimit, nextSpecialtyLevel
	} = menu.rules;
	if (specialtyLimit === 0) {
		return null;
	}
	const specialties = menu.specialties ?? [];
	const icon = specialtyStationIcon(menu);
	return <>
		<SectionHeader {...icon ? { icon } : {}} action={{ hint: i18n.t("app:profile.formats.progress", {
			value: specialties.length, max: specialtyLimit
		}) }}>{i18n.t("app:cooking.specialties.title")}</SectionHeader>
		{specialties.length === 0
			? <Note>{i18n.t("app:cooking.specialties.none", {
				count: specialtyLimit, station: specialtyStationName(menu)
			})}</Note>
			: <ExpandableList>{specialties.map(specialty => <SpecialtyEntry
				key={specialty.recipeId}
				specialty={specialty}
				menu={menu}
				actions={actions}
				expanded={open === specialty.recipeId}
				onToggle={(): void => setOpen(open === specialty.recipeId ? undefined : specialty.recipeId)}
			/>)}</ExpandableList>}
		{nextSpecialtyLevel === undefined ? null : <Note>{i18n.t("app:cooking.specialties.nextUnlock", { level: nextSpecialtyLevel })}</Note>}
	</>;
}
