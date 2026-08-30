import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {ReportBuyHealReq} from "ws-packets/src/fromClient/ReportBuyHealReq";
import {ReportUseTokensReq} from "ws-packets/src/fromClient/ReportUseTokensReq";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
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
import {AppIcons} from "@/src/AppIcons";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {gameKey, GAME_ENTITIES} from "@/src/store/GameEntities";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {
	AdventureCollector,
	BigEventOutcome as BigEventOutcomeScreen,
	HealOutcome as HealOutcomeScreen,
	LotteryOutcome as LotteryOutcomeScreen,
	SmallEventOutcome as SmallEventOutcomeScreen,
	TokenOutcome as TokenOutcomeScreen
} from "@/src/collectors/AdventureCollector";
import type {
	LotteryOutcome as LotteryOutcomeData,
	SmallEventOutcome as SmallEventOutcomeData,
	TokenOutcome as TokenOutcomeData
} from "@/src/collectors/ReportEventStore";
import {
	isAdventureScreenCollector, isBigEventCollector, isBuyHealCollector, isTokenUseCollector
} from "@/src/collectors/CollectorRouting";
import {
	reportEventStore, useBigEventOutcome, useHealOutcome, useLotteryOutcome, useSmallEventOutcome, useTokenOutcome
} from "@/src/collectors/ReportEventStore";
import {
  EmptyState, Hero, KeyValue, Panel, QuickAction, QuickActions, Screen
} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

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

