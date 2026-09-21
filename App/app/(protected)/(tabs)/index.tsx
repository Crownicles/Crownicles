import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReportBuyHealReq} from "ws-packets/src/fromClient/ReportBuyHealReq";
import {ReportUseTokensReq} from "ws-packets/src/fromClient/ReportUseTokensReq";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	ReportTokenMerchantBoughtRes,
	ReportTokenMerchantCannotAffordRes,
	ReportTokenMerchantCharityAlreadyUsedRes,
	ReportTokenMerchantCharityRes,
	ReportTokenMerchantFullRes,
	ReportTokenMerchantRefusedRes,
	ReportTokenMerchantTooMuchRes,
	ReportUseTokensAcceptedRes,
	ReportUseTokensRefusedRes
} from "ws-packets/src/fromServer/report/ReportTokenRes";
import {
	ReportBuyHealAcceptedRes,
	ReportBuyHealCannotHealOccupiedRes,
	ReportBuyHealNoAlterationRes,
	ReportBuyHealRefusedRes
} from "ws-packets/src/fromServer/report/ReportHealRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Blocked} from "ws-packets/src/fromServer/common/Blocked";
import {AppIcons} from "@/src/AppIcons";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {RequestState} from "@/src/store/useGameQuery";
import {gameKey, GAME_ENTITIES} from "@/src/store/GameEntities";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {
	AdventureCollector,
	BigEventOutcome as BigEventOutcomeScreen,
	HealOutcome as HealOutcomeScreen,
	LotteryOutcome as LotteryOutcomeScreen,
	TokenOutcome as TokenOutcomeScreen,
	WitchOutcome as WitchOutcomeScreen
} from "@/src/collectors/AdventureCollector";
import type {
	LotteryOutcome as LotteryOutcomeData,
	TokenOutcome as TokenOutcomeData
} from "@/src/collectors/ReportEventStore";
import {
	isAdventureScreenCollector, isBigEventCollector, isBuyHealCollector, isTokenUseCollector
} from "@/src/collectors/CollectorRouting";
import {
	reportEventStore, TokenOutcomeRequiringAcknowledgement, useBigEventOutcome, useHealOutcome, useShopResult,
	useAutomaticSmallEventOutcome, useLotteryOutcome, useSmallEventChoiceOutcome, useTokenOutcome, useWitchOutcome
} from "@/src/collectors/ReportEventStore";
import {SmallEventChoiceOutcome as SmallEventChoiceOutcomeScreen} from "@/src/collectors/SmallEventChoiceOutcome";
import {ShopResultScreen} from "@/src/collectors/ShopResultScreen";
import {AutomaticSmallEventOutcome as AutomaticSmallEventOutcomeScreen} from "@/src/collectors/AutomaticSmallEventOutcome";
import {EmptyState, Note, QuickAction, QuickActions, Screen} from "@/src/design/Primitives";
import {ActionBanner, Figure, Figures, LockHint, Standing} from "@/src/design/Sections";
import {BookOpen, CircleAlert, Clock3} from "@/src/design/FightIcons";
import {PlayerVitals} from "@/src/components/PlayerVitals";
import {formatMoney} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";
import {WorldMap} from "@/src/components/WorldMap";
import {DetailScreen} from "@/src/design/DetailScreen";
import {RespawnAction, PrisonerRelease} from "@/src/components/Utilities";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {COMMAND_REJECTIONS} from "ws-packets/src/objects/CommandRejection";
import {useReportView, useReportAdvance} from "@/src/store/useReportActions";
import {GameMutation} from "@/src/store/useGameMutation";
import {ReportCity} from "@/src/components/ReportCity";

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
const FULL_PROGRESS = 1;
const NO_PROGRESS = 0;
const PERCENTAGE_SCALE = 100;

