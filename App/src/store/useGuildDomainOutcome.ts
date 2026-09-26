import {useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {GuildDomainRes} from "ws-packets/src/fromServer/guild/GuildDomainRes";
import {GuildDomainOutcome} from "ws-packets/src/objects/GuildDomain";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

type DomainOutcomeState = {outcome: GuildDomainOutcome | null; clear: () => void};
export function useGuildDomainOutcome(): DomainOutcomeState {
	const [outcome, setOutcome] = useState<GuildDomainOutcome | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<GuildDomainRes>(GuildDomainRes.wireName, packet => {
		setOutcome(packet.outcome);
		for (const entity of [GAME_ENTITIES.GUILD_DOMAIN, GAME_ENTITIES.GUILD_STORAGE, GAME_ENTITIES.GUILD, GAME_ENTITIES.PROFILE, GAME_ENTITIES.SHELTER, GAME_ENTITIES.MISSIONS]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}), [queryClient]);
	return {outcome, clear: (): void => setOutcome(null)};
}
