import {useEffect, useRef, useState} from "react";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {GameAnswer} from "@/src/networking/GameClient";

export type RequestState<Answer extends FromServerPacket> =
	| { status: "loading" }
	| { status: "ready"; data: Answer }
	| { status: "empty"; packetName: string }
	| { status: "failed" };

function toState<Answer extends FromServerPacket>(answer: GameAnswer<Answer>): RequestState<Answer> {
	switch (answer.kind) {
		case "answer":
			return { status: "ready", data: answer.packet };
		case "alternative":
			return { status: "empty", packetName: answer.packetName };
		default:
			return { status: "failed" };
	}
}

/**
 * Runs a game request once and exposes the states a screen has to render: loading, content, empty
 * and failure. Screens never touch the socket, so they can be exercised with a stubbed request.
 * @param run Performs the request
 */
export function useGameRequest<Answer extends FromServerPacket>(run: () => Promise<GameAnswer<Answer>>): RequestState<Answer> {
	const [state, setState] = useState<RequestState<Answer>>({ status: "loading" });

	// Captured once: the request runs on mount, so later renders must not restart it
	const initialRun = useRef(run);

	useEffect(() => {
		let abandoned = false;

		initialRun.current().then(answer => {
			if (!abandoned) {
				setState(toState(answer));
			}
		});

		return (): void => {
			abandoned = true;
		};
	}, []);

	return state;
}
