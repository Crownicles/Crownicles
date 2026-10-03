import {QueryClient, useQueryClient} from "@tanstack/react-query";
import {HomeChestActionReq, HomePlantTransferReq} from "ws-packets/src/fromClient/HomeReq";
import {HomeChestRes, HomePlantTransferRes} from "ws-packets/src/fromServer/home/HomeRes";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {CHEST_ERRORS} from "ws-packets/src/objects/HomeChest";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";
import {GameMutation, useGameMutation} from "@/src/store/useGameMutation";

export type HomeMutation = {kind: "item"; request: HomeChestActionReq} | {kind: "plant"; request: HomePlantTransferReq};

function updateChestCache(queryClient: QueryClient, packet: HomeChestRes | HomePlantTransferRes): void {
	queryClient.setQueryData<GameAnswer<HomeChestRes>>(gameKey(GAME_ENTITIES.HOME_CHEST), cached => {
		if ("data" in packet) return {kind: "answer", packet};
		if (cached?.kind !== "answer") return cached;
		return {kind: "answer", packet: {...cached.packet, data: {...cached.packet.data, plantStorage: packet.plantStorage, playerPlantSlots: packet.playerPlantSlots}}};
	});
}

export function useHomeActions(): GameMutation<HomeMutation> {
	const queryClient = useQueryClient();
	return useGameMutation(async (action: HomeMutation): Promise<string | null> => {
		const answer = action.kind === "item"
			? await GameClient.request(action.request, HomeChestRes, [Blocked])
			: await GameClient.request(action.request, HomePlantTransferRes, [Blocked]);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind !== "answer") return i18n.t("app:common.connectionError");
		if (!answer.packet.success) return i18n.t(`app:homeChest.errors.${answer.packet.error ?? CHEST_ERRORS.INVALID}`);
		updateChestCache(queryClient, answer.packet);
		await Promise.all([GAME_ENTITIES.INVENTORY, GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS].map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
		await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.REPORT), refetchType: "none"});
		return i18n.t(`app:homeChest.done.${action.request.action}`);
	});
}