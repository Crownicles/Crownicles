import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {ProfileView} from "@/src/components/ProfileView";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState, Screen} from "@/src/design/Primitives";
import {BackButton} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useOtherPlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

function OtherPlayerProfile({playerRef}: {playerRef: string}): ReactNode {
	const state = useOtherPlayerProfile(playerRef);
	if (state.status === "empty") return <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>;
	return <GameQueryContent state={state} entity={GAME_ENTITIES.PROFILE}>{profile => <ProfileView profile={profile} />}</GameQueryContent>;
}

/** Someone met in a ranking, read-only: their own profile card is the page's heading. */
export default function PlayerScreen(): ReactNode {
	const {ref} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	return <SwipeBack onClose={close}>
		<Screen>
			<BackButton label={i18n.t("app:common.back")} onClose={close} />
			{typeof ref === "string" ? <OtherPlayerProfile playerRef={ref} /> : <EmptyState>{i18n.t("app:profile.notFound")}</EmptyState>}
		</Screen>
	</SwipeBack>;
}
