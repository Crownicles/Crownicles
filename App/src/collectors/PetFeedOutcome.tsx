import {ReactNode, useState} from "react";
import {PetFeedOutcome as Outcome} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PET_FEED_ERRORS} from "ws-packets/src/objects/PetFood";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {PetEmptyBowl, PetFeast} from "@/src/components/PetReaction";
import {Note} from "@/src/design/Primitives";
import {useKnownPet} from "@/src/store/useKnownPet";
import {ActionBanner, Sheet} from "@/src/design/Sections";
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

type FeedScene = {emblem: ReactNode; title: string; subtitle: string; stage?: ReactNode; hint?: string};

function feedScene(outcome: Outcome, pet: OwnedPet | undefined, play: number, pseudo: string): FeedScene {
	if (outcome.success) {
		return {
			emblem: pet ? <PetFeast pet={pet} result={outcome.result} play={play} /> : null,
			title: plainStory(i18n.t("commands:petFeed.resultTitle", {pseudo})),
			subtitle: feedMessage(outcome)
		};
	}
	if (outcome.error === PET_FEED_ERRORS.EMPTY_STORAGE) {
		return {
			emblem: null,
			stage: <PetEmptyBowl pet={pet} play={play} />,
			title: i18n.t("app:pet.feed.empty.title"),
			subtitle: i18n.t("app:pet.feed.empty.description", {pet: pet ? petName(pet) : i18n.t("app:pet.eyebrow")}),
			hint: i18n.t("app:pet.feed.empty.refill")
		};
	}
	return {emblem: null, title: i18n.t("app:pet.feed.unavailable"), subtitle: feedMessage(outcome)};
}

export function PetFeedOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const pet = useKnownPet();
	const pseudo = usePlayerPseudo();
	/** The layer opens over the feeding menu, so the dance waits to be on screen rather than play behind the transition. */
	const [play, setPlay] = useState(0);
	const {emblem, title, subtitle, stage, hint} = feedScene(outcome, pet, play, pseudo);
	return <Sheet
		{...emblem ? {emblem} : {}}
		caption={i18n.t("app:pet.eyebrow")}
		title={title}
		subtitle={subtitle}
		closeLabel={i18n.t("app:common.back")}
		onShow={(): void => setPlay(1)}
		onClose={onContinue}
	>
		{stage}
		{hint ? <Note>{hint}</Note> : null}
		<ActionBanner icon={PawPrint} label={i18n.t("app:pet.feed.continue")} onPress={onContinue} />
	</Sheet>;
}