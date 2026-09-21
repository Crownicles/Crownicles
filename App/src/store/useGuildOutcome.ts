import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {GuildCommandRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GuildCommandOutcome} from "ws-packets/src/objects/Guild";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type GuildOutcomeState = {outcome: GuildCommandOutcome | null; clear: () => void};
export function useGuildOutcome(): GuildOutcomeState {
	const [outcome, setOutcome] = useState<GuildCommandOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<GuildCommandRes>(GuildCommandRes.wireName, packet => {
		// Backing out of a menu is not an event: the player already knows they cancelled.
		setOutcome(packet.outcome.type === "cancelled" ? null : packet.outcome);
		for (const entity of [GAME_ENTITIES.GUILD, GAME_ENTITIES.GUILD_STORAGE, GAME_ENTITIES.SHELTER, GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.PET, GAME_ENTITIES.REPORT]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}