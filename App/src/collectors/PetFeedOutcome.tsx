import {ReactNode, useState} from "react";
import {PetFeedOutcome as Outcome} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PET_FEED_ERRORS} from "ws-packets/src/objects/PetFood";
import {PetFeast} from "@/src/components/PetReaction";
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

export function PetFeedOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const pet = useKnownPet();
	const pseudo = usePlayerPseudo();
	/** The layer opens over the feeding menu, so the dance waits to be on screen rather than play behind the transition. */
	const [play, setPlay] = useState(0);
	const feast = outcome.success && pet ? <PetFeast pet={pet} result={outcome.result} play={play} /> : null;
	return <Sheet
		{...feast ? {emblem: feast} : {}}
		caption={i18n.t("app:pet.eyebrow")}
		title={outcome.success ? plainStory(i18n.t("commands:petFeed.resultTitle", {pseudo})) : i18n.t("app:pet.feed.unavailable")}
		subtitle={feedMessage(outcome)}
		closeLabel={i18n.t("app:common.back")}
		onShow={(): void => setPlay(1)}
		onClose={onContinue}
	>
		<ActionBanner icon={PawPrint} label={i18n.t("app:pet.feed.continue")} onPress={onContinue} />
	</Sheet>;
}