type MapPoint = ReportTravelSummaryRes["startMap"];
type TravelMetrics = {
  progress: number;
  remainingMilliseconds: number;
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Theme.spacing.xxl,
    backgroundColor: Theme.colors.wash
  },
  adventureRoot: {
    flex: 1
  },
  message: {
    color: Theme.colors.muted,
    fontFamily: Theme.fonts.regular,
    fontSize: Theme.fontSize.body,
    lineHeight: Theme.lineHeight.body,
    textAlign: "center"
  },
  travelPath: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
    paddingTop: Theme.spacing.xl + Theme.spacing.sm,
    paddingBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg
  },
  mapNode: {
    width: Theme.dimensions.headerIcon,
    height: Theme.dimensions.headerIcon,
    alignItems: "center",
    justifyContent: "center"
  },
  travelTrack: {
    flex: 1,
    height: 6,
    borderRadius: Theme.pillRadius,
    backgroundColor: Theme.colors.line,
    position: "relative"
  },
  travelFill: {
    height: "100%",
    borderRadius: Theme.pillRadius,
    backgroundColor: Theme.colors.ink
  },
  runner: {
    position: "absolute",
    top: -Theme.dimensions.headerIcon + Theme.spacing.xs,
    marginLeft: -Theme.dimensions.quickActionIcon / 2
  },
});

function Centered({ children }: { children: ReactNode }): ReactNode {
  return <View style={styles.centered}>{children}</View>;
}

function useCurrentTime(): number {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect((): (() => void) => {
    const updateCurrentTime = (): void => setCurrentTime(Date.now());
    updateCurrentTime();
    const intervalId = setInterval(updateCurrentTime, MILLISECONDS_PER_SECOND);
    return (): void => clearInterval(intervalId);
  }, []);

  return currentTime;
}

function requestTokenAdvance(): Promise<GameAnswer<ReactionCollectorCreation>> {
	return GameClient.request(makeFromClientPacket(ReportUseTokensReq, {}), ReactionCollectorCreation, [
		ReportUseTokensAcceptedRes,
		ReportUseTokensRefusedRes,
		ReportTokenMerchantBoughtRes,
		ReportTokenMerchantTooMuchRes,
		ReportTokenMerchantFullRes,
		ReportTokenMerchantRefusedRes,
		ReportTokenMerchantCannotAffordRes,
		ReportTokenMerchantCharityRes,
		ReportTokenMerchantCharityAlreadyUsedRes
	]);
}

function requestBuyHeal(): Promise<GameAnswer<ReactionCollectorCreation>> {
	return GameClient.request(makeFromClientPacket(ReportBuyHealReq, {}), ReactionCollectorCreation, [
		ReportBuyHealAcceptedRes,
		ReportBuyHealRefusedRes,
		ReportBuyHealNoAlterationRes,
		ReportBuyHealCannotHealOccupiedRes
	]);
}

function getEffectStartTime(packet: ReportTravelSummaryRes): number | null {
  if (packet.effectEndTime === undefined || packet.effectDuration === undefined) {
    return null;
  }
  return packet.effectEndTime - packet.effectDuration;
}

function isEffectActive(packet: ReportTravelSummaryRes, currentTime: number): boolean {
  const effectStartTime = getEffectStartTime(packet);
  return packet.effect !== undefined
    && effectStartTime !== null
    && packet.effectEndTime !== undefined
    && currentTime >= effectStartTime
    && currentTime <= packet.effectEndTime;
}

function getTravelMetrics(packet: ReportTravelSummaryRes, currentTime: number): TravelMetrics {
  const effectDuration = packet.effectDuration ?? NO_PROGRESS;
  const tripDuration = Math.max(packet.arriveTime - packet.startTime - effectDuration, NO_PROGRESS);
  const effectStartTime = getEffectStartTime(packet);
  const effectIsActive = isEffectActive(packet, currentTime);
  let travelledTime = currentTime - packet.startTime;

  if (packet.effectEndTime !== undefined && currentTime > packet.effectEndTime) {
    travelledTime -= effectDuration;
  }
  else if (effectIsActive && effectStartTime !== null) {
    travelledTime -= currentTime - effectStartTime;
  }

  const boundedTravelledTime = Math.max(NO_PROGRESS, Math.min(travelledTime, tripDuration));
  return {
    progress: tripDuration === NO_PROGRESS ? FULL_PROGRESS : boundedTravelledTime / tripDuration,
    remainingMilliseconds: Math.max(NO_PROGRESS, tripDuration - travelledTime)
  };
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE), NO_PROGRESS);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const durationKey = hours > NO_PROGRESS
    ? "app:adventure.duration.hoursMinutes"
    : "app:adventure.duration.minutes";
	return i18n.t(durationKey, hours > NO_PROGRESS ? {hours, minutes} : {count: totalMinutes});
}

