import {useCallback} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {AppStateReq} from "ws-packets/src/fromClient/AppStateReq";
import {AppStateRes} from "ws-packets/src/fromServer/appState/AppStateRes";
import {AppStateFlag} from "ws-packets/src/objects/AppState";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";

/** What the app just showed the character: flags to set, reveals now seen. */
export type AppStateChange = {seen?: readonly AppStateFlag[]; acknowledged?: readonly number[]};

function requestAppState(change: AppStateChange = {}): Promise<GameAnswer<AppStateRes>> {
	return GameClient.request(makeFromClientPacket<AppStateReq>(AppStateReq, {
		...change.seen ? {seen: [...change.seen]} : {},
		...change.acknowledged ? {acknowledged: [...change.acknowledged]} : {}
	}), AppStateRes);
}

/** The state as it will be once Core has applied the change, drawn at once so nothing is shown twice. */
export function withChange(state: AppStateRes, change: AppStateChange): AppStateRes {
	const acknowledged = new Set(change.acknowledged ?? []);
	return Object.assign(new AppStateRes(), {
		seen: [...new Set([...state.seen, ...change.seen ?? []])],
		reveals: state.reveals.filter(reveal => !acknowledged.has(reveal.id))
	});
}

/** What the app has already shown this character, as Core keeps it: it resets with the character. */
export function useAppState(): RequestState<AppStateRes> {
	return useGameQuery(GAME_ENTITIES.APP_STATE, () => requestAppState());
}

export function useAppStateChange(): (change: AppStateChange) => void {
	const queryClient = useQueryClient();
	return useCallback((change: AppStateChange): void => {
		const key = gameKey(GAME_ENTITIES.APP_STATE);
		const current = queryClient.getQueryData<GameAnswer<AppStateRes>>(key);
		if (current?.kind === "answer") {
			queryClient.setQueryData(key, (): GameAnswer<AppStateRes> => ({kind: "answer", packet: withChange(current.packet, change)}));
		}
		requestAppState(change)
			.then(answer => {
				if (answer.kind === "answer") queryClient.setQueryData(key, answer);
			})
			.catch(error => console.error("Failed to record what the app showed:", error));
	}, [queryClient]);
}
