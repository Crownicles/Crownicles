import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {ProfileView} from "@/src/components/ProfileView";
import {GuildInvitePlayer} from "@/src/components/GuildMembers";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState} from "@/src/design/Primitives";
import {Page} from "@/src/design/DetailScreen";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOtherPlayerProfile, usePlayerProfile} from "@/src/store/usePlayerProfile";
import {FROM_GUILD_PARAM, useOpenGuild} from "@/src/navigation/OtherProfiles";
import {i18n} from "@/src/translations/i18n";

/** Opening a profile's guild steps back when that guild is where the profile was opened from, so the two never stack endlessly. */
function useGuildOfProfile(fromGuild: string | undefined): (name: string) => void {
	const router = useRouter();
	const openGuild = useOpenGuild();
	const own = usePlayerProfile();
	return (name): void => {
		if (name === fromGuild && router.canGoBack()) router.back();
		else if (own.status === "ready" && own.data.guild === name) router.navigate("/guild");
		else openGuild(name);
	};
}

function OtherPlayerProfile({playerRef, fromGuild}: {playerRef: string; fromGuild: string | undefined}): ReactNode {
	const state = useOtherPlayerProfile(playerRef);
	const openGuild = useGuildOfProfile(fromGuild);
	if (state.status === "empty") return <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>;
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile =>
		<ProfileView profile={profile} onGuild={openGuild} lead={<GuildInvitePlayer playerRef={playerRef} profile={profile} />} />}</GameQueryContent>;
}

/** Someone met in a ranking, read-only: their own profile card is the page's heading. */
export default function PlayerScreen(): ReactNode {
	const params = useLocalSearchParams();
	const {ref} = params;
	const fromGuild = params[FROM_GUILD_PARAM];
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	return <Page onClose={close}>
		{typeof ref === "string" ? <OtherPlayerProfile playerRef={ref} fromGuild={typeof fromGuild === "string" ? fromGuild : undefined} /> : <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>}
	</Page>;
}