function mapName(map: MapPoint): string {
  return map.id > NO_PROGRESS
    ? i18n.t(`models:map_locations.${map.id}.name`)
    : i18n.t("app:adventure.unknownLocation");
}

function mapIcon(map: MapPoint): ReactNode {
  const icon = AppIcons.getIconOrNull(`mapTypes.${map.type}`);
  return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : null;
}

function runnerIcon(packet: ReportTravelSummaryRes): string {
  return packet.isOnBoat
    ? AppIcons.getIcon("guild.isOnBoat")
    : AppIcons.getIcon("other.walking");
}

function TravelPath({packet, progress}: { packet: ReportTravelSummaryRes; progress: number }): ReactNode {
  const progressLabel = i18n.t("app:adventure.onTheRoad");
  return (
    <View
      accessible
      accessibilityLabel={`${progressLabel}: ${Math.round(progress * PERCENTAGE_SCALE)}%`}
      style={styles.travelPath}
    >
      <View style={styles.mapNode}>{mapIcon(packet.startMap)}</View>
      <View style={styles.travelTrack}>
        <View style={[styles.travelFill, {width: `${progress * PERCENTAGE_SCALE}%`}]} />
        <View style={[styles.runner, {left: `${progress * PERCENTAGE_SCALE}%`}]}>
          <TwemojiIcon emoji={runnerIcon(packet)} size={Theme.dimensions.quickActionIcon} />
        </View>
      </View>
      <View style={styles.mapNode}>{mapIcon(packet.endMap)}</View>
    </View>
  );
}

function nextStopDuration(packet: ReportTravelSummaryRes, currentTime: number): string {
  if (packet.nextStopTime <= currentTime) {
    return i18n.t("app:adventure.now");
  }
  return formatDuration(packet.nextStopTime - currentTime);
}

function hasNextStop(packet: ReportTravelSummaryRes): boolean {
	return packet.nextStopTime <= packet.arriveTime;
}

/**
 * Tied to the next stop rather than drawn at random: the screen ticks every second to move the
 * traveller along the path, and an advice changing under the player's eyes reads as a glitch.
 * Reaching a stop brings a new one.
 */
function travelAdvice(stopTime: number): string {
	const advices = i18n.tArray("advices:advices");
	return advices.length === 0 ? "" : advices[Math.abs(stopTime) % advices.length];
}

export function reportRefreshDelay(packet: ReportTravelSummaryRes, now = Date.now()): number | null {
	const nextRefresh = packet.isInCity ? packet.effectEndTime : Math.min(packet.nextStopTime, packet.arriveTime);
	return nextRefresh !== undefined && nextRefresh > now ? nextRefresh - now : null;
}

function useReportRefreshAtNextStop(packet: ReportTravelSummaryRes | null): void {
	const queryClient = useQueryClient();
	const nextStopTime = packet?.nextStopTime;
	const arriveTime = packet?.arriveTime;

	useEffect(() => {
		if (!packet) {
			return undefined;
		}
		const delay = reportRefreshDelay(packet);
		if (delay === null) {
			return undefined;
		}
		const timeoutId = setTimeout(() => {
			queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.REPORT), refetchType: "active"})
				.catch(error => console.error("Failed to refresh report at next stop:", error));
		}, delay);
		return (): void => {
			clearTimeout(timeoutId);
		};
	}, [arriveTime, nextStopTime, packet, queryClient]);
}

