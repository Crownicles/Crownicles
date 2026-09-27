import {PendingReveal} from "ws-packets/src/fromServer/appState/AppStateRes";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {useAppState, useAppStateChange} from "@/src/store/AppState";

export type UnreadRoyalLetter = {id: number; letter: RoyalLetterRes};

/** The oldest letter Core still keeps for the player to read. */
export function firstUnreadLetter(reveals: readonly PendingReveal[]): UnreadRoyalLetter | null {
	const reveal = reveals.find(candidate => candidate.letter !== undefined);
	return reveal?.letter ? {id: reveal.id, letter: reveal.letter} : null;
}

export function useRoyalLetter(): UnreadRoyalLetter | null {
	const state = useAppState();
	return state.status === "ready" ? firstUnreadLetter(state.data.reveals) : null;
}

export function useReadRoyalLetter(): (unread: UnreadRoyalLetter) => void {
	const change = useAppStateChange();
	return unread => change({acknowledged: [unread.id]});
}
