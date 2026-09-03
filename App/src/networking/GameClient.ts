import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {FromServerPacketLike} from "ws-packets/src/MakePackets";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AppConstants} from "@/src/AppConstants";

/**
 * What a request came back with.
 *
 * A command rarely answers a single packet: asking for a pet answers either the pet or the fact that
 * there is none. Naming the alternative rather than treating it as a failure keeps screens honest
 * about the empty state.
 */
export type GameAnswer<Answer extends FromServerPacket> =
	| { kind: "answer"; packet: Answer }
	| { kind: "alternative"; packetName: string }
	| { kind: "timeout" };

/**
 * The only place that knows how a request reaches the server.
 *
 * Screens depend on this rather than on the socket, so they can be rendered against a fake client,
 * and so a change of transport stays here.
 */
export class GameClient {
	/**
	 * Sends a request and resolves with the first expected answer.
	 * @param request Packet to send
	 * @param expected Packet the caller wants
	 * @param alternatives Other answers the command may legitimately give, such as an empty result
	 */
	public static request<Answer extends FromServerPacket>(
		request: FromClientPacket,
		expected: FromServerPacketLike<Answer>,
		alternatives: FromServerPacketLike<FromServerPacket>[] = []
	): Promise<GameAnswer<Answer>> {
		return new Promise(resolve => {
			const handlers: { [packetName: string]: (packet: never) => void } = {
				[expected.name]: (packet: Answer): void => resolve({ kind: "answer", packet })
			};
			for (const alternative of alternatives) {
				handlers[alternative.name] = (): void => resolve({ kind: "alternative", packetName: alternative.name });
			}

			WebSocketClient.getInstance().sendPacket(request, handlers, {
				time: AppConstants.PACKET_TIMEOUT,
				callback: (): void => resolve({ kind: "timeout" })
			});
		});
	}
}
