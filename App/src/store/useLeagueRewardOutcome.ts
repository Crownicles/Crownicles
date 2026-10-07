import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {LeagueRewardRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {LeagueRewardOutcome} from "ws-packets/src/objects/Rankings";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type LeagueOutcomeState = {outcome: LeagueRewardOutcome | null; clear: () => void};
export function useLeagueRewardOutcome(): LeagueOutcomeState {
	const [outcome, setOutcome] = useState<LeagueRewardOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<LeagueRewardRes>(LeagueRewardRes.wireName, packet => {
		setOutcome(packet.outcome);
		if (packet.outcome.type !== "success") return;
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.LEAGUES, GAME_ENTITIES.RANKINGS]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}
