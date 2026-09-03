import {createContext, ReactNode, useContext, useEffect, useMemo, useRef, useSyncExternalStore} from "react";
import {AppState} from "react-native";
import type {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {useGameInvalidations} from "@/src/store/GameInvalidations";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

type CollectorsState = {
	open: ReactionCollectorCreation[];

	/**
	 * Registers a collector received as the answer to a command. Collectors opened on the server's own
	 * initiative arrive through the pushed packet handlers instead.
	 */
	track: (collector: ReactionCollectorCreation) => void;

	/**
	 * Answers a collector. What the command replies afterwards is not this layer's business: the
	 * result packet is specific to the command and is picked up by its own handler.
	 */
	react: (collectorId: string, reactionIndex: number) => void;

	/** True after a reaction has been sent and until the server closes the collector. */
	isAnswerPending: (collectorId: string) => boolean;
};

const CollectorsContext = createContext<CollectorsState | null>(null);

/**
 * Holds the collectors the player can currently answer.
 *
 * A collector outlives the screen that triggered it: it survives a navigation, and the server may
 * open one without being asked. Keeping them here rather than in a screen is what makes both cases
 * work with the same code.
 */
export function CollectorsProvider({ children, authState }: { children: ReactNode; authState?: AuthStateEnum }): ReactNode {
	const { afterCollector } = useGameInvalidations();
	const previousAuthState = useRef<AuthStateEnum>(AuthStateEnum.NOT_READY);
	const open = useSyncExternalStore(collectorsStore.subscribe, collectorsStore.getSnapshot, collectorsStore.getSnapshot);

	useEffect(() => collectorsStore.subscribeToResolution(afterCollector), [afterCollector]);

	useEffect(() => {
		const hasConnected = authState === AuthStateEnum.LOGGED_IN
			&& previousAuthState.current !== AuthStateEnum.LOGGED_IN;
		if (authState !== undefined) {
			previousAuthState.current = authState;
		}
		if (hasConnected) {
			collectorsStore.syncCurrent();
		}
	}, [authState]);

	useEffect(() => {
		collectorsStore.removeExpired();
		const subscription = AppState.addEventListener("change", nextState => {
			if (nextState === "active") {
				collectorsStore.removeExpired();
			}
		});

		return (): void => subscription.remove();
	}, []);

	const value = useMemo(() => ({
		open,
		track: collectorsStore.track,
		react: collectorsStore.react,
		isAnswerPending: collectorsStore.isAnswerPending
	}), [open]);

	return <CollectorsContext.Provider value={value}>{children}</CollectorsContext.Provider>;
}

export function useCollectors(): CollectorsState {
	const context = useContext(CollectorsContext);
	if (!context) {
		throw new Error("useCollectors used outside of CollectorsProvider");
	}
	return context;
}
