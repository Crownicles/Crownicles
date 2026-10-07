import {ReactNode, useState} from "react";
import {View} from "react-native";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetExpedition, PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {PetFeedReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetFeedRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PetExpeditionReq} from "ws-packets/src/fromClient/PetExpeditionReq";
import {PetExpeditionErrorRes, PetExpeditionRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameDeadline} from "@/src/store/useGameDeadline";
import {PetActions, usePetActions} from "@/src/store/usePetActions";
import {PetPatience, usePetPatience} from "@/src/store/usePetPatience";
import {CommandMenu, CommandMenuState, useCommandMenus} from "@/src/store/useInventoryMenus";
import {FightGauge} from "@/src/components/FightGauge";
import {PetCaress} from "@/src/components/PetReaction";
import {PET_MANAGEMENT_MENUS} from "@/src/components/PetManagement";
import {PetExpeditionJourney} from "@/src/components/PetExpeditionJourney";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {Button, ButtonRow, Note, QuickAction, QuickActions, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Lock, LockHint, QuestionSheet, Refusal, Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Check, Clock3, Flame, Gift, Heart, HeartPulse, LogOut, LucideIcon, PawPrint, Utensils, Wind} from "@/src/design/FightIcons";
import {PaletteColor, Theme} from "@/src/design/Theme";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {AppIcons} from "@/src/AppIcons";
import {petMood, petName, petRarity, petSex, petTypeName} from "@/src/display/PetDisplay";
import {activeEffect, effectLock} from "@/src/display/CommandRejection";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {missionDate} from "@/src/display/Missions";
import {i18n} from "@/src/translations/i18n";

export type PetPage = "rename" | "sell";

const FEED_MENU: CommandMenu = {request: PetFeedReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetFeedRes]};
const EXPEDITION_MENU: CommandMenu = {request: PetExpeditionReq, emptyPacket: PetNotFound, emptyMessage: "app:pet.noPet", outcomePackets: [PetExpeditionRes, PetExpeditionErrorRes]};

/** The moral ladder Core walks a pet up, from feisty to trained. */
const MOOD_STEPS = 5;
const PET_EMBLEM_SIZE = 40;

const useStyles = createStyles(() => ({
	awayAction: {marginTop: Theme.spacing.lg}
}));

/** How each rung of that ladder reads at a glance, from a hostile pet to a devoted one. */
const MOOD_LOOKS: Record<number, {icon: LucideIcon; color: PaletteColor}> = {
	1: {icon: Flame, color: "red"},
	2: {icon: PawPrint, color: "red"},
	3: {icon: Wind, color: "gold"},
	4: {icon: Heart, color: "green"},
	5: {icon: HeartPulse, color: "green"}
};

function PetStanding({pet, strokes, hadEnough}: {pet: OwnedPet; strokes: number; hadEnough: boolean}): ReactNode {
	const colors = useColors();
	const mood = MOOD_LOOKS[pet.loveLevel] ?? MOOD_LOOKS[MOOD_STEPS];
	return <Standing
		testID="pet-standing"
		emblem={<PetCaress pet={pet} size={PET_EMBLEM_SIZE} strokes={strokes} hadEnough={hadEnough} />}
		caption={i18n.t("app:pet.eyebrow")}
		title={petName(pet)}
		subtitle={`${petTypeName(pet)} · ${petRarity(pet)} · ${petSex(pet)}`}
	>
		<FightGauge label={petMood(pet)} value={pet.loveLevel} max={MOOD_STEPS} icon={mood.icon} color={colors[mood.color]} />
	</Standing>;
}

function feedLock(packet: PetRes, alteration: Lock | undefined): Lock | undefined {
	if (alteration) return alteration;
	return packet.feedAvailableAt
		? {reason: i18n.t("app:pet.care.notHungryUntil", {pet: petName(packet.pet), date: missionDate(packet.feedAvailableAt)}), icon: Clock3}
		: undefined;
}