type CollectorOutcomeViewProps = {
	bigEventCollector: ReactionCollectorCreation | undefined;
	adventureCollector: ReactionCollectorCreation | undefined;
	bigEventOutcome: ReportBigEventResultRes | null;
	lotteryOutcome: LotteryOutcomeData | null;
	witchOutcome: ReturnType<typeof useWitchOutcome>;
	choiceOutcome: ReturnType<typeof useSmallEventChoiceOutcome>;
	automaticOutcome: ReturnType<typeof useAutomaticSmallEventOutcome>;
	tokenOutcome: TokenOutcomeData | null;
	healOutcome: ReturnType<typeof useHealOutcome>;
	shopResult: ReturnType<typeof useShopResult>;
	reactToCollector: (collectorId: string, reactionIndex: number) => void;
	isAnswerPending: (collectorId: string) => boolean;
	continueAfterTokenOutcome: () => void;
	continueAfterHealOutcome: () => void;
};

export function tokenOutcomeNeedsAcknowledgement(outcome: TokenOutcomeData): outcome is TokenOutcomeRequiringAcknowledgement {
	return outcome.kind !== "used"
		&& outcome.kind !== "useRefused"
		&& outcome.kind !== "merchantRefused";
}

function collectorScreen(
	collector: ReactionCollectorCreation,
	reactToCollector: CollectorOutcomeViewProps["reactToCollector"],
	isAnswerPending: CollectorOutcomeViewProps["isAnswerPending"]
): ReactNode {
	return <AdventureCollector
		collector={collector}
		onChoose={(reactionIndex): void => reactToCollector(collector.id, reactionIndex)}
		submitting={isAnswerPending(collector.id)}
	/>;
}

function storedEventOutcome({bigEventOutcome, lotteryOutcome, witchOutcome, choiceOutcome, automaticOutcome}: Pick<
	CollectorOutcomeViewProps,
	"bigEventOutcome" | "lotteryOutcome" | "witchOutcome" | "choiceOutcome" | "automaticOutcome"
>): ReactNode {
	if (bigEventOutcome) return <BigEventOutcomeScreen outcome={bigEventOutcome} onContinue={reportEventStore.clear} />;
	if (lotteryOutcome) return <LotteryOutcomeScreen outcome={lotteryOutcome} onContinue={reportEventStore.clearLottery} />;
	if (witchOutcome) return <WitchOutcomeScreen outcome={witchOutcome} onContinue={reportEventStore.clearWitch} />;
	if (choiceOutcome) return <SmallEventChoiceOutcomeScreen outcome={choiceOutcome} onContinue={reportEventStore.clearChoice} />;
	if (automaticOutcome) return <AutomaticSmallEventOutcomeScreen outcome={automaticOutcome} onContinue={reportEventStore.clearAutomatic} />;
	return null;
}

function storedRecoveryOutcome({tokenOutcome, healOutcome, shopResult, continueAfterTokenOutcome, continueAfterHealOutcome}: Pick<
	CollectorOutcomeViewProps,
	"tokenOutcome" | "healOutcome" | "shopResult" | "continueAfterTokenOutcome" | "continueAfterHealOutcome"
>): ReactNode {
	if (tokenOutcome && tokenOutcomeNeedsAcknowledgement(tokenOutcome)) {
		return <TokenOutcomeScreen outcome={tokenOutcome} onContinue={continueAfterTokenOutcome} />;
	}
	if (healOutcome) return <HealOutcomeScreen outcome={healOutcome} onContinue={continueAfterHealOutcome} />;
	if (shopResult) return <ShopResultScreen result={shopResult} onContinue={reportEventStore.clearShopResult} />;
	return null;
}

function CollectorOutcomeView({
	bigEventCollector,
	adventureCollector,
	bigEventOutcome,
	lotteryOutcome,
	witchOutcome,
	choiceOutcome,
	automaticOutcome,
	tokenOutcome,
	healOutcome,
	shopResult,
	reactToCollector,
	isAnswerPending,
	continueAfterTokenOutcome,
	continueAfterHealOutcome
}: CollectorOutcomeViewProps): ReactNode {
	if (bigEventCollector) {
		return collectorScreen(bigEventCollector, reactToCollector, isAnswerPending);
	}
	const eventOutcome = storedEventOutcome({bigEventOutcome, lotteryOutcome, witchOutcome, choiceOutcome, automaticOutcome});
	if (eventOutcome) return eventOutcome;
	const recoveryOutcome = storedRecoveryOutcome({tokenOutcome, healOutcome, shopResult, continueAfterTokenOutcome, continueAfterHealOutcome});
	if (recoveryOutcome) return recoveryOutcome;
	if (adventureCollector) {
		return collectorScreen(adventureCollector, reactToCollector, isAnswerPending);
	}
	return null;
}

