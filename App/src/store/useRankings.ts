import {useQuery} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {TopReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopRes, TopEmptyRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameRequestTimeout, RequestState} from "@/src/store/useGameQuery";
import {gameServicesStore} from "@/src/gameServices/GameServices";

export type RankingSelection = Pick<TopReq, "dataType" | "timing" | "page">;

/** A board nobody entered yet is still a board: shown empty, with the fights the player still owes, rather than as missing data. */
function emptyBoard(selection: RankingSelection, packet: TopEmptyRes): TopRes {
	return Object.assign(new TopRes(), {
		dataType: selection.dataType,
		timing: selection.timing,
		canBeRanked: true,
		elements: [],
		totalElements: 0,
		elementsPerPage: 1,
		pageNumber: 1,
		...packet.needFight === undefined ? {} : {needFight: packet.needFight}
	});
}

type RankingAnswer = Exclude<GameAnswer<TopRes>, {kind: "timeout"}>;

async function fetchRankings(selection: RankingSelection): Promise<RankingAnswer> {
	const answer = await GameClient.request(makeFromClientPacket<TopReq>(TopReq, selection), TopRes, [TopEmptyRes]);
	if (answer.kind === "timeout") throw new GameRequestTimeout();
	if (answer.kind === "answer") gameServicesStore.recordRanking(answer.packet).catch((error: unknown): void => {console.warn("Unable to record the topweek score:", error);});
	return answer;
}

function rankingState(selection: RankingSelection, answer: RankingAnswer): RequestState<TopRes> {
	if (answer.kind === "rejected") return {status: "failed", rejection: answer.packet.rejection};
	if (answer.kind === "alternative") return {status: "ready", data: emptyBoard(selection, answer.packet as TopEmptyRes)};
	return {status: "ready", data: answer.packet};
}

export function useRankings(selection: RankingSelection): RequestState<TopRes> {
	const query = useQuery({
		queryKey: [GAME_ENTITIES.RANKINGS, selection],
		queryFn: () => fetchRankings(selection)
	});
	if (query.isPending) return {status: "loading"};
	if (query.isError) return {status: "failed"};
	return rankingState(selection, query.data);
}
