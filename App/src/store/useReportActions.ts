import {useEffect} from "react";
import {QueryClient, useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {ReportCityActionReq, ReportViewReq} from "ws-packets/src/fromClient/ReportViewReq";
import {ReportCityActionRes, ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {REPORT_CITY_ACTION_RESULTS} from "ws-packets/src/objects/ReportView";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GameMutation, useGameMutation} from "@/src/store/useGameMutation";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

const REPORT_UPDATED_ENTITIES = [GAME_ENTITIES.REPORT, GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.MAP];

async function refreshReport(queryClient: QueryClient): Promise<void> {
	await Promise.all(REPORT_UPDATED_ENTITIES.map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
}

export function requestReportView(): Promise<GameAnswer<ReportViewRes>> {
	return GameClient.request(makeFromClientPacket(ReportViewReq, {}), ReportViewRes);
}

export function useReportView(): RequestState<ReportViewRes> {
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<ReportViewRes>(ReportViewRes.wireName, packet => {
		queryClient.setQueryData(gameKey(GAME_ENTITIES.REPORT), (): GameAnswer<ReportViewRes> => ({kind: "answer", packet}));
	}), [queryClient]);
	return useGameQuery(GAME_ENTITIES.REPORT, requestReportView);
}

export function useReportAdvance(): GameMutation<void> {
	const queryClient = useQueryClient();
	return useGameMutation(async (): Promise<string | null> => {
		const answer = await GameClient.request(makeFromClientPacket(ReportReq, {}), ReportTravelSummaryRes, [ReactionCollectorCreation, SmallEventResultRes, Blocked]);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind === "timeout") return i18n.t("app:common.connectionError");
		if (answer.kind === "alternative" && answer.packetName === Blocked.wireName) return i18n.t("app:collector.pending");
		await refreshReport(queryClient);
		return null;
	});
}

export function useReportCityAction(): GameMutation<ReportCityActionReq> {
	const queryClient = useQueryClient();
	return useGameMutation(async (choice: ReportCityActionReq): Promise<string | null> => {
		const answer = await GameClient.request(makeFromClientPacket(ReportCityActionReq, choice), ReportCityActionRes, [Blocked]);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind === "timeout") return i18n.t("app:common.connectionError");
		if (answer.kind === "alternative") return i18n.t("app:collector.pending");
		await refreshReport(queryClient);
		return answer.packet.result === REPORT_CITY_ACTION_RESULTS.STALE ? i18n.t("app:city.staleAction") : null;
	});
}