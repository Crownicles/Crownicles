import {ReactNode, useState} from "react";
import {View} from "react-native";
import {PetExpeditionResolveRes} from "ws-packets/src/fromServer/pet/PetExpeditionRes";
import {ExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {EFFECT_TONES, Effects, Figures, ModalSurface, SheetModal, Standing} from "@/src/design/Sections";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {ExpeditionRewardDetails} from "@/src/components/ExpeditionDetails";
import {ExpeditionStarted, ExpeditionStatus} from "@/src/components/ExpeditionJourney";
import {LetDownPet} from "@/src/components/PetReaction";
import {expeditionLocationName, expeditionPetIcon, expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const PET_EMBLEM_SIZE = 40;

const useStyles = createStyles(() => ({
	story: {paddingVertical: Theme.spacing.lg}
}));


function ExpeditionResolved({packet}: {packet: PetExpeditionResolveRes}): ReactNode {
	const result = packet.totalFailure ? "failure" : packet.partialSuccess ? "partial" : packet.success ? "success" : "failure";
	return <>
		<Note>{expeditionPetName(packet.pet)}</Note>
		<Note>{expeditionLocationName(packet.expedition)}</Note>
		<Note>{i18n.t(`app:expedition.resolved.${result}`)}</Note>
		{packet.rewards ? <ExpeditionRewardDetails rewards={packet.rewards} /> : null}
		<Figures items={[{caption: i18n.t("app:expedition.loveChange"), value: formatNumber(packet.loveChange)}]} />
		{packet.petLikedExpedition ? <Note>{i18n.t("app:expedition.liked")}</Note> : null}
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
	if (outcome.kind !== "cancelled" && outcome.kind !== "recalled") return undefined;
	return <LetDownPet emoji={expeditionPetIcon(outcome.packet.pet)} size={PET_EMBLEM_SIZE} play={play} forgiving={isForgiven(outcome)} />;
}

function OutcomeMenu({outcome, play, onContinue}: {outcome: ExpeditionOutcome; play: number; onContinue: () => void}): ReactNode {
	const emblem = outcomeEmblem(outcome, play);
	return <Screen>
		<Standing {...emblem ? {emblem} : {}} caption={i18n.t("app:pet.eyebrow")} title={i18n.t(`app:expedition.outcomes.${outcome.kind}`)} />
		<OutcomeContent outcome={outcome} />
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Screen>;
}

export function PetExpeditionOutcome({outcome, onContinue}: {outcome: ExpeditionOutcome; onContinue: () => void}): ReactNode {
	// The pet's reaction waits for the window to be on screen rather than play behind the transition.
	const [play, setPlay] = useState(0);
	return <SheetModal visible onRequestClose={onContinue} onShow={(): void => setPlay(1)}>
		<ModalSurface><OutcomeMenu outcome={outcome} play={play} onContinue={onContinue} /></ModalSurface>
	</SheetModal>;
}