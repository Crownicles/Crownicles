import {ReactNode} from "react";
import {useRouter} from "expo-router";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOwnGuild} from "@/src/store/useGuild";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {GuildOverview} from "@/src/components/Guild";
import {GuildAbsent} from "@/src/components/GuildAbsent";
import {Screen} from "@/src/design/Primitives";

export default function Guild(): ReactNode {
	const router = useRouter();
	const state = useOwnGuild();
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.foundGuild && data.data
		? <GuildOverview guild={data.data} onPage={(page): void => router.push(`/guild/${page}`)} />
		: <GuildAbsent />}</GameQueryContent></Screen>;
}
