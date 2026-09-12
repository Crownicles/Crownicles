import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GuildCreation, GuildManagement, GuildOverview, GuildPage, GuildStorage} from "@/src/components/Guild";
import {GuildShelter} from "@/src/components/PetManagement";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {DetailScreen} from "@/src/design/DetailScreen";
import {i18n} from "@/src/translations/i18n";

export default function Guild(): ReactNode {
	const [page, setPage] = useState<GuildPage>("overview");
	const state = useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
	if (page === "manage" && state.status === "ready" && state.data.data) return <DetailScreen title={i18n.t("app:guild.pages.manage")} eyebrow={i18n.t("app:guild.eyebrow")} onClose={(): void => setPage("overview")}>
		<GuildManagement guild={state.data.data} />
	</DetailScreen>;
	if (page === "storage" || page === "shelter") return <DetailScreen title={i18n.t(`app:guild.pages.${page}`)} eyebrow={i18n.t("app:guild.eyebrow")} onClose={(): void => setPage("overview")}>
		{page === "storage" ? <GuildStorage /> : <GuildShelter />}
	</DetailScreen>;
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => {
		if (data.foundGuild && data.data) return <GuildOverview guild={data.data} onPage={setPage} />;
		return <>
			<Hero eyebrow={i18n.t("app:guild.eyebrow")} title={i18n.t("app:guild.noGuild")} />
			<Note>{i18n.t("app:guild.joinHint")}</Note>
			{page === "create" ? <GuildCreation /> : <ButtonRow><Button variant="primary" onPress={(): void => setPage("create")}>{i18n.t("app:guild.create")}</Button></ButtonRow>}
		</>;
	}}</GameQueryContent></Screen>;
}
