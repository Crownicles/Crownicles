import {ReactNode, useEffect, useState, useSyncExternalStore} from "react";
import {AppState, Modal, ModalProps} from "react-native";

/** How long a window may take to appear or go before the next one stops waiting for the platform to say so. */
const TRANSITION_TIMEOUT_MS = 1_000;

/** A window removed from the tree never reports its dismissal: the next one waits for its animation instead. */
const REMOVAL_TRANSITION_MS = 500;

type WindowState = "idle" | "waiting" | "shown";

/** What a window needs from the coordinator: a place in line, and a turn at the platform's transitions. */
type WindowTurns = {
	enqueue: (window: NativeWindowLife) => void;
	dequeue: (window: NativeWindowLife) => void;
	start: (timeoutMs?: number) => () => void;
};

/** What one window is going through, kept outside React so the platform callbacks can settle it. */
class NativeWindowLife {
	private state: WindowState = "idle";
	private appearing: (() => void) | null = null;
	private leaving: (() => void) | null = null;

	public constructor(private readonly turns: WindowTurns) {}

	public readonly isShown = (): boolean => this.state === "shown";

	public ask(): void {
		if (this.state !== "idle") return;
		this.state = "waiting";
		this.turns.enqueue(this);
	}

	/** Its turn has come: it is on screen before anyone is told, so every reader sees it there. */
	public appear(): void {
		this.state = "shown";
		this.appearing = this.turns.start();
	}

	/** Whether the window was asked away before it ever came: there is then no dismissal to wait for. */
	public withdraw(): boolean {
		if (this.state === "waiting") {
			this.turns.dequeue(this);
			this.state = "idle";
			return true;
		}
		if (this.state === "shown") {
			this.appeared();
			this.state = "idle";
			this.leaving = this.turns.start();
		}
		return false;
	}

	public appeared(): void {
		this.appearing?.();
		this.appearing = null;
	}

	public left(): void {
		this.leaving?.();
		this.leaving = null;
	}

	public removed(): void {
		const shown = this.state === "shown";
		this.withdraw();
		this.left();
		if (shown) this.turns.start(REMOVAL_TRANSITION_MS);
	}
}

/**
 * UIKit runs one window transition at a time, and only from the active scene. A window asked for while
 * another one appears or leaves, or while the app wakes up from a notification, is lost and leaves an
 * invisible layer that swallows every touch. Every native window of the app waits its turn here.
 */
class WindowTransitions implements WindowTurns {
	private running = 0;
	private readonly queue: NativeWindowLife[] = [];
	private readonly listeners = new Set<() => void>();

	public constructor() {
		AppState.addEventListener("change", () => this.grant());
	}

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly enqueue = (window: NativeWindowLife): void => {
		this.queue.push(window);
		this.grant();
	};

	public readonly dequeue = (window: NativeWindowLife): void => {
		const position = this.queue.indexOf(window);
		if (position >= 0) this.queue.splice(position, 1);
	};

	/** Holds the other windows back until the returned callback runs, or until the platform has had time enough. */
	public readonly start = (timeoutMs = TRANSITION_TIMEOUT_MS): (() => void) => {
		this.running++;
		this.emit();
		const transition: {ended: boolean; timer?: ReturnType<typeof setTimeout>} = {ended: false};
		const end = (): void => {
			if (transition.ended) return;
			transition.ended = true;
			clearTimeout(transition.timer);
			this.running--;
			this.grant();
		};
		transition.timer = setTimeout(end, timeoutMs);
		return end;
	};

	/** The windows appear in the order they were asked for, one transition at a time, only in the foreground. */
	private grant(): void {
		const next = AppState.currentState === "active" && this.running === 0 ? this.queue.shift() : undefined;
		if (next) next.appear();
		else this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

const windowTransitions = new WindowTransitions();

/**
 * The one way the app opens a native window. It appears once the app is active and no other window is
 * appearing or leaving, then stays until it is asked away: it never disappears because another one waits.
 */
export function NativeWindow({visible = true, onShow, onDismiss, ...props}: ModalProps): ReactNode {
	const [life] = useState(() => new NativeWindowLife(windowTransitions));
	const shown = useSyncExternalStore(windowTransitions.subscribe, life.isShown, life.isShown);
	useEffect(() => {
		if (visible) life.ask();
		else if (life.withdraw()) onDismiss?.();
	}, [life, visible, onDismiss]);
	useEffect(() => () => life.removed(), [life]);
	return <Modal
		{...props}
		visible={shown}
		onShow={(event): void => {
			life.appeared();
			onShow?.(event);
		}}
		onDismiss={(): void => {
			life.left();
			onDismiss?.();
		}}
	/>;
}
