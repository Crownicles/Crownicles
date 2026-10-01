import type {ReactNode} from "react";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, EntryRow, ExpandableList, Fact, LockHint, Refusal} from "@/src/design/Sections";
import {Swords, Trophy, UserRound} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {gameServicesStore, useGameServices} from "./GameServices";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS} from "./GameServicesTypes";

const ICON_SIZE = 24;

function openPlatform(operation: () => Promise<void>): void {
	operation().catch((error: unknown): void => {console.warn("Unable to open game services:", error);});
}

export function GameServicesSettings(): ReactNode {
	const state = useGameServices();
	if (state.provider === GAME_SERVICE_PROVIDERS.UNSUPPORTED) return null;
	const provider = i18n.t(`app:settings.gameServices.providers.${state.provider}`);
	return <>
		<SectionHeader>{provider}</SectionHeader>
		{state.availability !== GAME_SERVICE_AVAILABILITY.AVAILABLE
			? <LockHint lock={{reason: i18n.t(`app:settings.gameServices.unavailable.${state.availability}`)}} />
			: <>
				{state.busy ? <Note>{i18n.t("app:settings.gameServices.pending")}</Note> : null}
				{!state.player ? <ActionBanner
					icon={UserRound}
					label={i18n.t("app:settings.gameServices.connect", {provider})}
					pending={state.busy}
					onPress={(): void => openPlatform(gameServicesStore.connect.bind(gameServicesStore))}
				/> : <ExpandableList>
					<Fact label={i18n.t("app:settings.gameServices.profile")} value={state.player.displayName} />
					<Fact label={i18n.t("app:settings.gameServices.record")} value={formatNumber(state.bestTopweekScore)} />
					<EntryRow
						emblem={<Swords size={ICON_SIZE} />}
						title={i18n.t("app:settings.gameServices.achievements")}
						disabled={state.busy}
						{...state.busy ? {subtitle: i18n.t("app:settings.gameServices.pending")} : {}}
						onPress={(): void => openPlatform(gameServicesStore.showAchievements.bind(gameServicesStore))}
					/>
					<EntryRow
						emblem={<Trophy size={ICON_SIZE} />}
						title={i18n.t("app:settings.gameServices.leaderboard")}
						disabled={state.busy}
						{...state.busy ? {subtitle: i18n.t("app:settings.gameServices.pending")} : {}}
						onPress={(): void => openPlatform(gameServicesStore.showTopweekLeaderboard.bind(gameServicesStore))}
					/>
				</ExpandableList>}
				{state.syncFailed ? <>
					<Refusal>{i18n.t("app:settings.gameServices.failed")}</Refusal>
					<EntryRow title={i18n.t("app:settings.gameServices.retry")} disabled={state.busy} onPress={(): void => openPlatform(gameServicesStore.refresh.bind(gameServicesStore))} />
				</> : null}
			</>}
	</>;
}