import {ReactNode, useState} from "react";
import {PetFeedOutcome as Outcome} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PET_FEED_ERRORS} from "ws-packets/src/objects/PetFood";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetEmptyBowl, PetFeast} from "@/src/components/PetReaction";
import {Note} from "@/src/design/Primitives";
import {useKnownPet} from "@/src/store/useKnownPet";
import {ActionBanner, BottomSheet, JournalEntry} from "@/src/design/Sections";
import {Story} from "@/src/design/Story";
import {PawPrint} from "@/src/design/FightIcons";
import {usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {plainStory} from "@/src/display/Markdown";
import {petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

type PetFeedError = typeof PET_FEED_ERRORS[keyof typeof PET_FEED_ERRORS];

/** The Discord message each refusal is told with. */
const ERROR_KEYS: Record<PetFeedError, string> = {
	[PET_FEED_ERRORS.NO_PET]: "noPet",
	[PET_FEED_ERRORS.EXPEDITION]: "petOnExpedition",
	[PET_FEED_ERRORS.NOT_HUNGRY]: "notHungry",
	[PET_FEED_ERRORS.NO_MONEY]: "noMoney",
	[PET_FEED_ERRORS.EMPTY_STORAGE]: "guildStorageEmpty",
	[PET_FEED_ERRORS.SITUATION_CHANGED]: "situationChanged",
	[PET_FEED_ERRORS.CANCELLED]: "cancelled"
};

function feedMessage(outcome: Outcome): string {
	if (outcome.success) return plainStory(i18n.t(`commands:petFeed.result.${outcome.result}`));
	const pet = outcome.error === PET_FEED_ERRORS.NOT_HUNGRY ? petName(outcome.pet) : "";
	return plainStory(i18n.t(`commands:petFeed.${ERROR_KEYS[outcome.error]}`, {pet}));
}

type FeedScene = {title: string; subtitle: string; stage?: ReactNode; hint?: string};

/** The pet's reaction plays centred above the story: squeezed into the title's emblem, its dance had no room. */
function feedScene(outcome: Outcome, pet: OwnedPet | undefined, play: number, pseudo: string): FeedScene {
	if (outcome.success) {
		return {
			...pet ? {stage: <PetFeast pet={pet} result={outcome.result} play={play} />} : {},
			title: plainStory(i18n.t("commands:petFeed.resultTitle", {pseudo})),
			subtitle: feedMessage(outcome)
		};
	}
	if (outcome.error === PET_FEED_ERRORS.EMPTY_STORAGE) {
		return {
			stage: <PetEmptyBowl pet={pet} play={play} />,
			title: i18n.t("app:pet.feed.empty.title"),
			subtitle: i18n.t("app:pet.feed.empty.description", {pet: pet ? petName(pet) : i18n.t("app:pet.eyebrow")}),
			hint: i18n.t("app:pet.feed.empty.refill")
		};
	}
	return {title: i18n.t("app:pet.feed.unavailable"), subtitle: feedMessage(outcome)};
}

export function PetFeedOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const pet = useKnownPet();
	const pseudo = usePlayerPseudo();
	/** The sheet rises over the feeding menu, so the dance waits for it to settle rather than play while it moves. */
	const [play, setPlay] = useState(0);
	const {title, subtitle, stage, hint} = feedScene(outcome, pet, play, pseudo);
	return <BottomSheet onClose={onContinue} onShown={(): void => setPlay(1)}>
		{stage}
		<JournalEntry plain title={title} effects={[]}>
			<Story>{subtitle}</Story>
		</JournalEntry>
		{hint ? <Note>{hint}</Note> : null}
		<ActionBanner icon={PawPrint} label={i18n.t("app:pet.feed.continue")} onPress={onContinue} />
	</BottomSheet>;
}