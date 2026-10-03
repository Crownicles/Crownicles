import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";

/** The player's own guild, one query shared by every screen that needs it. */
export function useOwnGuild(): RequestState<GuildRes> {
	return useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
}

/** Any guild, looked up by its public name. */
export function useNamedGuild(name: string): RequestState<GuildRes> {
	return useGameQuery(
		GAME_ENTITIES.GUILD,
		() => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}, askedGuildName: name}), GuildRes),
		name
	);
}