/** The banner already says what it does, so Core's claim question is answered without being shown. */
function claimReaction(collector: ReactionCollectorCreation): number | null {
	if (collector.data.type !== EXPEDITION_DATA_KINDS.FINISHED) return null;
	const index = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CLAIM);
	return index < 0 ? null : index;
}

/** The recall was confirmed on this page, so Core's question about the trip is answered without being shown. */
function recallReaction(collector: ReactionCollectorCreation): number | null {
	if (collector.data.type !== EXPEDITION_DATA_KINDS.PROGRESS) return null;
	const index = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.RECALL);
	return index < 0 ? null : index;
}

/** Once the pet is due back, welcoming it home is the one thing left to do; before that, the recall sits with the other actions. */
function PetAwayAction({expedition, menus}: {expedition: PetExpedition; menus: CommandMenuState}): ReactNode {
	const styles = useStyles();
	const back = useSecondsLeft(expedition.endTime) === 0;
	return back
		? <View style={styles.awayAction}><ActionBanner icon={Gift} label={i18n.t("app:expedition.claim")} pending={menus.pending} onPress={(): void => {
			menus.open(EXPEDITION_MENU, undefined, claimReaction).catch(console.error);
		}} /></View>
		: null;
}

/** The single thing to do with the pet: follow its expedition, or else feed it. */
function PetMainAction({packet, menus, alteration}: {packet: PetRes; menus: CommandMenuState; alteration: Lock | undefined}): ReactNode {
	const expedition = packet.expeditionInProgress;
	if (expedition) return <PetAwayAction expedition={expedition} menus={menus} />;
	const lock = feedLock(packet, alteration);
	return <ActionBanner
		icon={Utensils}
		label={i18n.t("app:pet.care.feedPet", {pet: petName(packet.pet)})}
		pending={menus.pending}
		onPress={(): void => {
			menus.open(FEED_MENU).catch(console.error);
		}}
		{...lock ? {lock} : {}}
	/>;
}

function openExpeditionMenu(menus: CommandMenuState): void {
	menus.open(EXPEDITION_MENU).catch(console.error);
}

function RenameAction({onPage}: {onPage: (page: PetPage) => void}): ReactNode {
	return <QuickAction icon={AppIcons.getIcon("badges.redactor")} onPress={(): void => onPage("rename")}>{i18n.t("app:pet.care.rename")}</QuickAction>;
}

/** What can be done with a pet at home: caress it, send it away, rename or sell it. */
function PetHomeActions({actions, patience, menus, locks, onPage}: {
	actions: PetActions;
	patience: PetPatience;
	menus: CommandMenuState;
	locks: {expedition: boolean; alteration: boolean};
	onPage: (page: PetPage) => void;
}): ReactNode {
	return <>
		<QuickAction icon={AppIcons.getIcon("petCommand.pet")} disabled={actions.pending || patience.hadEnough} onPress={(): void => {
			actions.care({type: "caress"}).then(petted => {
				if (petted) patience.stroke();
			}).catch(console.error);
		}}>{i18n.t("app:pet.care.caress")}</QuickAction>
		<QuickAction icon={AppIcons.getIcon("expedition.map")} disabled={menus.pending || locks.expedition} onPress={(): void => openExpeditionMenu(menus)}>{i18n.t("app:expedition.open")}</QuickAction>
		<RenameAction onPage={onPage} />
		<QuickAction icon={AppIcons.getIcon("unitValues.money")} disabled={locks.alteration} onPress={(): void => onPage("sell")}>{i18n.t("app:pet.sale.title")}</QuickAction>
	</>;
}

