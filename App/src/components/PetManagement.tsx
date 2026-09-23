import {ReactNode} from "react";
import {Text} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildShelterReq, PetTransferReq, PetFreeReq} from "ws-packets/src/fromClient/PetManagementReq";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {GuildShelterRes, GuildShelterEmptyRes, PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PET_MANAGEMENT_DATA_KINDS, PET_MANAGEMENT_REACTION_KINDS, ReactionCollectorDataOf} from "ws-packets/src/fromServer/collectors";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Lock, sectionStyles, Standing} from "@/src/design/Sections";
import {ArrowRight} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
import {AppIcons} from "@/src/AppIcons";
import {petIcon, petMood, petName, petRarity} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

export const PET_MANAGEMENT_MENUS = {
	TRANSFER: {request: PetTransferReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]},
	FREE: {request: PetFreeReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]}
} satisfies Record<string, CommandMenu>;

/** What the player pressed, before the server says which reaction carries it out. */
type Transfer = {kind: "deposit"} | {kind: "boarder"; slot: number; pet: OwnedPet};

type TransferData = ReactionCollectorDataOf<typeof PET_MANAGEMENT_DATA_KINDS.TRANSFER>["data"];

/** The shelter list carries no identifier, so a boarder is only acted upon while it still matches. */
function petSignature(pet: OwnedPet): string {
	return JSON.stringify([pet.typeId, pet.rarity, pet.sex, pet.nickname]);
}

function reactionOrNull(index: number): number | null {
	return index < 0 ? null : index;
}

function takesBoarder(reaction: ReactionCollectorCreation["reactions"][number], petEntityId: number): boolean {
	return (reaction.type === PET_MANAGEMENT_REACTION_KINDS.WITHDRAW || reaction.type === PET_MANAGEMENT_REACTION_KINDS.SWITCH)
		&& reaction.data.petEntityId === petEntityId;
}

function boarderReaction(collector: ReactionCollectorCreation, shelter: TransferData, transfer: Extract<Transfer, {kind: "boarder"}>): number | null {
	const boarder = shelter.shelterPets[transfer.slot];
	if (!boarder || petSignature(transfer.pet) !== petSignature(boarder.pet)) return null;
	return reactionOrNull(collector.reactions.findIndex(reaction => takesBoarder(reaction, boarder.petEntityId)));
}

/** The reaction to answer with, or nothing when the shelter moved and the player must choose again. */
function transferReaction(collector: ReactionCollectorCreation, transfer: Transfer): number | null {
	if (collector.data.type !== PET_MANAGEMENT_DATA_KINDS.TRANSFER) return null;
	return transfer.kind === "deposit"
		? reactionOrNull(collector.reactions.findIndex(reaction => reaction.type === PET_MANAGEMENT_REACTION_KINDS.DEPOSIT))
		: boarderReaction(collector, collector.data.data, transfer);
}

function PetEntry({pet, action, expanded, onToggle, testID}: {
	pet: OwnedPet;
	action: ReactNode;
	expanded: boolean;
	onToggle: () => void;
	testID: string;
}): ReactNode {
	return <ExpandableEntry
		emblem={<TwemojiIcon emoji={petIcon(pet)} size={26} />}
		label={petName(pet)}
		caption={`${petRarity(pet)} · ${petMood(pet)}`}
		expanded={expanded}
		onToggle={onToggle}
		testID={testID}
	>{action}</ExpandableEntry>;
}

type ShelterProps = {ownPet?: OwnedPet; boarders: OwnedPet[]; guildName?: string; maxCount?: number};

/** What the shelter rows share: which one is unfolded, and how a pet is moved from there. */
type ShelterActions = {unfolding: ExpandedEntry<string>; pending: boolean; transfer: (target: Transfer) => void};

function shelterLock({boarders, maxCount}: ShelterProps): Lock | undefined {
	return maxCount !== undefined && boarders.length >= maxCount
		? {reason: i18n.t("app:pet.management.shelterFull")}
		: undefined;
}

