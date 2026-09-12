import {useQuery} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {TopReq} from "ws-packets/src/fromClient/RankingsReq";
import {TopRes, TopEmptyRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameRequestTimeout, RequestState} from "@/src/store/useGameQuery";

export type RankingSelection = Pick<TopReq, "dataType" | "timing" | "page">;

export function useRankings(selection: RankingSelection): RequestState<TopRes> {
	const query = useQuery({
		queryKey: [GAME_ENTITIES.RANKINGS, selection],
		queryFn: async () => {
			const answer = await GameClient.request(makeFromClientPacket<TopReq>(TopReq, selection), TopRes, [TopEmptyRes]);
			if (answer.kind === "timeout") throw new GameRequestTimeout();
			return answer;
		}
	});
	if (query.isPending) return {status: "loading"};
	if (query.isError) return {status: "failed"};
	if (query.data.kind === "rejected") return {status: "failed", rejection: query.data.packet.rejection};
	return query.data.kind === "answer" ? {status: "ready", data: query.data.packet} : {status: "empty", packetName: query.data.packetName};
}
