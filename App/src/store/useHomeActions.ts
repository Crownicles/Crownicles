import {useEffect, useRef, useState} from "react";
import {QueryClient, useQueryClient} from "@tanstack/react-query";
import {HomeChestActionReq, HomePlantTransferReq} from "ws-packets/src/fromClient/HomeReq";
import {HomeChestRes, HomePlantTransferRes} from "ws-packets/src/fromServer/home/HomeRes";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {CHEST_ERRORS} from "ws-packets/src/objects/HomeChest";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

export type HomeMutation = {kind: "item"; request: HomeChestActionReq} | {kind: "plant"; request: HomePlantTransferReq};
type HomeActions = {pending: boolean; message: string | null; submit: (action: HomeMutation) => Promise<void>};

function updateChestCache(queryClient: QueryClient, packet: HomeChestRes | HomePlantTransferRes): void {
	queryClient.setQueryData<GameAnswer<HomeChestRes>>(gameKey(GAME_ENTITIES.HOME_CHEST), cached => {
		if ("data" in packet) return {kind: "answer", packet};
		if (cached?.kind !== "answer") return cached;
		return {kind: "answer", packet: {...cached.packet, data: {...cached.packet.data, plantStorage: packet.plantStorage, playerPlantSlots: packet.playerPlantSlots}}};
	});
}

export function useHomeActions(): HomeActions {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return (): void => {active.current = false;};
	}, []);
	const submit = async (action: HomeMutation): Promise<void> => {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setMessage(null);
		try {
			const answer = action.kind === "item"
				? await GameClient.request(action.request, HomeChestRes, [Blocked])
				: await GameClient.request(action.request, HomePlantTransferRes, [Blocked]);
			if (answer.kind !== "answer") {
				if (active.current) setMessage(answer.kind === "rejected" ? commandRejectionMessage(answer.packet.rejection) : i18n.t("app:common.connectionError"));
				return;
			}
			if (!answer.packet.success) {
				if (active.current) setMessage(i18n.t(`app:homeChest.errors.${answer.packet.error ?? CHEST_ERRORS.INVALID}`));
				return;
			}
			updateChestCache(queryClient, answer.packet);
			if (active.current) setMessage(i18n.t(`app:homeChest.done.${action.request.action}`));
			await Promise.all([GAME_ENTITIES.INVENTORY, GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS].map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
			await queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.REPORT), refetchType: "none"});
		}
		catch {
			if (active.current) setMessage(i18n.t("app:common.connectionError"));
		}
		finally {
			inFlight.current = false;
			if (active.current) setPending(false);
		}
	};
	return {pending, message, submit};
}