function ReportFailure({state}: {state: Extract<RequestState<ReportViewRes>, {status: "failed"}>}): ReactNode {
	const rejection = state.rejection;
	if (rejection?.type === COMMAND_REJECTIONS.EFFECT && rejection.currentEffectId === PLAYER_EFFECTS.DEAD) return <Screen>
		<Standing caption={i18n.t("app:adventure.eyebrow")} title={i18n.t("app:utilities.respawn")} subtitle={i18n.t("app:utilities.respawnWarning")} />
		<RespawnAction />
	</Screen>;
	return <Screen><GameQueryContent state={state} entity={GAME_ENTITIES.REPORT}>{() => null}</GameQueryContent></Screen>;
}

function ReportStatusView({
	reportState,
	waitingForCollector
}: {
	reportState: RequestState<ReportViewRes>;
	waitingForCollector: boolean;
}): ReactNode {
	if (waitingForCollector) {
		return <Centered><EmptyState>{i18n.t("app:collector.pending")}</EmptyState></Centered>;
	}	switch (reportState.status) {
		case "loading":
			return (
				<Centered>
					<ActivityIndicator />
					<Text style={styles.message}>{i18n.t("app:common.loading")}</Text>
				</Centered>
			);
		case "empty":
			return <Centered><EmptyState>{i18n.t("app:adventure.empty")}</EmptyState></Centered>;
		case "failed":
			return <ReportFailure state={reportState} />;
		case "ready":
			return null;
		default:
			return null;
	}
}

function RoutePanel({packet, metrics}: {
  packet: ReportTravelSummaryRes;
  metrics: TravelMetrics;
}): ReactNode {
  return <TravelPath packet={packet} progress={metrics.progress} />;
}

function TravelQuickActions({packet, onAdvance, onHeal, advancePending, healPending}: {
	packet: ReportTravelSummaryRes;
	onAdvance: () => void;
	onHeal: () => void;
	advancePending: boolean;
	healPending: boolean;
}): ReactNode {
	const cannotAffordHeal = packet.heal !== undefined && !packet.heal.canAfford;
	return <>
		<QuickActions>
			{packet.heal ? (
				<QuickAction
					icon={AppIcons.getIcon("shopItems.healAlteration")}
					disabled={cannotAffordHeal || healPending}
					onPress={packet.heal.canAfford ? onHeal : undefined}
				>
					{i18n.t("app:adventure.quick.heal")}
				</QuickAction>
			) : null}
			{packet.tokens ? (
				<QuickAction icon={AppIcons.getIcon("unitValues.token")} disabled={advancePending} onPress={onAdvance}>
					{packet.tokens.canAfford
						? i18n.t("app:adventure.quick.advanceWithCost", {count: packet.tokens.cost})
						: i18n.t("app:adventure.quick.getTokens")}
				</QuickAction>
			) : null}
		</QuickActions>
		{cannotAffordHeal ? <LockHint lock={{reason: i18n.t("app:adventure.quick.healNotEnough", {price: formatMoney(packet.heal?.price ?? 0)}), icon: CircleAlert}} /> : null}
	</>;
}

function isAlterationReport(packet: ReportTravelSummaryRes): boolean {
	return packet.effect !== undefined && packet.effect !== "none";
}

function alterationTitle(packet: ReportTravelSummaryRes): string {
	const icon = packet.effect ? AppIcons.getIconOrNull(`effects.${packet.effect}`) : null;
	const title = packet.effect ? i18n.t(`error:effects.${packet.effect}.self`) : i18n.t("app:adventure.alteration.title");
	return icon ? `${icon} ${title}` : title;
}

function alterationRemainingMilliseconds(packet: ReportTravelSummaryRes, metrics: TravelMetrics, currentTime: number): number {
	if (packet.effectEndTime === undefined) {
		return metrics.remainingMilliseconds;
	}
	return Math.max(0, packet.effectEndTime - currentTime);
}

