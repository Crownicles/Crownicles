import {ReactNode} from "react";
import {useRouter} from "expo-router";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOwnPet} from "@/src/store/useKnownPet";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {PetOverview} from "@/src/components/PetCare";
import {PetAbsent} from "@/src/components/PetAbsent";
import {Screen} from "@/src/design/Primitives";

export default function Pet(): ReactNode {
	const router = useRouter();
	const state = useOwnPet();
	if (state.status === "empty") return <PetAbsent />;
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.PET}>{data => <PetOverview
		packet={data}
		onPage={(page): void => router.push(`/pet/${page}`)}
	/>}</GameQueryContent></Screen>;
}
