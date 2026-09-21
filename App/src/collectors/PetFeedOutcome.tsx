import {ReactNode} from "react";
import {PetFeedOutcome as Outcome} from "ws-packets/src/fromServer/pet/PetCareRes";
import {PET_FEED_ERRORS} from "ws-packets/src/objects/PetFood";
import {PetFeast} from "@/src/components/PetReaction";
import {useKnownPet} from "@/src/store/useKnownPet";
import {Button, ButtonRow, Confirmation} from "@/src/design/Primitives";
import {petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

function feedMessage(outcome: Outcome): string {
	if (outcome.success) return i18n.t(`app:pet.feed.results.${outcome.result}`);
	if (outcome.error === PET_FEED_ERRORS.NOT_HUNGRY) return i18n.t("app:pet.feed.errors.notHungry", {pet: petName(outcome.pet)});
	return i18n.t(`app:pet.feed.errors.${outcome.error}`);
}

export function PetFeedOutcome({outcome, onContinue}: {outcome: Outcome; onContinue: () => void}): ReactNode {
	const pet = useKnownPet();
	const feast = outcome.success && pet ? <PetFeast pet={pet} result={outcome.result} /> : null;
	return <Confirmation
		{...feast ? {icon: feast} : {}}
		title={i18n.t(outcome.success ? "app:pet.feed.success" : "app:pet.feed.unavailable")}
		message={feedMessage(outcome)}
		onRequestClose={onContinue}
	>
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}