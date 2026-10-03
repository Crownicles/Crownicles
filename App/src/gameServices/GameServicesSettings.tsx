import type {ReactNode} from "react";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, EntryRow, ExpandableList, Fact, LockHint, Refusal} from "@/src/design/Sections";
import {Swords, Trophy, UserRound} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {gameServicesStore, useGameServices} from "./GameServices";
import {GameServicesSnapshot} from "./GameServicesStore";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS, GAME_SERVICE_SCOPES, GamePlatformPlayer} from "./GameServicesTypes";

const ICON_SIZE = 24;

function openPlatform(operation: () => Promise<void>): void {
	operation().catch((error: unknown): void => {console.warn("Unable to open game services:", error);});
}

/** A platform screen to open, held back while another operation runs */
function PlatformEntry({title, emblem, busy, operation}: {title: string; emblem?: ReactNode; busy: boolean; operation: () => Promise<void>}): ReactNode {
	return <EntryRow
		{...emblem ? {emblem} : {}}
		title={title}
		disabled={busy}
		{...busy ? {subtitle: i18n.t("app:settings.gameServices.pending")} : {}}
		onPress={(): void => openPlatform(operation)}
	/>;
}

function ConnectedPlayer({state, player}: {state: GameServicesSnapshot; player: GamePlatformPlayer}): ReactNode {
	return <ExpandableList>
		<Fact label={i18n.t("app:settings.gameServices.profile")} value={player.displayName} />
		<Fact label={i18n.t("app:settings.gameServices.record")} value={formatNumber(state.bestTopweekScore)} />
		<PlatformEntry emblem={<Swords size={ICON_SIZE} />} title={i18n.t("app:settings.gameServices.achievements")} busy={state.busy} operation={gameServicesStore.showAchievements.bind(gameServicesStore)} />
		<PlatformEntry emblem={<Trophy size={ICON_SIZE} />} title={i18n.t("app:settings.gameServices.leaderboard")} busy={state.busy} operation={gameServicesStore.showTopweekLeaderboard.bind(gameServicesStore)} />
		{state.storageScope === GAME_SERVICE_SCOPES.LOCAL ? <PlatformEntry title={i18n.t("app:settings.gameServices.resetLocal")} busy={state.busy} operation={gameServicesStore.resetLocalProgress.bind(gameServicesStore)} /> : null}
	</ExpandableList>;
}

function SyncFailure({busy}: {busy: boolean}): ReactNode {
	return <>
		<Refusal>{i18n.t("app:settings.gameServices.failed")}</Refusal>
		<EntryRow title={i18n.t("app:settings.gameServices.retry")} disabled={busy} onPress={(): void => openPlatform(gameServicesStore.refresh.bind(gameServicesStore))} />
	</>;
}

function AvailableServices({state, provider}: {state: GameServicesSnapshot; provider: string}): ReactNode {
	return <>
		{state.busy ? <Note>{i18n.t("app:settings.gameServices.pending")}</Note> : null}
		{state.player
			? <ConnectedPlayer state={state} player={state.player} />
			: <ActionBanner
				icon={UserRound}
				label={i18n.t("app:settings.gameServices.connect", {provider})}
				pending={state.busy}
				onPress={(): void => openPlatform(gameServicesStore.connect.bind(gameServicesStore))}
			/>}
		{state.syncFailed ? <SyncFailure busy={state.busy} /> : null}
	</>;
}

export function GameServicesSettings(): ReactNode {
	const state = useGameServices();
	if (state.provider === GAME_SERVICE_PROVIDERS.UNSUPPORTED) return null;
	const provider = i18n.t(`app:settings.gameServices.providers.${state.provider}`);
	return <>
		<SectionHeader>{provider}</SectionHeader>
		{state.storageScope === GAME_SERVICE_SCOPES.LOCAL ? <Note>{i18n.t("app:settings.gameServices.localTest")}</Note> : null}
		{state.availability === GAME_SERVICE_AVAILABILITY.AVAILABLE
			? <AvailableServices state={state} provider={provider} />
			: <LockHint lock={{reason: i18n.t(`app:settings.gameServices.unavailable.${state.availability}`)}} />}
	</>;
}
