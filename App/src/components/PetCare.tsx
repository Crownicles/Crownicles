import {ReactNode} from "react";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {PetFeedReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetFeedRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PetExpeditionReq} from "ws-packets/src/fromClient/PetExpeditionReq";
import {PetExpeditionErrorRes, PetExpeditionRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {usePetActions} from "@/src/store/usePetActions";
import {usePetPatience} from "@/src/store/usePetPatience";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {FightGauge} from "@/src/components/FightGauge";
import {PetCaress} from "@/src/components/PetReaction";
import {PET_MANAGEMENT_MENUS} from "@/src/components/PetManagement";
import {Button, ButtonRow, Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Lock, LockHint, Standing} from "@/src/design/Sections";
import {Clock3, Flag, LogOut, Utensils} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {petMood, petName, petRarity, petSex, petTypeName} from "@/src/display/PetDisplay";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

export type PetPage = "rename" | "sell";

const FEED_MENU: CommandMenu = {request: PetFeedReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetFeedRes]};
const EXPEDITION_MENU: CommandMenu = {request: PetExpeditionReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetExpeditionRes, PetExpeditionErrorRes]};

/** The moral ladder Core walks a pet up, from feisty to trained. */
const MOOD_STEPS = 5;
const PET_EMBLEM_SIZE = 40;

function PetStanding({pet, strokes, hadEnough}: {pet: OwnedPet; strokes: number; hadEnough: boolean}): ReactNode {
	return <Standing
		testID="pet-standing"
		emblem={<PetCaress pet={pet} size={PET_EMBLEM_SIZE} strokes={strokes} hadEnough={hadEnough} />}
		caption={i18n.t("app:pet.eyebrow")}
		title={petName(pet)}
		subtitle={`${petTypeName(pet)} · ${petRarity(pet)} · ${petSex(pet)}`}
	>
		<FightGauge label={petMood(pet)} value={pet.loveLevel} max={MOOD_STEPS} color={Theme.colors.gold} />
	</Standing>;
}

/** The pet screen in one glance: who it is, the single thing to do with it, then everything else. */
export function PetOverview({packet, onPage}: {packet: PetRes; onPage: (page: PetPage) => void}): ReactNode {
	const pet = packet.pet;
	const expedition = packet.expeditionInProgress;
	const {pending, message, care} = usePetActions();
	const menus = useCommandMenus();
	const patience = usePetPatience();
	useGameDeadline(GAME_ENTITIES.PET, expedition?.endTime ?? null);
	const noTalisman: Lock | undefined = packet.hasTalisman ? undefined : {reason: i18n.t("app:expedition.errors.noTalisman")};
	const openExpedition = (): void => {
		menus.open(EXPEDITION_MENU).catch(console.error);
	};
	return <>
		<PetStanding pet={pet} strokes={patience.strokes} hadEnough={patience.hadEnough} />
		{message ? <Note>{message}</Note> : null}
		{menus.message ? <Note>{menus.message}</Note> : null}
		{expedition
			? <ActionBanner
				icon={Flag}
				label={i18n.t("app:expedition.titles.expeditionProgress")}
				pending={menus.pending}
				onPress={openExpedition}
			/>
			: <ActionBanner
				icon={Utensils}
				label={i18n.t("app:pet.care.feedPet", {pet: petName(pet)})}
				pending={menus.pending}
				onPress={(): void => {
					menus.open(FEED_MENU).catch(console.error);
				}}
			/>}
		{expedition ? <Note>{i18n.t("app:expedition.overview", {date: missionDate(expedition.endTime)})}</Note> : null}
		<QuickActions>
			{expedition ? null : <QuickAction icon={AppIcons.getIcon("petCommand.pet")} disabled={pending || patience.hadEnough} onPress={(): void => {
				care({type: "caress"}).then(petted => {
					if (petted) patience.stroke();
				}).catch(console.error);
			}}>{i18n.t("app:pet.care.caress")}</QuickAction>}
			{expedition ? null : <QuickAction icon={AppIcons.getIcon("commands.map")} disabled={menus.pending || Boolean(noTalisman)} onPress={openExpedition}>{i18n.t("app:expedition.open")}</QuickAction>}
			<QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={(): void => onPage("rename")}>{i18n.t("app:pet.care.rename")}</QuickAction>
			<QuickAction icon={AppIcons.getIcon("unitValues.money")} onPress={(): void => onPage("sell")}>{i18n.t("app:pet.sale.title")}</QuickAction>
		</QuickActions>
		{noTalisman && !expedition ? <LockHint lock={noTalisman} testID="pet-expedition-lock" /> : null}
		{patience.hadEnough ? <LockHint lock={{reason: i18n.t("app:pet.care.enough", {pet: petName(pet)}), icon: Clock3}} testID="pet-caress-lock" /> : null}
		<SectionHeader>{i18n.t("app:pet.management.title")}</SectionHeader>
		<Note>{i18n.t("app:pet.management.irreversible")}</Note>
		<ButtonRow><Button variant="danger" icon={LogOut} disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.FREE)}>{i18n.t("app:pet.management.free")}</Button></ButtonRow>
	</>;
}
