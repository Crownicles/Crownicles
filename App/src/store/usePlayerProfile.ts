import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PlayerProfileReq, ProfileReq} from "ws-packets/src/fromClient/ProfileReq";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {GameClient, GameAnswer} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";

/** Reads the authenticated player's profile from the existing server contract. */
export function requestPlayerProfile(): Promise<GameAnswer<ProfileRes>> {
	return GameClient.request(
		makeFromClientPacket(ProfileReq, {askedPlayer: {}}),
		ProfileRes,
		[PlayerNotFound]
	);
}

/**
 * Shared profile read for screens that need server-owned player state.
 * Access decisions stay on the server; this hook only exposes the existing response.
 */
export function usePlayerProfile(): RequestState<ProfileRes> {
	return useGameQuery<ProfileRes>(GAME_ENTITIES.PROFILE, requestPlayerProfile);
}

/** Another player's profile, asked through the handle the server sent with them. */
export function useOtherPlayerProfile(playerRef: string): RequestState<ProfileRes> {
	return useGameQuery<ProfileRes>(
		GAME_ENTITIES.PROFILE,
		() => GameClient.request(makeFromClientPacket(PlayerProfileReq, {playerRef}), ProfileRes, [PlayerNotFound]),
		playerRef
	);
}