function AlterationPanel({packet, metrics, currentTime}: {
	packet: ReportTravelSummaryRes;
	metrics: TravelMetrics;
	currentTime: number;
}): ReactNode {
	const remainingMilliseconds = alterationRemainingMilliseconds(packet, metrics, currentTime);
	return <Figures items={[
		{caption: i18n.t("app:adventure.alteration.fields.timeRemaining"), value: formatDuration(remainingMilliseconds)},
		...packet.heal ? [{caption: i18n.t("app:adventure.alteration.fields.price"), value: String(packet.heal.price), unit: "money"}] : []
	]} />;
}

type AdventureContext = {
	packet: ReportTravelSummaryRes;
	currentTime: number;
	metrics: TravelMetrics;
	destination: string;
};

function travelTitle(packet: ReportTravelSummaryRes): string {
	const lastSmallEvent = packet.lastSmallEventId
		? AppIcons.getIconOrNull(`smallEvents.${packet.lastSmallEventId}`)
		: null;
	return lastSmallEvent
		? i18n.t("app:adventure.travel.titleWithLastEvent", {smallEvent: lastSmallEvent})
		: i18n.t("app:adventure.travel.title");
}

function adventureTitle({packet}: AdventureContext): string {
	if (isAlterationReport(packet)) {
		return alterationTitle(packet);
	}
	if (packet.isInCity) {
		return i18n.t("app:adventure.cityTitle");
	}
	return travelTitle(packet);
}

function adventureSubtitle({packet, currentTime, metrics, destination}: AdventureContext): string {
	const altered = isAlterationReport(packet);
	const remainingMilliseconds = altered
		? alterationRemainingMilliseconds(packet, metrics, currentTime)
		: metrics.remainingMilliseconds;
	if (altered) {
		return i18n.t("app:adventure.alteration.description", {time: formatDuration(remainingMilliseconds)});
	}
	if (packet.isInCity) {
		return i18n.t("app:adventure.citySubtitle", {location: destination});
	}
	if (!hasNextStop(packet)) {
		return i18n.t("app:adventure.travel.subtitleArrivingSoon", {
			destination,
			remaining: formatDuration(remainingMilliseconds)
		});
	}
	return i18n.t("app:adventure.travel.subtitle", {
		nextStop: nextStopDuration(packet, currentTime),
		destination,
		remaining: formatDuration(remainingMilliseconds)
	});
}

/** The emblem says where the journey is heading, or what is holding the player back. */
function adventureEmblem(packet: ReportTravelSummaryRes): ReactNode {
	const icon = isAlterationReport(packet) && packet.effect
		? AppIcons.getIconOrNull(`effects.${packet.effect}`)
		: AppIcons.getIconOrNull(`mapTypes.${packet.endMap.type}`);
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : null;
}

function travelFigures(packet: ReportTravelSummaryRes, metrics: TravelMetrics, currentTime: number): Figure[] {
	return [
		{caption: i18n.t("app:adventure.fields.timeRemaining"), value: formatDuration(metrics.remainingMilliseconds)},
		...hasNextStop(packet) ? [{caption: i18n.t("app:adventure.fields.nextStop"), value: nextStopDuration(packet, currentTime)}] : [],
		...packet.points.show ? [{caption: i18n.t("app:adventure.fields.points"), value: String(packet.points.cumulated), unit: "score"}] : []
	];
}

/** The report is the one thing to do here, so it says by itself why it is not ready yet. */
function ReportAdvance({reportReady, reportAction, waitFor}: {reportReady: boolean; reportAction: GameMutation<void>; waitFor?: string}): ReactNode {
	const lock = reportReady ? undefined : {reason: i18n.t("app:adventure.notReady", {time: waitFor ?? i18n.t("app:adventure.now")}), icon: Clock3};
	return <>
		{reportAction.message ? <Note>{reportAction.message}</Note> : null}
		<ActionBanner
			icon={BookOpen}
			label={i18n.t("app:adventure.continueReport")}
			pending={reportAction.pending}
			onPress={(): void => {
				reportAction.submit().catch(console.error);
			}}
			{...lock ? {lock} : {}}
		/>
	</>;
}

