import {useAdventureBusy} from "@/src/components/UnlockCelebration";
import {useJourney} from "@/src/journey/useJourney";

/** A toast waits for the adventure to finish its story and for any unlock to be announced first. */
export function useToastTurn(): boolean {
	const busy = useAdventureBusy();
	const {unannounced} = useJourney();
	return !busy && unannounced === null;
}
