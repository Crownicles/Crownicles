import {useEffect, useSyncExternalStore} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {MissionsCompletedRes} from "ws-packets/src/fromServer/missions/MissionsCompletedRes";
import {CompletedMission, Mission} from "ws-packets/src/objects/Mission";
import {RecipeDisplay} from "ws-packets/src/objects/RecipeDisplay";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

/** Missions Core has completed and already rewarded, kept until the player comes to see what they earned. */
export type MissionRewards = {
	missions: readonly CompletedMission[];
	recipes: readonly RecipeDisplay[];
	nextCampaignMission?: Mission;
};

export type MissionRewardsSnapshot = {
	rewards: MissionRewards;

	/** Completed since the player was last told, so the announcement names only what is new. */
	unannounced: number;
};

const STORAGE_KEY_PREFIX = "mission-rewards:";

/** A player who never comes to look still keeps a bounded list. */
const MAX_KEPT_MISSIONS = 50;
const NO_REWARDS: MissionRewards = {missions: [], recipes: []};
const EMPTY: MissionRewardsSnapshot = {rewards: NO_REWARDS, unannounced: 0};

function merge(kept: MissionRewards, received: MissionRewards): MissionRewards {
	const nextCampaignMission = received.nextCampaignMission ?? kept.nextCampaignMission;
	return {
		missions: [...kept.missions, ...received.missions].slice(-MAX_KEPT_MISSIONS),
		recipes: [...kept.recipes, ...received.recipes],
		...nextCampaignMission ? {nextCampaignMission} : {}
	};
}

function parse(stored: string | null): MissionRewards {
	if (!stored) return NO_REWARDS;
	try {
		const value = JSON.parse(stored) as Partial<MissionRewards>;
		return Array.isArray(value.missions) && Array.isArray(value.recipes) ? value as MissionRewards : NO_REWARDS;
	}
	catch {
		return NO_REWARDS;
	}
}

class MissionRewardsStore {
	private account: string | null = null;

	/** Until the account's record is read, what arrives is only held: the first report completes a mission before the profile can name the player. */
	private loaded = false;

	private snapshot: MissionRewardsSnapshot = EMPTY;

	private readonly listeners = new Set<() => void>();

	public constructor() {
		WebSocketClient.getInstance().registerPushedPacketHandler<MissionsCompletedRes>(MissionsCompletedRes.wireName, this.receive);
	}

	public readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return (): void => {
			this.listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): MissionRewardsSnapshot => this.snapshot;

	public async load(account: string): Promise<void> {
		if (this.account === account) return;
		if (this.account !== null) this.snapshot = EMPTY;
		this.account = account;
		this.loaded = false;
		const stored = parse(await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${account}`).catch(() => null));
		if (this.account !== account) return;
		this.loaded = true;
		this.set({rewards: merge(stored, this.snapshot.rewards), unannounced: this.snapshot.unannounced});
	}

	public announced(): void {
		if (this.snapshot.unannounced > 0) this.set({...this.snapshot, unannounced: 0});
	}

	public claim(revealed: MissionRewards): void {
		const missions = new Set(revealed.missions);
		const recipes = new Set(revealed.recipes);
		const remainingMissions = this.snapshot.rewards.missions.filter(mission => !missions.has(mission));
		this.set({
			rewards: {
				missions: remainingMissions,
				recipes: this.snapshot.rewards.recipes.filter(recipe => !recipes.has(recipe))
			},
			unannounced: Math.min(this.snapshot.unannounced, remainingMissions.length)
		});
	}

	private readonly receive = (packet: MissionsCompletedRes): void => {
		if (packet.missions.length === 0) return;
		this.set({
			rewards: merge(this.snapshot.rewards, {
				missions: packet.missions,
				recipes: packet.discoveredRecipes ?? [],
				...packet.nextCampaignMission ? {nextCampaignMission: packet.nextCampaignMission} : {}
			}),
			unannounced: this.snapshot.unannounced + packet.missions.length
		});
	};

	private set(snapshot: MissionRewardsSnapshot): void {
		this.snapshot = snapshot;
		if (this.account !== null && this.loaded) this.save(this.account, snapshot.rewards);
		for (const listener of this.listeners) listener();
	}

	private save(account: string, rewards: MissionRewards): void {
		const key = `${STORAGE_KEY_PREFIX}${account}`;
		const saved = rewards.missions.length === 0 ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(rewards));
		saved.catch(error => console.warn("Could not save mission rewards", error));
	}
}

export const missionRewardsStore = new MissionRewardsStore();

export function useMissionRewards(): MissionRewardsSnapshot {
	return useSyncExternalStore(missionRewardsStore.subscribe, missionRewardsStore.getSnapshot, missionRewardsStore.getSnapshot);
}

/** Opens the record of the account the profile names, once it names one. */
export function useMissionRewardsAccount(): void {
	const profile = usePlayerProfile();
	const account = profile.status === "ready" ? profile.data.pseudo : null;
	useEffect(() => {
		if (account) missionRewardsStore.load(account).catch(error => console.warn("Could not restore mission rewards", error));
	}, [account]);
}
