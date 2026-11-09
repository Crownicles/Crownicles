import { useSyncExternalStore } from "react";
import { PendingReveal } from "ws-packets/src/fromServer/appState/AppStateRes";
import { Badge } from "ws-packets/src/objects/Badge";
import { BossRecord } from "ws-packets/src/objects/Fight";
import { ItemWithDetails } from "ws-packets/src/objects/ItemWithDetails";

export const MEMORABLE_MOMENT_KINDS = {
	BADGE: "badge",
	MYTHIC_ITEM: "mythicItem",
	BOSS_RECORD: "bossRecord"
} as const;

export type MemorableMoment = { at: number } & (
	| {
		kind: typeof MEMORABLE_MOMENT_KINDS.BADGE; badge: Badge; owned: number; total: number;
	}
	| {
		kind: typeof MEMORABLE_MOMENT_KINDS.MYTHIC_ITEM; item: ItemWithDetails; revealId: number;
	}
	| {
		kind: typeof MEMORABLE_MOMENT_KINDS.BOSS_RECORD; record: BossRecord; revealId: number;
	}
);

/** How many badges the player owns once the new ones count, out of all those that can be won. */
export type BadgeProgress = {
	owned: number; total: number;
};

function momentOfReveal(reveal: PendingReveal): MemorableMoment | null {
	const memorable = reveal.memorable;
	if (memorable?.mythicItem) {
		return {
			kind: MEMORABLE_MOMENT_KINDS.MYTHIC_ITEM, item: memorable.mythicItem, revealId: reveal.id, at: memorable.at
		};
	}
	if (memorable?.bossRecord) {
		return {
			kind: MEMORABLE_MOMENT_KINDS.BOSS_RECORD, record: memorable.bossRecord, revealId: reveal.id, at: memorable.at
		};
	}
	return null;
}

/** The moments worth sharing, shown one after the other once the game has nothing else to tell. */
class MemorableMomentStore {
	private queue: MemorableMoment[] = [];

	/** Core lists a moment until the acknowledgement lands: a refresh in between must not queue it twice. */
	private readonly announcedBadges = new Set<Badge>();

	private readonly announcedReveals = new Set<number>();

	private readonly listeners = new Set<() => void>();

	public readonly subscribe = (listener: () => void): () => void => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): MemorableMoment | null => this.queue[0] ?? null;

	public readonly dismiss = (): void => {
		if (this.queue.length === 0) {
			return;
		}
		this.queue = this.queue.slice(1);
		this.notify();
	};

	/** Queues the badges no device of the player has celebrated yet, each once per session. */
	public readonly announceBadges = (badges: readonly Badge[], progress: BadgeProgress): void => {
		for (const badge of badges.filter(candidate => !this.announcedBadges.has(candidate))) {
			this.announcedBadges.add(badge);
			this.add({
				kind: MEMORABLE_MOMENT_KINDS.BADGE, badge, ...progress, at: Date.now()
			});
		}
	};

	/** Queues the mythical finds and boss records Core keeps for the app, each once per session. */
	public readonly announceReveals = (reveals: readonly PendingReveal[]): void => {
		for (const reveal of reveals.filter(candidate => !this.announcedReveals.has(candidate.id))) {
			const moment = momentOfReveal(reveal);
			if (!moment) {
				continue;
			}
			this.announcedReveals.add(reveal.id);
			this.add(moment);
		}
	};

	private add(moment: MemorableMoment): void {
		this.queue = [...this.queue, moment];
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export const memorableMomentStore = new MemorableMomentStore();

export function useMemorableMoment(): MemorableMoment | null {
	return useSyncExternalStore(memorableMomentStore.subscribe, memorableMomentStore.getSnapshot, memorableMomentStore.getSnapshot);
}
