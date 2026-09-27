import {useEffect, useSyncExternalStore} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

type RoyalLetterSnapshot = {account: string | null; unread: readonly RoyalLetterRes[]; ready: boolean};

const STORAGE_KEY_PREFIX = "royal-letters:";

function parse(stored: string | null): readonly RoyalLetterRes[] {
	if (!stored) return [];
	try {
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter((letter): letter is RoyalLetterRes =>
			typeof letter === "object" && letter !== null
			&& typeof letter.letter === "number" && typeof letter.letters === "number"
			&& typeof letter.tokens === "number" && typeof letter.money === "number" && typeof letter.gems === "number") : [];
	}
	catch {
		return [];
	}
}

function merge(cached: readonly RoyalLetterRes[], received: readonly RoyalLetterRes[]): readonly RoyalLetterRes[] {
	const letters = new Map<number, RoyalLetterRes>();
	for (const letter of [...cached, ...received]) letters.set(letter.letter, letter);
	return [...letters.values()].sort((first, second) => first.letter - second.letter);
}

class RoyalLetterStore {
	private snapshot: RoyalLetterSnapshot = {account: null, unread: [], ready: false};

	private readonly listeners = new Set<() => void>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler<RoyalLetterRes>(RoyalLetterRes.wireName, this.receive);
	}

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): RoyalLetterSnapshot => this.snapshot;

	public async load(account: string): Promise<void> {
		if (this.snapshot.account === account) return;
		const pending = this.snapshot.account === null ? this.snapshot.unread : [];
		this.set({account, unread: pending, ready: false});
		const cached = parse(await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${account}`).catch(() => null));
		if (this.snapshot.account !== account) return;
		this.set({account, unread: merge(cached, this.snapshot.unread), ready: true});
	}

	public readonly read = (): void => {
		if (this.snapshot.unread.length === 0) return;
		this.set({...this.snapshot, unread: this.snapshot.unread.slice(1)});
	};

	private readonly receive = (packet: RoyalLetterRes): void => {
		this.set({...this.snapshot, unread: merge(this.snapshot.unread, [packet])});
	};

	private set(snapshot: RoyalLetterSnapshot): void {
		this.snapshot = snapshot;
		if (snapshot.ready && snapshot.account !== null) {
			const key = `${STORAGE_KEY_PREFIX}${snapshot.account}`;
			const saved = snapshot.unread.length === 0
				? AsyncStorage.removeItem(key)
				: AsyncStorage.setItem(key, JSON.stringify(snapshot.unread));
			saved.catch(error => console.warn("Could not save a royal letter:", error));
		}
		for (const listener of this.listeners) listener();
	}
}

export const royalLetterStore = new RoyalLetterStore();

export function useRoyalLetter(): RoyalLetterRes | null {
	const profile = usePlayerProfile();
	const snapshot = useSyncExternalStore(royalLetterStore.subscribe, royalLetterStore.getSnapshot, royalLetterStore.getSnapshot);
	return profile.status === "ready" && snapshot.ready && snapshot.account === profile.data.pseudo ? snapshot.unread[0] ?? null : null;
}

export function useRoyalLetterAccount(): void {
	const profile = usePlayerProfile();
	const account = profile.status === "ready" ? profile.data.pseudo : null;
	useEffect(() => {
		if (account) royalLetterStore.load(account).catch(error => console.warn("Could not restore royal letters:", error));
	}, [account]);
}