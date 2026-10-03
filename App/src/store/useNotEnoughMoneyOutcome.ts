import {useEffect, useState} from "react";
import {NotEnoughMoneyRes} from "ws-packets/src/fromServer/common/NotEnoughMoneyRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type NotEnoughMoneyState = {outcome: NotEnoughMoneyRes | null; clear: () => void};

/** A purchase the server refused for lack of money, told to the player instead of silently dropped. */
export function useNotEnoughMoneyOutcome(): NotEnoughMoneyState {
	const [outcome, setOutcome] = useState<NotEnoughMoneyRes | null>(null);
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<NotEnoughMoneyRes>(NotEnoughMoneyRes.wireName, packet => setOutcome(packet)), []);
	return {outcome, clear: (): void => setOutcome(null)};
}
