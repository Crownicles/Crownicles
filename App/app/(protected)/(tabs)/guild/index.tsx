import {ReactNode, useState} from "react";
import {useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {GuildCreation, GuildOverview} from "@/src/components/Guild";
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

export default function Guild(): ReactNode {
	const router = useRouter();
	const [creating, setCreating] = useState(false);
	const state = useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => {
		if (data.foundGuild && data.data) return <GuildOverview guild={data.data} onPage={(page): void => router.push(`/guild/${page}`)} />;
		return <>
			<Hero eyebrow={i18n.t("app:guild.eyebrow")} title={i18n.t("app:guild.noGuild")} />
			<Note>{i18n.t("app:guild.joinHint")}</Note>
			{creating ? <GuildCreation /> : <ButtonRow><Button variant="primary" onPress={(): void => setCreating(true)}>{i18n.t("app:guild.create")}</Button></ButtonRow>}
		</>;
	}}</GameQueryContent></Screen>;
}
