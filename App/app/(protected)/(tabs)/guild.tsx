import {ReactNode, useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GuildReq} from "ws-packets/src/fromClient/GuildReq";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {GuildCreation, GuildManagement, GuildOverview, GuildPage, GuildStorage} from "@/src/components/Guild";
import {GuildShelter} from "@/src/components/PetManagement";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {DetailScreen} from "@/src/design/DetailScreen";
import {i18n} from "@/src/translations/i18n";

function GuildPageContent({page, state, onPage}: {page: GuildPage; state: RequestState<GuildRes>; onPage: (page: GuildPage) => void}): ReactNode {
	if (page === "storage" || page === "shelter") return <DetailScreen title={i18n.t(`app:guild.pages.${page}`)} eyebrow={i18n.t("app:guild.eyebrow")} onClose={(): void => onPage("overview")}>
		{page === "storage" ? <GuildStorage /> : <GuildShelter />}
	</DetailScreen>;
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => {
		if (data.foundGuild && data.data) return <GuildOverview guild={data.data} onPage={onPage} />;
		return <>
			<Hero eyebrow={i18n.t("app:guild.eyebrow")} title={i18n.t("app:guild.noGuild")} />
			<Note>{i18n.t("app:guild.joinHint")}</Note>
			{page === "create" ? <GuildCreation /> : <ButtonRow><Button variant="primary" onPress={(): void => onPage("create")}>{i18n.t("app:guild.create")}</Button></ButtonRow>}
		</>;
	}}</GameQueryContent></Screen>;
}

export default function Guild(): ReactNode {
	const [page, setPage] = useState<GuildPage>("overview");
	const state = useGameQuery(GAME_ENTITIES.GUILD, () => GameClient.request(makeFromClientPacket(GuildReq, {askedPlayer: {}}), GuildRes));
	const guild = state.status === "ready" ? state.data.data : undefined;
	if (page === "manage" && guild) return <DetailScreen title={i18n.t("app:guild.pages.manage")} eyebrow={i18n.t("app:guild.eyebrow")} onClose={(): void => setPage("overview")}>
		<GuildManagement guild={guild} />
	</DetailScreen>;
	return <GuildPageContent page={page} state={state} onPage={setPage} />;
}
