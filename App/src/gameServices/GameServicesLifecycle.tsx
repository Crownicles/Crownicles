import {useEffect} from "react";
import {AppState} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {gameServicesStore} from "./GameServices";
import {GAME_SERVICE_PROVIDERS} from "./GameServicesTypes";
import {TopweekRecordTracker} from "./TopweekRecordTracker";

const TOPWEEK_POLL_INTERVAL_MS = 60_000;
const SCORE_ENTITIES = [GAME_ENTITIES.APP_STATE, GAME_ENTITIES.PROFILE, GAME_ENTITIES.REPORT, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.RANKINGS];

function refreshPlatform(): void {
	gameServicesStore.refresh().catch((error: unknown): void => {console.warn("Unable to refresh game services:", error);});
}

export function GameServicesLifecycle({authState}: {authState: AuthStateEnum}): null {
	const queryClient = useQueryClient();
	useEffect(() => {
		if (authState !== AuthStateEnum.LOGGED_IN || gameServicesStore.getSnapshot().provider === GAME_SERVICE_PROVIDERS.UNSUPPORTED) return undefined;
		const tracker = new TopweekRecordTracker(gameServicesStore.recordRanking.bind(gameServicesStore));
		refreshPlatform();
		if (AppState.currentState !== "background" && AppState.currentState !== "inactive") tracker.start();
		const interval = setInterval((): void => tracker.refresh(), TOPWEEK_POLL_INTERVAL_MS);
		const unsubscribe = queryClient.getQueryCache().subscribe(event => {
			if (event.type !== "updated" || event.action.type !== "invalidate") return;
			if (SCORE_ENTITIES.some(entity => entity === event.query.queryKey[0])) tracker.refresh();
		});
		const subscription = AppState.addEventListener("change", state => {
			if (state !== "active") {
				tracker.stop();
				return;
			}
			refreshPlatform();
			tracker.start();
		});
		return (): void => {
			tracker.stop();
			clearInterval(interval);
			unsubscribe();
			subscription.remove();
		};
	}, [authState, queryClient]);
	return null;
}