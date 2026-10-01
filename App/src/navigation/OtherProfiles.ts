import {useNavigation, useRouter, useSegments} from "expo-router";

const OTHER_PROFILE_ROUTES = {
	PLAYER: {name: "player/[ref]", parameter: "ref"},
	GUILD: {name: "guilds/[name]", parameter: "name"}
} as const;

type OtherProfileRoute = typeof OTHER_PROFILE_ROUTES[keyof typeof OTHER_PROFILE_ROUTES];

function useReturnToProfile(route: OtherProfileRoute): (identifier: string) => boolean {
	const navigation = useNavigation();
	const router = useRouter();
	return identifier => {
		const state = navigation.getState();
		if (state?.type !== "stack") return false;
		const index = state.routes.findIndex(candidate => candidate.name === route.name
			&& Object.entries(candidate.params ?? {}).some(([key, value]: [string, unknown]) => key === route.parameter && value === identifier));
		if (index < 0) return false;
		const count = state.index - index;
		if (count > 0) router.dismiss(count);
		return true;
	};
}

/**
 * Another player's profile or another guild opens inside the tab it was found from, so the tab bar
 * stays; from anywhere else it opens over the tabs.
 */
const PLAYER_ROUTES = {
	profile: "/profile/player/[ref]",
	arena: "/arena/player/[ref]",
	guild: "/guild/player/[ref]"
} as const;
const GUILD_ROUTES = {
	profile: "/profile/guilds/[name]",
	arena: "/arena/guilds/[name]",
	guild: "/guild/guilds/[name]"
} as const;
type HostTab = keyof typeof PLAYER_ROUTES;

function hostTab(segments: string[]): HostTab | undefined {
	return segments.find((segment): segment is HostTab => Object.hasOwn(PLAYER_ROUTES, segment));
}

/** The guild page a profile was opened from, so the profile can lead back to it instead of stacking it again. */
export const FROM_GUILD_PARAM = "fromGuild";

export function useOpenPlayer(): (playerRef: string, fromGuild?: string) => void {
	const router = useRouter();
	const tab = hostTab(useSegments());
	const returnToProfile = useReturnToProfile(OTHER_PROFILE_ROUTES.PLAYER);
	return (ref, fromGuild): void => {
		if (returnToProfile(ref)) return;
		router.push({
			pathname: tab ? PLAYER_ROUTES[tab] : "/player/[ref]",
			params: {ref, ...fromGuild ? {[FROM_GUILD_PARAM]: fromGuild} : {}}
		});
	};
}

export function useOpenGuild(): (name: string) => void {
	const router = useRouter();
	const tab = hostTab(useSegments());
	const returnToProfile = useReturnToProfile(OTHER_PROFILE_ROUTES.GUILD);
	return (name): void => {
		if (returnToProfile(name)) return;
		router.push({pathname: tab ? GUILD_ROUTES[tab] : "/guilds/[name]", params: {name}});
	};
}
