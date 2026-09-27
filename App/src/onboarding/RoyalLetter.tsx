import {ReactNode, useSyncExternalStore} from "react";
import {Modal, StyleSheet, View} from "react-native";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {Note} from "@/src/design/Primitives";
import {ActionBanner, Effects} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {Celebration} from "@/src/components/UnlockCelebration";
import {amountEffect, presentEffects} from "@/src/display/OutcomeEffects";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	gifts: {alignItems: "center", marginBottom: Theme.spacing.lg}
});

/** The king's letter of the day, held until the screen is free to show it. */
class RoyalLetterStore {
	private letter: RoyalLetterRes | null = null;

	private readonly listeners = new Set<() => void>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler<RoyalLetterRes>(RoyalLetterRes.wireName, this.receive);
	}

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): RoyalLetterRes | null => this.letter;

	public readonly read = (): void => {
		this.set(null);
	};

	private readonly receive = (packet: RoyalLetterRes): void => {
		this.set(packet);
	};

	private set(letter: RoyalLetterRes | null): void {
		this.letter = letter;
		for (const listener of this.listeners) listener();
	}
}

export const royalLetterStore = new RoyalLetterStore();

export function useRoyalLetter(): RoyalLetterRes | null {
	return useSyncExternalStore(royalLetterStore.subscribe, royalLetterStore.getSnapshot, royalLetterStore.getSnapshot);
}

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
