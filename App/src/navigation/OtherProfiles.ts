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

export function useOpenPlayer(): (playerRef: string) => void {
	const router = useRouter();
	const tab = hostTab(useSegments());
	return (ref): void => router.push({pathname: tab ? PLAYER_ROUTES[tab] : "/player/[ref]", params: {ref}});
}

export function useOpenGuild(): (name: string) => void {
	const router = useRouter();
	const tab = hostTab(useSegments());
	return (name): void => router.push({pathname: tab ? GUILD_ROUTES[tab] : "/guilds/[name]", params: {name}});
}
