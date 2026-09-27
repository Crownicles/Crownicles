import {ReactNode} from "react";
import {Modal, StyleSheet, View} from "react-native";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {Note} from "@/src/design/Primitives";
import {ActionBanner, Effects} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {Celebration} from "@/src/components/UnlockCelebration";
import {amountEffect, presentEffects} from "@/src/display/OutcomeEffects";
import {royalLetterStore} from "@/src/store/RoyalLetterStore";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	gifts: {alignItems: "center", marginBottom: Theme.spacing.lg}
});

/** Core has already credited the gifts: the letter is where the player sees them, with their place in the contest. */
export function RoyalLetter({letter}: {letter: RoyalLetterRes}): ReactNode {
	const gifts = presentEffects([
		amountEffect(i18n.t("app:adventure.event.fields.tokens"), letter.tokens, {gain: "token"}),
		amountEffect(i18n.t("app:adventure.event.fields.money"), letter.money, {gain: "money"}),
		amountEffect(i18n.t("app:adventure.event.fields.gems"), letter.gems, {gain: "gem"})
	]);
	return <Modal transparent animationType="none" statusBarTranslucent onRequestClose={royalLetterStore.read}>
		<Celebration
			icon="other.royalLetter"
			eyebrow={i18n.t("app:contest.letter.eyebrow", {letter: letter.letter, letters: letter.letters})}
			title={i18n.t("app:contest.letter.title")}
			description={i18n.t(`notifications:royalMail.letters.${letter.letter}`)}
			testID="royal-letter"
		>
			{gifts.length > 0 ? <View style={styles.gifts}><Effects items={gifts} /></View> : null}
			{letter.rank !== undefined && letter.rankedPlayers !== undefined
				? <Note>{i18n.t("app:contest.letter.rank", {rank: letter.rank, rankedPlayers: letter.rankedPlayers})}</Note>
				: null}
			<ActionBanner icon={Check} label={i18n.t("app:contest.letter.continue")} onPress={royalLetterStore.read} testID="royal-letter-continue" />
		</Celebration>
	</Modal>;
}
