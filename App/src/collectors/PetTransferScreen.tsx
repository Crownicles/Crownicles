import {ReactNode} from "react";
import {Text, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_MANAGEMENT_DATA_KINDS, PET_MANAGEMENT_REACTION_KINDS, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {ShelterChoices} from "ws-packets/src/objects/PetManagement";
import {Button, ButtonRow, EmptyState, Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList, sectionStyles, Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {petIcon, petMood, petName, petRarity} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

type Choice = {index: number; reaction: ReactionCollectorReaction; pet?: OwnedPet};

/** The pet each choice acts upon, so a row can wear its face instead of a bare sentence. */
function transferChoices(collector: ReactionCollectorCreation, shelter: ShelterChoices): Choice[] {
	return collector.reactions
		.map((reaction, index) => ({index, reaction}))
		.filter(choice => choice.reaction.type !== GENERIC_REACTION_KINDS.REFUSE)
		.map(choice => {
			const pet = choice.reaction.type === PET_MANAGEMENT_REACTION_KINDS.DEPOSIT
				? shelter.ownPet
				: shelter.shelterPets.find(entry => entry.petEntityId === (choice.reaction.data as {petEntityId: number}).petEntityId)?.pet;
			return pet ? {...choice, pet} : choice;
		});
}

function choiceLabel(choice: Choice): string {
	const pet = choice.pet ? petName(choice.pet) : i18n.t("app:collector.unknownChoice");
	return i18n.t(`app:pet.management.${choice.reaction.type === PET_MANAGEMENT_REACTION_KINDS.DEPOSIT ? "deposit" : choice.reaction.type === PET_MANAGEMENT_REACTION_KINDS.WITHDRAW ? "withdraw" : "switch"}`, {pet});
}

function ChoiceEntry({choice, expanded, locked, onToggle, onConfirm}: {
	choice: Choice;
	expanded: boolean;
	locked: boolean;
	onToggle: (index: number) => void;
	onConfirm: (index: number) => void;
}): ReactNode {
	return <ExpandableEntry
		emblem={choice.pet ? <TwemojiIcon emoji={petIcon(choice.pet)} size={26} /> : null}
		label={choiceLabel(choice)}
		{...choice.pet ? {caption: `${petRarity(choice.pet)} · ${petMood(choice.pet)}`} : {}}
		expanded={expanded}
		onToggle={(): void => onToggle(choice.index)}
	>
		<ButtonRow><Button variant="primary" disabled={locked} onPress={(): void => onConfirm(choice.index)}>{i18n.t("app:pet.management.confirmTransfer")}</Button></ButtonRow>
	</ExpandableEntry>;
}

export function PetTransferScreen({collector, locked, onChoose, onClose}: {
	collector: ReactionCollectorCreation;
	locked: boolean;
	onChoose: (index: number) => void;
	onClose: () => void;
}): ReactNode {
	const {isExpanded, toggle} = useExpandedEntry<number>();
	if (collector.data.type !== PET_MANAGEMENT_DATA_KINDS.TRANSFER) return null;
	const shelter = collector.data.data;
	const choices = transferChoices(collector, shelter);
	const shelterIcon = AppIcons.getIconOrNull("city.guildDomain.shelter");
	return <Screen>
		<Standing
			testID="pet-transfer-standing"
			emblem={shelter.ownPet ? <TwemojiIcon emoji={petIcon(shelter.ownPet)} size={40} /> : shelterIcon ? <TwemojiIcon emoji={shelterIcon} size={40} /> : null}
			caption={i18n.t("app:pet.management.transfer")}
			title={shelter.ownPet ? petName(shelter.ownPet) : i18n.t("app:pet.management.noOwnPet")}
			subtitle={i18n.t("app:pet.management.boarders", {count: shelter.shelterPets.length})}
		>
			{shelter.ownPet ? <Text style={sectionStyles.caption}>{petRarity(shelter.ownPet)} · {petMood(shelter.ownPet)}</Text> : null}
		</Standing>
		<SectionHeader>{i18n.t("app:pet.management.shelter")}</SectionHeader>
		{choices.length ? <ExpandableList>{choices.map(choice => <ChoiceEntry
			key={choice.index}
			choice={choice}
			expanded={isExpanded(choice.index)}
			locked={locked}
			onToggle={toggle}
			onConfirm={onChoose}
		/>)}</ExpandableList> : <View><EmptyState>{i18n.t("app:pet.management.emptyShelter")}</EmptyState></View>}
		<Note>{i18n.t("app:pet.management.transferHint")}</Note>
		<ButtonRow><Button onPress={onClose}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Screen>;
}
