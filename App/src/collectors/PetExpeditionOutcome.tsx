import {ReactNode, useState} from "react";
import {View} from "react-native";
import {PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {ExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {Effect, EFFECT_TONES, Effects, ModalSurface, SheetModal, Standing, Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {ExpeditionStarted, ExpeditionStatus} from "@/src/components/ExpeditionJourney";
import {LetDownPet, TriumphantPet} from "@/src/components/PetReaction";
import {expeditionLocationName, expeditionPetIcon, expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {materialName} from "@/src/display/Resources";
import {randomTranslation} from "@/src/translations/RandomTranslation";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const PET_EMBLEM_SIZE = 40;
const TOAST_EMBLEM_SIZE = 24;

const useStyles = createStyles(() => ({
	story: {paddingVertical: Theme.spacing.lg}
}));


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

/** What the pet brought back, one chip per gain, and what the trip did to the bond between you. */
function resolvedEffects(packet: ResolvedPacket): Effect[] {
	const rewards = packet.rewards;
	const love: Effect = {label: i18n.t("app:expedition.love"), value: `${packet.loveChange >= 0 ? "+" : ""}${formatNumber(packet.loveChange)}`, tone: packet.loveChange >= 0 ? EFFECT_TONES.GAIN : EFFECT_TONES.LOSS, emoji: AppIcons.getIcon("expedition.love")};
	if (!rewards) return packet.loveChange === 0 ? [] : [love];
	return [
		...rewards.money > 0 ? [gain(i18n.t("app:profile.fields.money"), rewards.money, {unit: "money"})] : [],
		...rewards.experience > 0 ? [gain(i18n.t("app:profile.fields.experience"), rewards.experience, {unit: "xp"})] : [],
		...rewards.points > 0 ? [gain(i18n.t("app:profile.fields.score"), rewards.points, {unit: "score"})] : [],
		...rewards.tokens ? [gain(i18n.t("app:profile.fields.tokens"), rewards.tokens, {unit: "token"})] : [],
		...(rewards.materialLoot ?? []).map(material => gain(materialName(material.materialId), material.quantity, {emoji: AppIcons.getIcon(`materials.${material.materialId}`)})),
		...rewards.cloneTalismanFound ? [gain(i18n.t("app:expedition.cloneFound"), 1, {emoji: AppIcons.getIcon("expedition.cloneTalisman")})] : [],
		...packet.loveChange === 0 ? [] : [love]
	];
}

/** Discord's account of the homecoming: how the pet came back, what it did to your bond, and whether it loved the place. */
function resolvedStory(packet: ResolvedPacket, result: ExpeditionResult): string {
	const context = packet.pet.petSex === "f" ? "female" : "male";
	const {story, love} = RESULT_STORIES[result];
	const told = randomTranslation(`commands:petExpedition.${story}`, {context, petDisplay: `**${expeditionPetName(packet.pet)}**`, location: expeditionLocationName(packet.expedition)});
	const liked = packet.petLikedExpedition && result !== EXPEDITION_RESULTS.FAILURE ? i18n.t("commands:petExpedition.petLikedExpedition", {context}) : "";
	return `${told}${i18n.t(`commands:petExpedition.${love(packet.loveChange)}`)}${liked}`;
}

function ExpeditionResolved({packet}: {packet: ResolvedPacket}): ReactNode {
	const styles = useStyles();
	const effects = resolvedEffects(packet);
	return <>
		{effects.length > 0 ? <Effects items={effects} /> : null}
		<View style={styles.story}><Story>{resolvedStory(packet, expeditionResult(packet))}</Story></View>
		{packet.rewards?.itemGiven ? <Note>{i18n.t("app:expedition.itemFound")}</Note> : null}
		{packet.badgeEarned ? <Note>{i18n.t("app:expedition.badge", {badge: i18n.t(`app:reference.badges.names.${packet.badgeEarned}`)})}</Note> : null}
	</>;
}

type LoveLossOutcome = Extract<ExpeditionOutcome, {kind: "cancelled" | "recalled"}>;

function isForgiven(outcome: LoveLossOutcome): boolean {
	return outcome.kind === "cancelled" && outcome.packet.isFreeCancellation;
}

/** Discord's own account of the pet's disappointment, with what it cost in trust. */
function ExpeditionLetDown({outcome}: {outcome: LoveLossOutcome}): ReactNode {
	const styles = useStyles();
	const {pet, loveLost} = outcome.packet;
	const key = outcome.kind === "recalled" ? "recalled" : isForgiven(outcome) ? "freeCancelled" : "cancelled";
	return <>
		{loveLost > 0 ? <Effects items={[{label: i18n.t("app:expedition.love"), value: `-${formatNumber(loveLost)}`, tone: EFFECT_TONES.LOSS, emoji: AppIcons.getIcon("expedition.disliked")}]} /> : null}
		<View style={styles.story}>
			<Story>{i18n.t(`commands:petExpedition.${key}`, {petDisplay: `**${expeditionPetName(pet)}**`, context: pet.petSex === "f" ? "female" : "male"})}</Story>
		</View>
	</>;
}

function OutcomeContent({outcome}: {outcome: ExpeditionOutcome}): ReactNode {
	switch (outcome.kind) {
		case "status": return <ExpeditionStatus packet={outcome.packet} />;
		case "started": return <ExpeditionStarted packet={outcome.packet} />;
		case "resolved": return <ExpeditionResolved packet={outcome.packet} />;
		case "error": return <Note>{i18n.t(`app:expedition.errors.${outcome.packet.errorCode}`)}</Note>;
		default: return <ExpeditionLetDown outcome={outcome} />;
	}
}

function outcomeEmblem(outcome: ExpeditionOutcome, play: number): ReactNode {
	if (outcome.kind === "resolved") {
		const emoji = expeditionPetIcon(outcome.packet.pet);
		const result = expeditionResult(outcome.packet);
		return result === EXPEDITION_RESULTS.SUCCESS
			? <TriumphantPet emoji={emoji} size={PET_EMBLEM_SIZE} play={play} />
			: <LetDownPet emoji={emoji} size={PET_EMBLEM_SIZE} play={play} forgiving={result === EXPEDITION_RESULTS.PARTIAL} />;
	}
	if (outcome.kind !== "cancelled" && outcome.kind !== "recalled") return undefined;
	return <LetDownPet emoji={expeditionPetIcon(outcome.packet.pet)} size={PET_EMBLEM_SIZE} play={play} forgiving={isForgiven(outcome)} />;
}

function outcomeHeading(outcome: ExpeditionOutcome): {caption: string; title: string} {
	if (outcome.kind === "resolved") return {caption: expeditionLocationName(outcome.packet.expedition), title: i18n.t(`app:expedition.resolvedTitles.${expeditionResult(outcome.packet)}`)};
	return {caption: i18n.t("app:pet.eyebrow"), title: i18n.t(`app:expedition.outcomes.${outcome.kind}`)};
}

function OutcomeMenu({outcome, play, onContinue}: {outcome: ExpeditionOutcome; play: number; onContinue: () => void}): ReactNode {
	const emblem = outcomeEmblem(outcome, play);
	return <Screen>
		<Standing {...emblem ? {emblem} : {}} {...outcomeHeading(outcome)} />
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