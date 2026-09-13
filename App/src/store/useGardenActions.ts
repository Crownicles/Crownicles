import {useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {GardenActionReq} from "ws-packets/src/fromClient/GardenReq";
import {GardenRes} from "ws-packets/src/fromServer/home/GardenRes";
import {GardenOperation, GardenOutcome} from "ws-packets/src/objects/Garden";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {GameMutation, useGameMutation} from "@/src/store/useGameMutation";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

type GardenActions = GameMutation<GardenOperation> & {outcome: GardenOutcome | null};

export function useGardenActions(): GardenActions {
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<GardenOutcome | null>(null);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return (): void => {active.current = false;};
	}, []);
	const mutation = useGameMutation(async (operation: GardenOperation): Promise<string | null> => {
		const answer = await GameClient.request(makeFromClientPacket(GardenActionReq, {operation}), GardenRes);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind !== "answer") return i18n.t("app:common.connectionError");
		if (active.current) setOutcome(answer.packet.outcome);
		await Promise.all([GAME_ENTITIES.GARDEN, GAME_ENTITIES.HOME_CHEST, GAME_ENTITIES.INVENTORY, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.PROFILE].map(entity => queryClient.invalidateQueries({queryKey: gameKey(entity)})));
		return null;
	});
	return {...mutation, outcome};
}