function OwnPetSection({ownPet, full, actions}: {ownPet?: OwnedPet; full?: Lock; actions: ShelterActions}): ReactNode {
	if (!ownPet) return <ExpandableList><EmptyState>{i18n.t("app:pet.management.noOwnPet")}</EmptyState></ExpandableList>;
	return <ExpandableList><PetEntry
		pet={ownPet}
		expanded={actions.unfolding.isExpanded("own")}
		onToggle={(): void => actions.unfolding.toggle("own")}
		testID="shelter-own-pet"
		action={<ActionBanner
			icon={ArrowRight}
			label={i18n.t("app:pet.management.deposit", {pet: petName(ownPet)})}
			pending={actions.pending}
			{...full ? {lock: full} : {}}
			onPress={(): void => actions.transfer({kind: "deposit"})}
			testID="shelter-deposit"
		/>}
	/></ExpandableList>;
}

function BoardersSection({boarders, hasOwnPet, actions}: {boarders: OwnedPet[]; hasOwnPet: boolean; actions: ShelterActions}): ReactNode {
	if (!boarders.length) return <ExpandableList><EmptyState>{i18n.t("app:pet.management.emptyShelter")}</EmptyState></ExpandableList>;
	// The shelter list carries no identifier: a boarder is known by its slot.
	const slots = boarders.map((pet, slot) => ({pet, slot}));
	return <ExpandableList>{slots.map(({pet, slot}) => <PetEntry
		key={slot}
		pet={pet}
		expanded={actions.unfolding.isExpanded(`boarder-${slot}`)}
		onToggle={(): void => actions.unfolding.toggle(`boarder-${slot}`)}
		testID={`shelter-boarder-${slot}`}
		action={<ActionBanner
			icon={ArrowRight}
			label={i18n.t(hasOwnPet ? "app:pet.management.switch" : "app:pet.management.withdraw", {pet: petName(pet)})}
			pending={actions.pending}
			onPress={(): void => actions.transfer({kind: "boarder", slot, pet})}
			testID={`shelter-take-${slot}`}
		/>}
	/>)}</ExpandableList>;
}

/** The shelter and the transfers it allows on one screen: a pet is moved from where it is shown. */
function ShelterContent(props: ShelterProps): ReactNode {
	const {ownPet, boarders, guildName, maxCount} = props;
	const unfolding = useExpandedEntry<string>();
	const {pending, message, open} = useCommandMenus();
	const shelterIcon = AppIcons.getIconOrNull("city.guildDomain.shelter");
	const occupancy = maxCount === undefined
		? String(boarders.length)
		: i18n.t("app:profile.formats.progress", {value: boarders.length, max: maxCount});
	const full = shelterLock(props);
	const actions: ShelterActions = {
		unfolding,
		pending,
		transfer: (target: Transfer): void => {
			open(PET_MANAGEMENT_MENUS.TRANSFER, undefined, collector => transferReaction(collector, target)).catch(console.error);
		}
	};
	return <>
		<Standing
			testID="shelter-standing"
			emblem={shelterIcon ? <TwemojiIcon emoji={shelterIcon} size={40} /> : null}
			caption={i18n.t("app:pet.management.shelter")}
			title={guildName ?? i18n.t("app:guild.eyebrow")}
			subtitle={i18n.t("app:pet.management.boarders", {count: boarders.length})}
		/>
		{message ? <Note>{message}</Note> : null}
		<SectionHeader first>{i18n.t("app:pet.management.ownPet")}</SectionHeader>
		<OwnPetSection {...ownPet ? {ownPet} : {}} {...full ? {full} : {}} actions={actions} />
		<SectionHeader action={{hint: occupancy}}>{i18n.t("app:pet.management.boardersTitle")}</SectionHeader>
		<BoardersSection boarders={boarders} hasOwnPet={ownPet !== undefined} actions={actions} />
		<Text style={sectionStyles.caption}>{i18n.t("app:pet.management.transferHint")}</Text>
	</>;
}

export function GuildShelter(): ReactNode {
	const shelter = useGameQuery(GAME_ENTITIES.SHELTER, () => GameClient.request(makeFromClientPacket(GuildShelterReq, {}), GuildShelterRes, [GuildShelterEmptyRes]));
	const own = useGameQuery(GAME_ENTITIES.PET, () => GameClient.request(makeFromClientPacket(PetReq, {askedPlayer: {}}), PetRes, [PetNotFound]));
	const ownPet = own.status === "ready" ? {ownPet: own.data.pet} : {};
	if (shelter.status === "empty") return <ShelterContent {...ownPet} boarders={[]} />;
	return <GameQueryContent state={shelter} entity={GAME_ENTITIES.SHELTER}>{data => <ShelterContent
		{...ownPet}
		boarders={data.pets}
		guildName={data.guildName}
		maxCount={data.maxCount}
	/>}</GameQueryContent>;
}
