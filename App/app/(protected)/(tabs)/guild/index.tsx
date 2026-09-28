import {ReactNode} from "react";
import {useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {GuildOverview} from "@/src/components/Guild";
import {GuildAbsent} from "@/src/components/GuildAbsent";
import {Screen} from "@/src/design/Primitives";

export default function Guild(): ReactNode {
	const router = useRouter();
	const state = useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.foundGuild && data.data
		? <GuildOverview guild={data.data} onPage={(page): void => router.push(`/guild/${page}`)} />
		: <GuildAbsent />}</GameQueryContent></Screen>;
}
