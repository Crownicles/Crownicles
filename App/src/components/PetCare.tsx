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
import {PetActions, usePetActions} from "@/src/store/usePetActions";
import {PetPatience, usePetPatience} from "@/src/store/usePetPatience";
import {CommandMenu, CommandMenuState, useCommandMenus} from "@/src/store/useInventoryMenus";
import {FightGauge} from "@/src/components/FightGauge";
import {PetCaress} from "@/src/components/PetReaction";
import {PET_MANAGEMENT_MENUS} from "@/src/components/PetManagement";
import {Button, ButtonRow, Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Lock, LockHint, Standing} from "@/src/design/Sections";
import {Clock3, Flag, Flame, Heart, HeartPulse, LogOut, LucideIcon, PawPrint, Utensils, Wind} from "@/src/design/FightIcons";
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

/** How each rung of that ladder reads at a glance, from a hostile pet to a devoted one. */
const MOOD_LOOKS: Record<number, {icon: LucideIcon; color: string}> = {
	1: {icon: Flame, color: Theme.colors.red},
	2: {icon: PawPrint, color: Theme.colors.red},
	3: {icon: Wind, color: Theme.colors.gold},
	4: {icon: Heart, color: Theme.colors.green},
	5: {icon: HeartPulse, color: Theme.colors.green}
};

function PetStanding({pet, strokes, hadEnough}: {pet: OwnedPet; strokes: number; hadEnough: boolean}): ReactNode {
	return <Standing
		testID="pet-standing"
		emblem={<PetCaress pet={pet} size={PET_EMBLEM_SIZE} strokes={strokes} hadEnough={hadEnough} />}
		caption={i18n.t("app:pet.eyebrow")}
		title={petName(pet)}
		subtitle={`${petTypeName(pet)} · ${petRarity(pet)} · ${petSex(pet)}`}
	>
		<FightGauge label={petMood(pet)} value={pet.loveLevel} max={MOOD_STEPS} {...MOOD_LOOKS[pet.loveLevel] ?? MOOD_LOOKS[MOOD_STEPS]} />
	</Standing>;
}

function feedLock(packet: PetRes): Lock | undefined {
	return packet.feedAvailableAt
		? {reason: i18n.t("app:pet.care.notHungryUntil", {pet: petName(packet.pet), date: missionDate(packet.feedAvailableAt)}), icon: Clock3}
		: undefined;
}

/** The single thing to do with the pet: follow its expedition, or else feed it. */
function PetMainAction({packet, menus, onExpedition}: {packet: PetRes; menus: CommandMenuState; onExpedition: () => void}): ReactNode {
	const expedition = packet.expeditionInProgress;
	if (expedition) {
		return <>
			<ActionBanner
				icon={Flag}
				label={i18n.t("app:expedition.titles.expeditionProgress")}
				pending={menus.pending}
				onPress={onExpedition}
			/>
			<Note>{i18n.t("app:expedition.overview", {date: missionDate(expedition.endTime)})}</Note>
		</>;
	}
	const notHungry = feedLock(packet);
	return <ActionBanner
		icon={Utensils}
		label={i18n.t("app:pet.care.feedPet", {pet: petName(packet.pet)})}
		pending={menus.pending}
		onPress={(): void => {
			menus.open(FEED_MENU).catch(console.error);
		}}
		{...notHungry ? {lock: notHungry} : {}}
	/>;
}

/** What can be done with a pet at home: caress it or send it away. On expedition, it is out of reach. */
function PetHomeActions({actions, patience, noTalisman, menus, onExpedition}: {
	actions: PetActions;
	patience: PetPatience;
	noTalisman: Lock | undefined;
	menus: CommandMenuState;
	onExpedition: () => void;
}): ReactNode {
	return <>
		<QuickAction icon={AppIcons.getIcon("petCommand.pet")} disabled={actions.pending || patience.hadEnough} onPress={(): void => {
			actions.care({type: "caress"}).then(petted => {
				if (petted) patience.stroke();
			}).catch(console.error);
		}}>{i18n.t("app:pet.care.caress")}</QuickAction>
		<QuickAction icon={AppIcons.getIcon("expedition.map")} disabled={menus.pending || Boolean(noTalisman)} onPress={onExpedition}>{i18n.t("app:expedition.open")}</QuickAction>
	</>;
}

/** Only a pet at home without an anchor talisman is kept from leaving on an expedition. */
function talismanLock(packet: PetRes): Lock | undefined {
	return packet.hasTalisman || packet.expeditionInProgress ? undefined : {reason: i18n.t("app:expedition.errors.noTalisman")};
}

function PetLocks({noTalisman, hadEnough, pet}: {noTalisman: Lock | undefined; hadEnough: boolean; pet: PetRes["pet"]}): ReactNode {
	return <>
		{noTalisman ? <LockHint lock={noTalisman} testID="pet-expedition-lock" /> : null}
		{hadEnough ? <LockHint lock={{reason: i18n.t("app:pet.care.enough", {pet: petName(pet)}), icon: Clock3}} testID="pet-caress-lock" /> : null}
	</>;
}

function PetRelease({menus}: {menus: CommandMenuState}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:pet.management.title")}</SectionHeader>
		<Note>{i18n.t("app:pet.management.irreversible")}</Note>
		<ButtonRow><Button variant="danger" icon={LogOut} disabled={menus.pending} onPress={(): Promise<void> => menus.open(PET_MANAGEMENT_MENUS.FREE)}>{i18n.t("app:pet.management.free")}</Button></ButtonRow>
	</>;
}

/** The pet screen in one glance: who it is, the single thing to do with it, then everything else. */
export function PetOverview({packet, onPage}: {packet: PetRes; onPage: (page: PetPage) => void}): ReactNode {
	const pet = packet.pet;
	const expedition = packet.expeditionInProgress;
	const actions = usePetActions();
	const menus = useCommandMenus();
	const patience = usePetPatience();
	useGameDeadline(GAME_ENTITIES.PET, expedition?.endTime ?? null);
	const noTalisman = talismanLock(packet);
	const openExpedition = (): void => {
		menus.open(EXPEDITION_MENU).catch(console.error);
	};
	const message = actions.message ?? menus.message;
	return <>
		<PetStanding pet={pet} strokes={patience.strokes} hadEnough={patience.hadEnough} />
		{message ? <Note>{message}</Note> : null}
		<PetMainAction packet={packet} menus={menus} onExpedition={openExpedition} />
		<QuickActions>
			{expedition ? null : <PetHomeActions actions={actions} patience={patience} noTalisman={noTalisman} menus={menus} onExpedition={openExpedition} />}
			<QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={(): void => onPage("rename")}>{i18n.t("app:pet.care.rename")}</QuickAction>
			<QuickAction icon={AppIcons.getIcon("unitValues.money")} onPress={(): void => onPage("sell")}>{i18n.t("app:pet.sale.title")}</QuickAction>
		</QuickActions>
		<PetLocks noTalisman={noTalisman} hadEnough={patience.hadEnough} pet={pet} />
		<PetRelease menus={menus} />
	</>;
}
