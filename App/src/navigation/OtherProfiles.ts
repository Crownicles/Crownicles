import {useRouter, useSegments} from "expo-router";

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
	return (ref, fromGuild): void => router.push({
		pathname: tab ? PLAYER_ROUTES[tab] : "/player/[ref]",
		params: {ref, ...fromGuild ? {[FROM_GUILD_PARAM]: fromGuild} : {}}
	});
}

export function useOpenGuild(): (name: string) => void {
	const router = useRouter();
	const tab = hostTab(useSegments());
	return (name): void => router.push({pathname: tab ? GUILD_ROUTES[tab] : "/guilds/[name]", params: {name}});
}