const ADVENTURE_TOOLS = {
	MAP: {title: "app:map.title", content: WorldMap},
	UNLOCK: {title: "app:utilities.unlock", content: PrisonerRelease}
} as const;
type AdventureTool = keyof typeof ADVENTURE_TOOLS;

/** Side trips that belong to the journey screen itself, never on top of an open menu. */
function AdventureTools({onOpen}: {onOpen: (tool: AdventureTool) => void}): ReactNode {
	return <QuickActions>
		<QuickAction icon={AppIcons.getIcon("expedition.map")} onPress={(): void => onOpen("MAP")}>{i18n.t("app:map.title")}</QuickAction>
		<QuickAction icon={AppIcons.getIcon("notifications.types.playerFreedFromJail")} onPress={(): void => onOpen("UNLOCK")}>{i18n.t("app:utilities.unlock")}</QuickAction>
	</QuickActions>;
}

function AdventureSheet({packet, currentTime, onAdvance, onHeal, advancePending, healPending, reportReady, reportAction, tools}: {
	packet: ReportTravelSummaryRes;
	currentTime: number;
	onAdvance: () => void;
	onHeal: () => void;
	advancePending: boolean;
	healPending: boolean;
	reportReady: boolean;
	reportAction: GameMutation<void>;
	tools: ReactNode;
}): ReactNode {
  const metrics = getTravelMetrics(packet, currentTime);
  const destination = mapName(packet.endMap);
  const altered = isAlterationReport(packet);
  const context: AdventureContext = {packet, currentTime, metrics, destination};
  const advice = travelAdvice(packet.nextStopTime);

  return (
    <Screen>
      <Standing
        emblem={adventureEmblem(packet)}
        caption={altered ? i18n.t("app:adventure.alteration.eyebrow") : packet.isInCity ? i18n.t("app:adventure.eyebrow") : i18n.t("app:adventure.travel.eyebrow")}
        title={adventureTitle(context)}
        subtitle={adventureSubtitle(context)}
      >
        {altered && packet.isInCity ? null : <RoutePanel packet={packet} metrics={metrics} />}
      </Standing>
      {altered && packet.isInCity
        ? <AlterationPanel packet={packet} metrics={metrics} currentTime={currentTime} />
        : <Figures items={travelFigures(packet, metrics, currentTime)} />}
      <ReportAdvance reportReady={reportReady} reportAction={reportAction} waitFor={nextStopDuration(packet, currentTime)} />
		{(!packet.isInCity || altered) ? (
			<TravelQuickActions
				packet={packet}
				onAdvance={onAdvance}
				onHeal={onHeal}
				advancePending={advancePending}
				healPending={healPending}
			/>
		) : null}
		{advice ? <Note>{advice}</Note> : null}
		{tools}
    </Screen>
  );
}

