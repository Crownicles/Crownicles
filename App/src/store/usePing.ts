import {useState} from "react";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PingReq} from "ws-packets/src/fromClient/PingReq";
import {PingRes} from "ws-packets/src/fromServer/ping/PingRes";
import {GameClient} from "@/src/networking/GameClient";

export type Ping = {
	pending: boolean;

	/** The last round trip to the server, in milliseconds; nothing until measured, or when it timed out. */
	latency: number | null;
	measure: () => void;
};

/** A round trip to the server, measured on demand from the developer settings. */
export function usePing(): Ping {
	const [pending, setPending] = useState(false);
	const [latency, setLatency] = useState<number | null>(null);
	const measure = (): void => {
		setPending(true);
		setLatency(null);
		const time = Date.now();
		GameClient.request(makeFromClientPacket(PingReq, {time}), PingRes)
			.then(answer => setLatency(answer.kind === "answer" ? Date.now() - time : null))
			.finally(() => setPending(false));
	};
	return {pending, latency, measure};
}
