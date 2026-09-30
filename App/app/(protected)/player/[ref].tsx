import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {ProfileView} from "@/src/components/ProfileView";
import {GuildInvitePlayer} from "@/src/components/GuildMembers";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState} from "@/src/design/Primitives";
import {Page} from "@/src/design/DetailScreen";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOtherPlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

function OtherPlayerProfile({playerRef}: {playerRef: string}): ReactNode {
	const state = useOtherPlayerProfile(playerRef);
	if (state.status === "empty") return <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>;
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile =>
		<ProfileView profile={profile} lead={<GuildInvitePlayer playerRef={playerRef} profile={profile} />} />}</GameQueryContent>;
}

/** Someone met in a ranking, read-only: their own profile card is the page's heading. */
export default function PlayerScreen(): ReactNode {
	const {ref} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	return <Page onClose={close}>
		{typeof ref === "string" ? <OtherPlayerProfile playerRef={ref} /> : <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>}
	</Page>;
}