function AdventureBody({tools}: {tools: ReactNode}): ReactNode {
	const reportState = useReportView();
	const travel = reportState.status === "ready" ? reportState.data.travel : undefined;
	const reportAction = useReportAdvance();
	useReportRefreshAtNextStop(travel ?? null);
	const queryClient = useQueryClient();
	const [advancePending, setAdvancePending] = useState(false);
	const [healPending, setHealPending] = useState(false);
	const {
		open: openCollectors, react: reactToCollector, isAnswerPending
	} = useCollectors();
	const bigEventCollector = openCollectors.find(isBigEventCollector);
	const tokenUseCollector = openCollectors.find(isTokenUseCollector);
	const buyHealCollector = openCollectors.find(isBuyHealCollector);
	const adventureCollector = openCollectors.find(isAdventureScreenCollector);
	const bigEventOutcome = useBigEventOutcome();
	const lotteryOutcome = useLotteryOutcome();
	const witchOutcome = useWitchOutcome();
	const choiceOutcome = useSmallEventChoiceOutcome();
	const automaticOutcome = useAutomaticSmallEventOutcome();
	const tokenOutcome = useTokenOutcome();
	const healOutcome = useHealOutcome();
	const shopResult = useShopResult();
	const currentTime = useCurrentTime();

	useEffect(() => {
		if (!tokenOutcome || tokenOutcomeNeedsAcknowledgement(tokenOutcome)) {
			return;
		}
		// CollectorStop already invalidates profile and report for this resolved action.
		reportEventStore.clearTokens();
	}, [tokenOutcome]);

	const advanceWithTokens = (): void => {
		if (advancePending) {
			return;
		}
		setAdvancePending(true);
		requestTokenAdvance().finally(() => setAdvancePending(false));
	};

	const buyHeal = (): void => {
		if (healPending) {
			return;
		}
		setHealPending(true);
		requestBuyHeal().finally(() => setHealPending(false));
	};

	const continueAfterTokenOutcome = (): void => {
		reportEventStore.clearTokens();
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.REPORT]) {
			queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(error => {
				console.error(`Failed to refresh ${entity} after token action:`, error);
			});
		}
	};

	const continueAfterHealOutcome = (): void => {
		reportEventStore.clearHeal();
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.REPORT]) {
			queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(error => {
				console.error(`Failed to refresh ${entity} after heal action:`, error);
			});
		}
	};

  const collectorOutcome = CollectorOutcomeView({
    bigEventCollector,
    adventureCollector,
    bigEventOutcome,
		lotteryOutcome,
		witchOutcome,
		choiceOutcome,
		automaticOutcome,
		tokenOutcome,
		healOutcome,
		shopResult,
		reactToCollector,
		isAnswerPending,
		continueAfterTokenOutcome,
		continueAfterHealOutcome
  });
  if (collectorOutcome) {
		return collectorOutcome;
	}
	const pendingReportCollector = tokenUseCollector ?? buyHealCollector;
	const pendingReportConfirmation = pendingReportCollector ? collectorScreen(pendingReportCollector, reactToCollector, isAnswerPending) : null;
	if (pendingReportCollector && reportState.status !== "ready") {
		return (
			<>
				<Centered><ActivityIndicator /></Centered>
				{pendingReportConfirmation}
			</>
		);
	}

	// Blocked means Core is busy with this player, not that the report is absent.
	const reportIsWaitingForCollector = reportState.status === "empty" && reportState.packetName === Blocked.wireName
		|| openCollectors.length > 0
		&& (reportState.status === "loading"
			|| reportState.status === "empty" && reportState.packetName === ReactionCollectorCreation.wireName);
	const reportStatus = ReportStatusView({reportState, waitingForCollector: reportIsWaitingForCollector});
	if (reportStatus) {
		return reportStatus;
	}
	if (reportState.status !== "ready") {
		return null;
	}
	if (reportState.data.city) {
		return <><ReportCity city={reportState.data.city} />{pendingReportConfirmation}</>;
	}
	if (!travel) {
		return <>
			<Screen>
				<Standing caption={i18n.t("app:adventure.eyebrow")} title={i18n.t("app:adventure.startReport")} />
				<ReportAdvance reportReady={reportState.data.reportReady} reportAction={reportAction} />
				{tools}
			</Screen>
			{pendingReportConfirmation}
		</>;
	}

	return (
		<>
			<AdventureSheet
				packet={travel}
				currentTime={currentTime}
				onAdvance={advanceWithTokens}
				onHeal={buyHeal}
				advancePending={advancePending}
				healPending={healPending}
				reportReady={reportState.data.reportReady}
				reportAction={reportAction}
				tools={tools}
			/>
			{pendingReportConfirmation}
		</>
	);
}

function AdventureToolScreen({tool, onClose}: {tool: AdventureTool; onClose: () => void}): ReactNode {
	const {title, content: Content} = ADVENTURE_TOOLS[tool];
	return <DetailScreen overlay title={i18n.t(title)} eyebrow={i18n.t("app:adventure.eyebrow")} onClose={onClose}><Content /></DetailScreen>;
}

export default function Index(): ReactNode {
	const [tool, setTool] = useState<AdventureTool | null>(null);
	return (
		<View style={styles.adventureRoot}>
			<PlayerVitals />
			<AdventureBody tools={<AdventureTools onOpen={setTool} />} />
			{tool ? <AdventureToolScreen tool={tool} onClose={(): void => setTool(null)} /> : null}
		</View>
	);
}
