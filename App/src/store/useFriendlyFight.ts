import {
	useEffect, useRef, useState
} from "react";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import { FriendlyFightReq } from "ws-packets/src/fromClient/FightReq";
import {
	FightIntroductionRes, FriendlyFightErrorRes
} from "ws-packets/src/fromServer/fight/FightRes";
import { Blocked } from "ws-packets/src/fromServer/common/Blocked";
import {
	GameAnswer, GameClient
} from "@/src/networking/GameClient";
import { fightStore } from "@/src/store/FightStore";
import { commandRejectionMessage } from "@/src/display/CommandRejection";
import { i18n } from "@/src/translations/i18n";

export type FriendlyFightState = {
	pending: boolean;

	/** Why the fight did not start, shown where it was asked for. */
	message: string | null;
	start: (playerRef: string) => Promise<void>;
};

/** The fight itself opens on its introduction, through the fight store: only a refusal stays here. */
function refusalOf(answer: GameAnswer<FightIntroductionRes>): string | null {
	switch (answer.kind) {
		case "answer":
			return null;
		case "rejected":
			return commandRejectionMessage(answer.packet.rejection);
		case "timeout":
			return i18n.t("app:common.connectionError");
		default:
			return answer.packetName === FriendlyFightErrorRes.wireName
				? i18n.t(`app:friendlyFight.errors.${(answer.packet as FriendlyFightErrorRes).error}`)
				: i18n.t("app:collector.pending");
	}
}

export function useFriendlyFight(): FriendlyFightState {
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const inFlight = useRef(false);
	const active = useRef(true);

	useEffect(() => {
		active.current = true;
		return (): void => {
			active.current = false;
		};
	}, []);

	const start = async (playerRef: string): Promise<void> => {
		if (inFlight.current) {
			return;
		}
		inFlight.current = true;
		setPending(true);
		setMessage(null);
		fightStore.reset();
		let refusal: string | null;
		try {
			refusal = refusalOf(await GameClient.request(makeFromClientPacket(FriendlyFightReq, { playerRef }), FightIntroductionRes, [FriendlyFightErrorRes, Blocked]));
		}
		catch {
			refusal = i18n.t("app:common.connectionError");
		}
		inFlight.current = false;
		if (active.current) {
			setMessage(refusal);
			setPending(false);
		}
	};

	return {
		pending, message, start
	};
}
