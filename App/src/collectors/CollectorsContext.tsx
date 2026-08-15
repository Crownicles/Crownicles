import {createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorStop} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {WebSocketClient} from "@/src/networking/WebSocketClient";

type CollectorsState = {
	open: ReactionCollectorCreation[];

	/**
	 * Registers a collector received as the answer to a command. Collectors opened on the server's own
	 * initiative arrive through the pushed packet handlers instead.
	 */
	track: (collector: ReactionCollectorCreation) => void;

	/**
	 * Answers a collector. What the command replies afterwards is not this layer's business: the
	 * result packet is specific to the command and is picked up by its own handler.
	 */
	react: (collectorId: string, reactionIndex: number) => void;
};

const CollectorsContext = createContext<CollectorsState | null>(null);

/**
 * Holds the collectors the player can currently answer.
 *
 * A collector outlives the screen that triggered it: it survives a navigation, and the server may
 * open one without being asked. Keeping them here rather than in a screen is what makes both cases
 * work with the same code.
 */
export function CollectorsProvider({ children }: { children: ReactNode }): ReactNode {
	const [open, setOpen] = useState<ReactionCollectorCreation[]>([]);
	const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	const forget = useCallback((collectorId: string): void => {
		const timer = timers.current.get(collectorId);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(collectorId);
		}
		setOpen(collectors => collectors.filter(collector => collector.id !== collectorId));
	}, []);

	const track = useCallback((collector: ReactionCollectorCreation): void => {
		setOpen(collectors => (collectors.some(open => open.id === collector.id) ? collectors : [...collectors, collector]));

		/*
		 * The server does announce the end, but on the packet id of the request that opened the
		 * collector, whose handler is long gone by then. The absolute end time is what makes the app
		 * able to drop it on its own.
		 */
		timers.current.set(collector.id, setTimeout(() => forget(collector.id), Math.max(0, collector.endTime - Date.now())));
	}, [forget]);

	useEffect(() => {
		const client = WebSocketClient.getInstance();
		client.setGlobalPacketHandler(ReactionCollectorCreation.name, (packet: ReactionCollectorCreation) => track(packet));
		client.setGlobalPacketHandler(ReactionCollectorStop.name, (packet: ReactionCollectorStop) => forget(packet.collectorId));
	}, [track, forget]);

	const react = useCallback((collectorId: string, reactionIndex: number): void => {
		forget(collectorId);
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(ReactionCollectorReactReq, {
			collectorId,
			reactionIndex
		}), {});
	}, [forget]);

	const value = useMemo(() => ({
		open,
		track,
		react
	}), [open, track, react]);

	return <CollectorsContext.Provider value={value}>{children}</CollectorsContext.Provider>;
}

export function useCollectors(): CollectorsState {
	const context = useContext(CollectorsContext);
	if (!context) {
		throw new Error("useCollectors used outside of CollectorsProvider");
	}
	return context;
}
