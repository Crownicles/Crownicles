import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildShelterReq, PetTransferReq, PetFreeReq} from "ws-packets/src/fromClient/PetManagementReq";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {GuildShelterRes, GuildShelterEmptyRes, PetManagementRes} from "ws-packets/src/fromServer/pet/PetManagementRes";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {PET_MANAGEMENT_DATA_KINDS, PET_MANAGEMENT_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState, Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, ExpandableList, Lock, sectionStyles, Standing} from "@/src/design/Sections";
import {ArrowRight} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {petIcon, petMood, petName, petRarity} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

export const PET_MANAGEMENT_MENUS = {
	TRANSFER: {request: PetTransferReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]},
	FREE: {request: PetFreeReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetManagementRes]}
} satisfies Record<string, CommandMenu>;

/** What the player pressed, before the server says which reaction carries it out. */
type Transfer = {kind: "deposit"} | {kind: "boarder"; slot: number; pet: OwnedPet};

/** The shelter list carries no identifier, so a boarder is only acted upon while it still matches. */
function samePet(displayed: OwnedPet, fresh: OwnedPet): boolean {
	return displayed.typeId === fresh.typeId
		&& displayed.rarity === fresh.rarity
		&& displayed.sex === fresh.sex
		&& displayed.nickname === fresh.nickname;
}

/** The reaction to answer with, or nothing when the shelter moved and the player must choose again. */
function transferReaction(collector: ReactionCollectorCreation, transfer: Transfer): number | null {
	if (collector.data.type !== PET_MANAGEMENT_DATA_KINDS.TRANSFER) return null;
	if (transfer.kind === "deposit") {
		const deposit = collector.reactions.findIndex(reaction => reaction.type === PET_MANAGEMENT_REACTION_KINDS.DEPOSIT);
		return deposit < 0 ? null : deposit;
	}
	const boarder = collector.data.data.shelterPets[transfer.slot];
	if (!boarder || !samePet(transfer.pet, boarder.pet)) return null;
	const taken = collector.reactions.findIndex(reaction =>
		(reaction.type === PET_MANAGEMENT_REACTION_KINDS.WITHDRAW || reaction.type === PET_MANAGEMENT_REACTION_KINDS.SWITCH)
		&& reaction.data.petEntityId === boarder.petEntityId);
	return taken < 0 ? null : taken;
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

/** The shelter and the transfers it allows on one screen: a pet is moved from where it is shown. */
function ShelterContent({ownPet, boarders, guildName, maxCount}: ShelterProps): ReactNode {
	const [expanded, setExpanded] = useState<string | undefined>(undefined);
	const {pending, message, open} = useCommandMenus();
	const shelterIcon = AppIcons.getIconOrNull("city.guildDomain.shelter");
	const occupancy = maxCount === undefined
		? String(boarders.length)
		: i18n.t("app:profile.formats.progress", {value: boarders.length, max: maxCount});
	const full: Lock | undefined = maxCount !== undefined && boarders.length >= maxCount
		? {reason: i18n.t("app:pet.management.shelterFull")}
		: undefined;
	const toggle = (key: string): void => setExpanded(previous => previous === key ? undefined : key);
	const transfer = (target: Transfer): void => {
		open(PET_MANAGEMENT_MENUS.TRANSFER, undefined, collector => transferReaction(collector, target)).catch(console.error);
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
		{ownPet
			? <ExpandableList><PetEntry
				pet={ownPet}
				expanded={expanded === "own"}
				onToggle={(): void => toggle("own")}
				testID="shelter-own-pet"
				action={<ActionBanner
					icon={ArrowRight}
					label={i18n.t("app:pet.management.deposit", {pet: petName(ownPet)})}
					pending={pending}
					{...full ? {lock: full} : {}}
					onPress={(): void => transfer({kind: "deposit"})}
					testID="shelter-deposit"
				/>}
			/></ExpandableList>
			: <Panel><EmptyState>{i18n.t("app:pet.management.noOwnPet")}</EmptyState></Panel>}
		<SectionHeader action={{hint: occupancy}}>{i18n.t("app:pet.management.boardersTitle")}</SectionHeader>
		{boarders.length
			? <ExpandableList>{boarders.map((pet, slot) => <PetEntry
				key={slot}
				pet={pet}
				expanded={expanded === `boarder-${slot}`}
				onToggle={(): void => toggle(`boarder-${slot}`)}
				testID={`shelter-boarder-${slot}`}
				action={<ActionBanner
					icon={ArrowRight}
					label={i18n.t(ownPet ? "app:pet.management.switch" : "app:pet.management.withdraw", {pet: petName(pet)})}
					pending={pending}
					onPress={(): void => transfer({kind: "boarder", slot, pet})}
					testID={`shelter-take-${slot}`}
				/>}
			/>)}</ExpandableList>
			: <Panel><EmptyState>{i18n.t("app:pet.management.emptyShelter")}</EmptyState></Panel>}
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
