import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetReq} from "ws-packets/src/fromClient/PetReq";
import {PetNotFound} from "ws-packets/src/fromServer/pet/PetNotFound";
import {PetRes} from "ws-packets/src/fromServer/pet/PetRes";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";

function requestOwnPet(): Promise<GameAnswer<PetRes>> {
	return GameClient.request(makeFromClientPacket(PetReq, {askedPlayer: {}}), PetRes, [PetNotFound]);
}

/** The player's own pet, one query shared by every screen that shows it. */
export function useOwnPet(): RequestState<PetRes> {
	return useGameQuery(GAME_ENTITIES.PET, requestOwnPet);
}

/** The pet the client already holds, for the layers that show it without asking the server again. */
export function useKnownPet(): OwnedPet | undefined {
	const cached = useQueryClient().getQueryData<GameAnswer<PetRes>>(gameKey(GAME_ENTITIES.PET));
	return cached?.kind === "answer" ? cached.packet.pet : undefined;
}