/** Calling the pet back breaks its trust: the page asks once in a sheet, then Core's question is answered for the player. */
function RecallConfirmation({pet, menus, onClose}: {pet: OwnedPet; menus: CommandMenuState; onClose: () => void}): ReactNode {
	return <QuestionSheet
		caption={i18n.t("app:pet.eyebrow")}
		title={i18n.t("app:expedition.recall")}
		subtitle={petName(pet)}
		emblem={<TwemojiIcon emoji={AppIcons.getIcon("expedition.recall")} size={Theme.dimensions.headerIcon} />}
		onClose={onClose}
	>
		<Note>{i18n.t("app:expedition.recallWarning")}</Note>
		<ActionBanner icon={Check} label={i18n.t("app:expedition.confirmRecall")} pending={menus.pending} onPress={(): void => {
			onClose();
			menus.open(EXPEDITION_MENU, undefined, recallReaction).catch(console.error);
		}} />
	</QuestionSheet>;
}

/** On expedition, the pet is out of reach: it can only be recalled while on its way, and renamed. */
function PetAwayActions({pet, expedition, menus, onPage}: {pet: OwnedPet; expedition: PetExpedition; menus: CommandMenuState; onPage: (page: PetPage) => void}): ReactNode {
	const recallable = useSecondsLeft(expedition.endTime) > 0;
	const [confirming, setConfirming] = useState(false);
	return <>
		{recallable ? <QuickAction icon={AppIcons.getIcon("expedition.recall")} disabled={menus.pending} onPress={(): void => setConfirming(true)}>{i18n.t("app:expedition.recall")}</QuickAction> : null}
		<RenameAction onPage={onPage} />
		{confirming ? <RecallConfirmation pet={pet} menus={menus} onClose={(): void => setConfirming(false)} /> : null}
	</>;
}

/** What keeps a pet at home from leaving, as Core tells it; a pet already away is followed, not sent. */
function expeditionLock(packet: PetRes): Lock | undefined {
	return packet.expeditionBlocker && !packet.expeditionInProgress ? {reason: i18n.t(`app:expedition.errors.${packet.expeditionBlocker}`)} : undefined;
}

function PetLocks({expedition, hadEnough, pet}: {expedition: Lock | undefined; hadEnough: boolean; pet: PetRes["pet"]}): ReactNode {
	return <>
		{expedition ? <LockHint lock={expedition} testID="pet-expedition-lock" /> : null}
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

/** Core refuses feeding and selling to an altered player, so both wait with the alteration's reason. */
function usePlayerAlteration(): Lock | undefined {
	const profile = usePlayerProfile();
	const effect = profile.status === "ready" ? activeEffect(profile.data) : null;
	return effect ? effectLock(effect) : undefined;
}

/** The pet screen in one glance: who it is, the single thing to do with it, then everything else. */
export function PetOverview({packet, onPage}: {packet: PetRes; onPage: (page: PetPage) => void}): ReactNode {
	const pet = packet.pet;
	const expedition = packet.expeditionInProgress;
	const actions = usePetActions();
	const menus = useCommandMenus();
	const patience = usePetPatience();
	useGameDeadline(GAME_ENTITIES.PET, expedition?.endTime ?? null);
	const expeditionBlocked = expeditionLock(packet);
	const alteration = usePlayerAlteration();
	const message = actions.message ?? menus.message;
	return <>
		{expedition
			? <PetExpeditionJourney pet={pet} expedition={expedition} />
			: <PetStanding pet={pet} strokes={patience.strokes} hadEnough={patience.hadEnough} />}
		{message ? <Refusal>{message}</Refusal> : null}
		<PetMainAction packet={packet} menus={menus} alteration={alteration} />
		<QuickActions>
			{expedition
				? <PetAwayActions pet={pet} expedition={expedition} menus={menus} onPage={onPage} />
				: <PetHomeActions actions={actions} patience={patience} menus={menus} locks={{expedition: expeditionBlocked !== undefined, alteration: alteration !== undefined}} onPage={onPage} />}
		</QuickActions>
		<PetLocks expedition={expeditionBlocked} hadEnough={patience.hadEnough} pet={pet} />
		{expedition ? null : <PetRelease menus={menus} />}
	</>;
}
