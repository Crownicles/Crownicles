import {ReactNode, useState} from "react";
import {PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {ExpeditionRewards} from "ws-packets/src/objects/PetExpedition";
import {ExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {
	ActionBanner, Effect, EFFECT_TONES, JournalEntry, ModalSurface, SheetModal, Standing, Toast
} from "@/src/design/Sections";
import {BookOpen} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {ExpeditionStarted, ExpeditionStatus} from "@/src/components/ExpeditionJourney";
import {LetDownPet, TriumphantPet} from "@/src/components/PetReaction";
import {expeditionLocationName, expeditionPetIcon, expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {materialName} from "@/src/display/Resources";
import {randomTranslation} from "@/src/translations/RandomTranslation";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const TOAST_EMBLEM_SIZE = 24;

type ResolvedPacket = PetExpeditionResolveRes;
const EXPEDITION_RESULTS = {SUCCESS: "success", PARTIAL: "partial", FAILURE: "failure"} as const;
type ExpeditionResult = typeof EXPEDITION_RESULTS[keyof typeof EXPEDITION_RESULTS];

/** Discord tells each result with its own set of stories, and its own word on the bond with the pet. */
const RESULT_STORIES = {
	[EXPEDITION_RESULTS.SUCCESS]: {story: "success", love: (): string => "loveChangeSuccess"},
	[EXPEDITION_RESULTS.PARTIAL]: {story: "partialSuccess", love: (loveChange: number): string => loveChange >= 0 ? "loveChangePartialPositive" : "loveChangePartialNegative"},
	[EXPEDITION_RESULTS.FAILURE]: {story: "totalFailure", love: (): string => "loveChangeFailure"}
} as const satisfies Record<ExpeditionResult, {story: string; love: (loveChange: number) => string}>;

function expeditionResult(packet: ResolvedPacket): ExpeditionResult {
	if (packet.totalFailure || !packet.success) return EXPEDITION_RESULTS.FAILURE;
	return packet.partialSuccess ? EXPEDITION_RESULTS.PARTIAL : EXPEDITION_RESULTS.SUCCESS;
}

function gain(label: string, amount: number, look: {unit: string} | {emoji: string}): Effect {
	return {label, value: `+${formatNumber(amount)}`, tone: EFFECT_TONES.GAIN, ...look};
}

const AMOUNT_GAINS = [
	{field: "money", label: "app:profile.fields.money", unit: "money"},
	{field: "experience", label: "app:profile.fields.experience", unit: "xp"},
	{field: "points", label: "app:profile.fields.score", unit: "score"},
	{field: "tokens", label: "app:profile.fields.tokens", unit: "token"}
] as const satisfies {field: keyof ExpeditionRewards; label: string; unit: string}[];

function rewardEffects(rewards: ExpeditionRewards): Effect[] {
	const amounts = AMOUNT_GAINS.flatMap(({field, label, unit}) => {
		const amount = rewards[field] ?? 0;
		return amount > 0 ? [gain(i18n.t(label), amount, {unit})] : [];
	});
	const materials = (rewards.materialLoot ?? []).map(material => gain(materialName(material.materialId), material.quantity, {emoji: AppIcons.getIcon(`materials.${material.materialId}`)}));
	const talisman = rewards.cloneTalismanFound ? [gain(i18n.t("app:expedition.cloneFound"), 1, {emoji: AppIcons.getIcon("expedition.cloneTalisman")})] : [];
	return [...amounts, ...materials, ...talisman];
}

function loveEffects(loveChange: number): Effect[] {
	if (loveChange === 0) return [];
	const gained = loveChange > 0;
	return [{label: i18n.t("app:expedition.love"), value: `${gained ? "+" : ""}${formatNumber(loveChange)}`, tone: gained ? EFFECT_TONES.GAIN : EFFECT_TONES.LOSS, emoji: AppIcons.getIcon("expedition.love")}];
}

/** What the pet brought back, one chip per gain, and what the trip did to the bond between you. */
function resolvedEffects(packet: ResolvedPacket): Effect[] {
	return [...packet.rewards ? rewardEffects(packet.rewards) : [], ...loveEffects(packet.loveChange)];
}

/** Discord's account of the homecoming: how the pet came back, what it did to your bond, and whether it loved the place. */
function resolvedStory(packet: ResolvedPacket, result: ExpeditionResult): string {
	const context = packet.pet.petSex === "f" ? "female" : "male";
	const {story, love} = RESULT_STORIES[result];
	const told = randomTranslation(`commands:petExpedition.${story}`, {context, petDisplay: `**${expeditionPetName(packet.pet)}**`, location: expeditionLocationName(packet.expedition)});
	const liked = packet.petLikedExpedition && result !== EXPEDITION_RESULTS.FAILURE ? i18n.t("commands:petExpedition.petLikedExpedition", {context}) : "";
	return `${told}${i18n.t(`commands:petExpedition.${love(packet.loveChange)}`)}${liked}`;
}

function ExpeditionResolved({packet, emblem}: {packet: ResolvedPacket; emblem: ReactNode}): ReactNode {
	const result = expeditionResult(packet);
	return <>
		<JournalEntry emblem={emblem} title={i18n.t(`app:expedition.resolvedTitles.${result}`)} effects={resolvedEffects(packet)}>
			<Story>{resolvedStory(packet, result)}</Story>
		</JournalEntry>
		{packet.rewards?.itemGiven ? <Note>{i18n.t("app:expedition.itemFound")}</Note> : null}
		{packet.badgeEarned ? <Note>{i18n.t("app:expedition.badge", {badge: i18n.t(`app:reference.badges.names.${packet.badgeEarned}`)})}</Note> : null}
	</>;
}

type LoveLossOutcome = Extract<ExpeditionOutcome, {kind: "cancelled" | "recalled"}>;

function isForgiven(outcome: LoveLossOutcome): boolean {
	return outcome.kind === "cancelled" && outcome.packet.isFreeCancellation;
}

/** Discord's own account of the pet's disappointment, with what it cost in trust. */
function ExpeditionLetDown({outcome, emblem}: {outcome: LoveLossOutcome; emblem: ReactNode}): ReactNode {
	const {pet, loveLost} = outcome.packet;
	const key = outcome.kind === "recalled" ? "recalled" : isForgiven(outcome) ? "freeCancelled" : "cancelled";
	const effects: Effect[] = loveLost > 0 ? [{label: i18n.t("app:expedition.love"), value: `-${formatNumber(loveLost)}`, tone: EFFECT_TONES.LOSS, emoji: AppIcons.getIcon("expedition.disliked")}] : [];
	return <JournalEntry emblem={emblem} title={i18n.t(`app:expedition.outcomes.${outcome.kind}`)} effects={effects}>
		<Story>{i18n.t(`commands:petExpedition.${key}`, {petDisplay: `**${expeditionPetName(pet)}**`, context: pet.petSex === "f" ? "female" : "male"})}</Story>
	</JournalEntry>;
}

type JournalOutcome = Extract<ExpeditionOutcome, {kind: "resolved" | "cancelled" | "recalled"}>;
type PlainOutcome = Exclude<ExpeditionOutcome, JournalOutcome>;

function isJournalOutcome(outcome: ExpeditionOutcome): outcome is JournalOutcome {
	return outcome.kind === "resolved" || outcome.kind === "cancelled" || outcome.kind === "recalled";
}

function OutcomeContent({outcome}: {outcome: PlainOutcome}): ReactNode {
	switch (outcome.kind) {
		case "status": return <ExpeditionStatus packet={outcome.packet} />;
		case "started": return <ExpeditionStarted packet={outcome.packet} />;
		default: return <Note>{i18n.t(`app:expedition.errors.${outcome.packet.errorCode}`)}</Note>;
	}
}

/** The pet cheers when the trip went well, sulks otherwise, and forgives a free cancellation or a half success. */
function outcomeEmblem(outcome: JournalOutcome, play: number): ReactNode {
	const size = Theme.dimensions.headerIcon;
	const emoji = expeditionPetIcon(outcome.packet.pet);
	if (outcome.kind !== "resolved") return <LetDownPet emoji={emoji} size={size} play={play} forgiving={isForgiven(outcome)} />;
	const result = expeditionResult(outcome.packet);
	return result === EXPEDITION_RESULTS.SUCCESS
		? <TriumphantPet emoji={emoji} size={size} play={play} />
		: <LetDownPet emoji={emoji} size={size} play={play} forgiving={result === EXPEDITION_RESULTS.PARTIAL} />;
}

/** A homecoming or a let-down is told like an event of the journey: its journal entry, then a single way on. */
function OutcomeJournal({outcome, play, onContinue}: {outcome: JournalOutcome; play: number; onContinue: () => void}): ReactNode {
	const emblem = outcomeEmblem(outcome, play);
	return <Screen>
		{outcome.kind === "resolved"
			? <ExpeditionResolved packet={outcome.packet} emblem={emblem} />
			: <ExpeditionLetDown outcome={outcome} emblem={emblem} />}
		<ActionBanner icon={BookOpen} label={i18n.t("app:expedition.continue")} onPress={onContinue} />
	</Screen>;
}

function OutcomeMenu({outcome, play, onContinue}: {outcome: ExpeditionOutcome; play: number; onContinue: () => void}): ReactNode {
	if (isJournalOutcome(outcome)) return <OutcomeJournal outcome={outcome} play={play} onContinue={onContinue} />;
	return <Screen>
		<Standing caption={i18n.t("app:pet.eyebrow")} title={i18n.t(`app:expedition.outcomes.${outcome.kind}`)} />
		<OutcomeContent outcome={outcome} />
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Screen>;
}

type StartedOutcome = Extract<ExpeditionOutcome, {kind: "started"}>;

/** The pet page already follows the trip, so a departure only needs a word, and a warning when the guild could not pack enough. */
function DepartureToast({packet, onContinue}: {packet: StartedOutcome["packet"]; onContinue: () => void}): ReactNode {
	const pet = packet.expedition?.pet;
	const subtitle = packet.insufficientFood
		? i18n.t(`app:expedition.insufficientFood.${packet.insufficientFoodCause ?? "noGuild"}`)
		: packet.expedition ? expeditionLocationName(packet.expedition) : undefined;
	return <Toast
		{...pet ? {emblem: <TwemojiIcon emoji={expeditionPetIcon(pet)} size={TOAST_EMBLEM_SIZE} />} : {}}
		title={i18n.t("app:expedition.outcomes.started")}
		{...subtitle ? {subtitle} : {}}
		onDismiss={onContinue}
	/>;
}

export function PetExpeditionOutcome({outcome, onContinue}: {outcome: ExpeditionOutcome; onContinue: () => void}): ReactNode {
	// The pet's reaction waits for the window to be on screen rather than play behind the transition.
	const [play, setPlay] = useState(0);
	if (outcome.kind === "started" && outcome.packet.success) return <DepartureToast packet={outcome.packet} onContinue={onContinue} />;
	return <SheetModal visible onRequestClose={onContinue} onShow={(): void => setPlay(1)}>
		<ModalSurface><OutcomeMenu outcome={outcome} play={play} onContinue={onContinue} /></ModalSurface>
	</SheetModal>;
}