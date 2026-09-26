import {useEffect, useRef, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PetCaressReq, PetNickReq} from "ws-packets/src/fromClient/PetCareReq";
import {PetCaressRes, PetNickRes} from "ws-packets/src/fromServer/pet/PetCareRes";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

type PetCareAction = {type: "caress"} | {type: "rename"; nickname: string};
export type PetActions = {pending: boolean; message: string | null; care: (action: PetCareAction) => Promise<boolean>};
function requestCare(action: PetCareAction): Promise<GameAnswer<PetCaressRes | PetNickRes>> {
	if (action.type === "caress") return GameClient.request(makeFromClientPacket(PetCaressReq, {}), PetCaressRes, [Blocked]);
	return GameClient.request(makeFromClientPacket(PetNickReq, {newNickname: action.nickname}), PetNickRes, [Blocked]);
}

function careFailure(answer: Exclude<GameAnswer<PetCaressRes | PetNickRes>, {kind: "answer"}>): string {
	if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
	return i18n.t(answer.kind === "alternative" ? "app:collector.pending" : "app:common.connectionError");
}

/** A caress says itself through the pet's own reaction, so it leaves no line of text behind. */
function careResult(packet: PetCaressRes | PetNickRes): string | null {
	if (!("foundPet" in packet)) return null;
	if (!packet.foundPet) return i18n.t("app:pet.noPet");
	if (!packet.nickNameIsAcceptable) return i18n.t("app:pet.care.invalidNickname");
	return packet.newNickname ? i18n.t("app:pet.care.renamed", {nickname: packet.newNickname}) : i18n.t("app:pet.care.cleared");
}

function careSucceeded(packet: PetCaressRes | PetNickRes): boolean {
	if (!("foundPet" in packet)) return true;
	return Boolean(packet.foundPet && packet.nickNameIsAcceptable);
}

export function usePetActions(): PetActions {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return (): void => {active.current = false;};
	}, []);
	const care = async (action: PetCareAction): Promise<boolean> => {
		if (inFlight.current) return false;
		inFlight.current = true;
		setPending(true);
		try {
			const answer = await requestCare(action);
			if (answer.kind !== "answer") {
				if (active.current) setMessage(careFailure(answer));
				return false;
			}
			for (const entity of [GAME_ENTITIES.PET, GAME_ENTITIES.PROFILE, GAME_ENTITIES.MISSIONS]) {
				await queryClient.invalidateQueries({queryKey: gameKey(entity)});
			}
			if (active.current) setMessage(careResult(answer.packet));
			return careSucceeded(answer.packet);
		}
		catch {
			if (active.current) setMessage(i18n.t("app:common.connectionError"));
			return false;
		}
		finally {
			inFlight.current = false;
			if (active.current) setPending(false);
		}
	};
	return {pending, message, care};
}