function requestReport(): Promise<GameAnswer<ReportTravelSummaryRes>> {
	return GameClient.request(makeFromClientPacket(ReportReq, {}), ReportTravelSummaryRes, [ReactionCollectorCreation]);
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
  return i18n.t(durationKey, hours > NO_PROGRESS ? {hours, minutes} : {minutes: totalMinutes});
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

function mapLabel(map: MapPoint): string {
  const icon = AppIcons.getIconOrNull(`mapTypes.${map.type}`);
  const name = mapName(map);
  return icon ? `${icon} ${name}` : name;
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
  if (packet.nextStopTime > packet.arriveTime) {
    return i18n.t("app:adventure.noNextStop");
  }
  if (packet.nextStopTime <= currentTime) {
    return i18n.t("app:adventure.now");
  }
  return formatDuration(packet.nextStopTime - currentTime);
}

export function reportRefreshDelay(packet: ReportTravelSummaryRes, now = Date.now()): number | null {
	if (packet.nextStopTime > packet.arriveTime) {
		return null;
	}
	return Math.max(0, packet.nextStopTime - now);
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
	smallEventOutcome: SmallEventOutcomeData | null;
	tokenOutcome: TokenOutcomeData | null;
	healOutcome: ReturnType<typeof useHealOutcome>;
	reactToCollector: (collectorId: string, reactionIndex: number) => void;
	isAnswerPending: (collectorId: string) => boolean;
	continueAfterTokenOutcome: () => void;
	continueAfterHealOutcome: () => void;
};

function CollectorOutcomeView({
	bigEventCollector,
	adventureCollector,
	bigEventOutcome,
	lotteryOutcome,
	smallEventOutcome,
	tokenOutcome,
	healOutcome,
	reactToCollector,
	isAnswerPending,
	continueAfterTokenOutcome,
	continueAfterHealOutcome
}: CollectorOutcomeViewProps): ReactNode {
	if (bigEventCollector) {
		return (
			<AdventureCollector
				collector={bigEventCollector}
				onChoose={(reactionIndex): void => reactToCollector(bigEventCollector.id, reactionIndex)}
				submitting={isAnswerPending(bigEventCollector.id)}
			/>
		);
	}
	if (bigEventOutcome) {
		return <BigEventOutcomeScreen outcome={bigEventOutcome} onContinue={reportEventStore.clear} />;
	}
	if (lotteryOutcome) {
		return <LotteryOutcomeScreen outcome={lotteryOutcome} onContinue={reportEventStore.clearLottery} />;
	}
	if (tokenOutcome) {
		return <TokenOutcomeScreen outcome={tokenOutcome} onContinue={continueAfterTokenOutcome} />;
	}
	if (healOutcome) {
		return <HealOutcomeScreen outcome={healOutcome} onContinue={continueAfterHealOutcome} />;
	}
	if (adventureCollector) {
		return (
			<AdventureCollector
				collector={adventureCollector}
				onChoose={(reactionIndex): void => reactToCollector(adventureCollector.id, reactionIndex)}
				submitting={isAnswerPending(adventureCollector.id)}
			/>
		);
	}
	if (smallEventOutcome) {
		return <SmallEventOutcomeScreen outcome={smallEventOutcome} onContinue={reportEventStore.clearSmallEvent} />;
	}
	return null;
}

function ReportStatusView({
	reportState,
	waitingForCollector
}: {
	reportState: RequestState<ReportTravelSummaryRes>;
	waitingForCollector: boolean;
}): ReactNode {
	if (waitingForCollector) {
		return <Centered><EmptyState>{i18n.t("app:collector.pending")}</EmptyState></Centered>;
	}
	switch (reportState.status) {
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
			return <Centered><Text style={styles.message}>{i18n.t("app:common.error")}</Text></Centered>;
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
  return (
    <Panel>
      <TravelPath packet={packet} progress={metrics.progress} />
      <KeyValue label={i18n.t("app:adventure.fields.departure")} value={mapLabel(packet.startMap)} />
      <KeyValue label={i18n.t("app:adventure.fields.arrival")} value={mapLabel(packet.endMap)} />
      {!packet.isInCity && (
        <KeyValue
          label={i18n.t("app:adventure.fields.timeRemaining")}
          value={formatDuration(metrics.remainingMilliseconds)}
        />
      )}
      {packet.points.show && (
        <KeyValue
          label={`${AppIcons.getIcon("unitValues.score")} ${i18n.t("app:adventure.fields.points")}`}
          value={String(packet.points.cumulated)}
        />
      )}
    </Panel>
  );
}

function TravelQuickActions({packet, onAdvance, onHeal, advancePending, healPending}: {
	packet: ReportTravelSummaryRes;
	onAdvance: () => void;
	onHeal: () => void;
	advancePending: boolean;
	healPending: boolean;
}): ReactNode {
	return (
		<QuickActions>
			{packet.heal ? (
				<QuickAction
					icon={AppIcons.getIcon("shopItems.healAlteration")}
					disabled={!packet.heal.canAfford || healPending}
					onPress={packet.heal.canAfford ? onHeal : undefined}
				>
					{i18n.t("app:adventure.quick.heal")}
				</QuickAction>
			) : null}
			{packet.tokens ? (
				<QuickAction icon={AppIcons.getIcon("unitValues.token")} disabled={advancePending} onPress={onAdvance}>
					{i18n.t("app:adventure.quick.advance")}
				</QuickAction>
			) : null}
			{!packet.isInCity ? (
				<QuickAction icon={AppIcons.getIcon("expedition.map")}>
					{i18n.t("app:adventure.quick.map")}
				</QuickAction>
			) : null}
		</QuickActions>
	);
}

function isAlterationReport(packet: ReportTravelSummaryRes): boolean {
	return packet.effect !== undefined && packet.effect !== "none";
}

function alterationTitle(packet: ReportTravelSummaryRes): string {
	const icon = packet.effect ? AppIcons.getIconOrNull(`effects.${packet.effect}`) : null;
	const title = packet.effect ? i18n.t(`error:effects.${packet.effect}.self`) : i18n.t("app:adventure.alteration.title");
	return icon ? `${icon} ${title}` : title;
}

function alterationRemainingMilliseconds(packet: ReportTravelSummaryRes, currentTime: number, fallback: number): number {
	if (packet.effectEndTime === undefined) {
		return fallback;
	}
	return Math.max(0, packet.effectEndTime - currentTime);
}

function AlterationPanel({packet, metrics, currentTime}: {
	packet: ReportTravelSummaryRes;
	metrics: TravelMetrics;
	currentTime: number;
}): ReactNode {
	const remainingMilliseconds = alterationRemainingMilliseconds(packet, currentTime, metrics.remainingMilliseconds);
	return (
		<Panel>
			{packet.effect ? (
				<KeyValue label={i18n.t("app:adventure.alteration.fields.status")} value={alterationTitle(packet)} />
			) : null}
			<KeyValue
				label={i18n.t("app:adventure.alteration.fields.timeRemaining")}
				value={formatDuration(remainingMilliseconds)}
			/>
			{packet.heal ? (
				<KeyValue
					label={i18n.t("app:adventure.alteration.fields.price")}
					value={`${packet.heal.price.toLocaleString("fr-FR")} 💰`}
				/>
			) : null}
		</Panel>
	);
}

type AdventureContext = {
	packet: ReportTravelSummaryRes;
	currentTime: number;
	metrics: TravelMetrics;
	destination: string;
};

function adventureTitle({packet}: AdventureContext): string {
	if (isAlterationReport(packet)) {
		return alterationTitle(packet);
	}
	if (packet.isInCity) {
		return i18n.t("app:adventure.cityTitle");
	}
	return i18n.t("app:adventure.travel.title");
}

function adventureSubtitle({packet, currentTime, metrics, destination}: AdventureContext): string {
	const altered = isAlterationReport(packet);
	const remainingMilliseconds = altered
		? alterationRemainingMilliseconds(packet, currentTime, metrics.remainingMilliseconds)
		: metrics.remainingMilliseconds;
	if (altered) {
		return i18n.t("app:adventure.alteration.description", {time: formatDuration(remainingMilliseconds)});
	}
	if (packet.isInCity) {
		return i18n.t("app:adventure.citySubtitle", {location: destination});
	}
	return i18n.t("app:adventure.travel.subtitle", {
		nextStop: nextStopDuration(packet, currentTime),
		destination,
		remaining: formatDuration(remainingMilliseconds)
	});
}

function AdventureSheet({packet, currentTime, onAdvance, onHeal, advancePending, healPending}: {
	packet: ReportTravelSummaryRes;
	currentTime: number;
	onAdvance: () => void;
	onHeal: () => void;
	advancePending: boolean;
	healPending: boolean;
}): ReactNode {
  const metrics = getTravelMetrics(packet, currentTime);
  const destination = mapName(packet.endMap);
  const altered = isAlterationReport(packet);
  const context: AdventureContext = {packet, currentTime, metrics, destination};
  const title = adventureTitle(context);
  const subtitle = adventureSubtitle(context);

  return (
    <Screen>
      <Hero
        eyebrow={altered ? i18n.t("app:adventure.alteration.eyebrow") : packet.isInCity ? i18n.t("app:adventure.eyebrow") : i18n.t("app:adventure.travel.eyebrow")}
        title={title}
        subtitle={subtitle}
      />

      {altered && packet.isInCity ? <AlterationPanel packet={packet} metrics={metrics} currentTime={currentTime} /> : <RoutePanel packet={packet} metrics={metrics} />}
		{(!packet.isInCity || altered) ? (
			<TravelQuickActions
				packet={packet}
				onAdvance={onAdvance}
				onHeal={onHeal}
				advancePending={advancePending}
				healPending={healPending}
			/>
		) : null}
    </Screen>
  );
}

export default function Index(): ReactNode {
	const reportState = useGameQuery<ReportTravelSummaryRes>(GAME_ENTITIES.REPORT, requestReport);
	useReportRefreshAtNextStop(reportState.status === "ready" ? reportState.data : null);
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
	const smallEventOutcome = useSmallEventOutcome();
	const tokenOutcome = useTokenOutcome();
	const healOutcome = useHealOutcome();
	const currentTime = useCurrentTime();

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
		smallEventOutcome,
		tokenOutcome,
		healOutcome,
		reactToCollector,
		isAnswerPending,
		continueAfterTokenOutcome,
		continueAfterHealOutcome
  });
  if (collectorOutcome) {
		return collectorOutcome;
	}

	const reportIsWaitingForCollector = openCollectors.length > 0
		&& (reportState.status === "loading"
			|| reportState.status === "empty" && reportState.packetName === ReactionCollectorCreation.name);
	const reportStatus = ReportStatusView({reportState, waitingForCollector: reportIsWaitingForCollector});
	if (reportStatus) {
		return reportStatus;
	}
	if (reportState.status !== "ready") {
		return null;
	}

		return (
		<View style={styles.adventureRoot}>
			<AdventureSheet
				packet={reportState.data}
				currentTime={currentTime}
				onAdvance={advanceWithTokens}
				onHeal={buyHeal}
				advancePending={advancePending}
				healPending={healPending}
			/>
			{tokenUseCollector ? (
				<AdventureCollector
					collector={tokenUseCollector}
					onChoose={(reactionIndex): void => reactToCollector(tokenUseCollector.id, reactionIndex)}
					submitting={isAnswerPending(tokenUseCollector.id)}
				/>
			) : null}
			{buyHealCollector ? (
				<AdventureCollector
					collector={buyHealCollector}
					onChoose={(reactionIndex): void => reactToCollector(buyHealCollector.id, reactionIndex)}
					submitting={isAnswerPending(buyHealCollector.id)}
				/>
			) : null}
		</View>
	);
}
