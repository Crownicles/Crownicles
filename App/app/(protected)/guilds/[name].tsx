import {ReactNode} from "react";
import {useLocalSearchParams, useRouter} from "expo-router";
import {GuildOverview} from "@/src/components/Guild";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {EmptyState, Screen} from "@/src/design/Primitives";
import {BackButton} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useNamedGuild} from "@/src/store/useGuild";
import {i18n} from "@/src/translations/i18n";

function OtherGuild({name}: {name: string}): ReactNode {
	const state = useNamedGuild(name);
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD}>{data => data.foundGuild && data.data
		? <GuildOverview guild={data.data} />
		: <EmptyState>{i18n.t("app:guild.notFound")}</EmptyState>}</GameQueryContent>;
}

/** A guild met in a ranking, read-only. */
export default function GuildScreen(): ReactNode {
	const {name} = useLocalSearchParams();
	const router = useRouter();
	const close = (): void => {
		if (router.canGoBack()) router.back();
		else router.replace("/");
	};
	return <SwipeBack onClose={close}>
		<Screen>
			<BackButton label={i18n.t("app:common.back")} onClose={close} />
			{typeof name === "string" ? <OtherGuild name={name} /> : <EmptyState>{i18n.t("app:guild.notFound")}</EmptyState>}
		</Screen>
	</SwipeBack>;
}
