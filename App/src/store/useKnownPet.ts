import {useQueryClient} from "@tanstack/react-query";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {GameAnswer} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

/** The pet the client already holds, for the layers that show it without asking the server again. */
export function useKnownPet(): OwnedPet | undefined {
	const cached = useQueryClient().getQueryData<GameAnswer<PetRes>>(gameKey(GAME_ENTITIES.PET));
	return cached?.kind === "answer" ? cached.packet.pet : undefined;
}
