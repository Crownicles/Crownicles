import {useSyncExternalStore} from "react";
import {MissionsCompletedRes} from "ws-packets/src/fromServer/missions/MissionsCompletedRes";
import {PendingReveal} from "ws-packets/src/fromServer/appState/AppStateRes";
import {CompletedMission, Mission} from "ws-packets/src/objects/Mission";
import {RecipeDisplay} from "ws-packets/src/objects/RecipeDisplay";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {useAppState, useAppStateChange} from "@/src/store/AppState";

/** Missions Core has completed and already rewarded, kept by Core until the player comes to see what they earned. */
export type MissionRewards = {
	missions: readonly CompletedMission[];
	recipes: readonly RecipeDisplay[];
	nextCampaignMission?: Mission;

	/** The reveals these rewards come from, to tell Core once they are seen. */
	revealIds: readonly number[];
};

export type MissionRewardsSnapshot = {
	rewards: MissionRewards;

	/** Completed since the player was last told, so the announcement names only what is new. */
	unannounced: number;
};

const NO_REWARDS: MissionRewards = {missions: [], recipes: [], revealIds: []};

export function rewardsOf(reveals: readonly PendingReveal[]): MissionRewards {
	return reveals.reduce<MissionRewards>((rewards, reveal) => {
		if (!reveal.missions) return rewards;
		const nextCampaignMission = reveal.missions.nextCampaignMission ?? rewards.nextCampaignMission;
		return {
			missions: [...rewards.missions, ...reveal.missions.missions],
			recipes: [...rewards.recipes, ...reveal.missions.discoveredRecipes ?? []],
			...nextCampaignMission ? {nextCampaignMission} : {},
			revealIds: [...rewards.revealIds, reveal.id]
		};
	}, NO_REWARDS);
}

/** How many missions were completed since the player was last told; only this launch needs to know. */
class UnannouncedMissions {
	private count = 0;

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

	public readonly getSnapshot = (): number => this.count;

	public readonly announced = (): void => {
		if (this.count > 0) this.set(0);
	};

	private readonly receive = (packet: MissionsCompletedRes): void => {
		if (packet.missions.length > 0) this.set(this.count + packet.missions.length);
	};

	private set(count: number): void {
		this.count = count;
		for (const listener of this.listeners) listener();
	}
}

export const missionRewardsStore = new UnannouncedMissions();

export function useMissionRewards(): MissionRewardsSnapshot {
	const state = useAppState();
	const unannounced = useSyncExternalStore(missionRewardsStore.subscribe, missionRewardsStore.getSnapshot, missionRewardsStore.getSnapshot);
	const rewards = state.status === "ready" ? rewardsOf(state.data.reveals) : NO_REWARDS;
	return {rewards, unannounced: Math.min(unannounced, rewards.missions.length)};
}

/** The player has seen these rewards: Core forgets them, and what arrived meanwhile stays. */
export function useClaimMissionRewards(): (revealed: MissionRewards) => void {
	const change = useAppStateChange();
	return revealed => change({acknowledged: revealed.revealIds});
}
