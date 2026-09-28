import {useAdventureBusy} from "@/src/components/UnlockCelebration";
import {useJourney} from "@/src/journey/useJourney";
import {useMissionRewards} from "@/src/store/MissionRewardsStore";

/** A toast waits for the adventure to finish its story and for any unlock to be announced first. */
export function useToastTurn(): boolean {
	const busy = useAdventureBusy();
	const {unannounced} = useJourney();
	return !busy && unannounced === null;
}

/** An announcement of lesser weight also lets the mission toast go first. */
export function useAnnouncementTurn(): boolean {
	const myTurn = useToastTurn();
	const {unannounced: missionsToAnnounce} = useMissionRewards();
	return myTurn && missionsToAnnounce === 0;
}
