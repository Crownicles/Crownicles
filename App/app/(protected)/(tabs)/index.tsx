import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {AppIcons} from "@/src/AppIcons";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useCollectors} from "@/src/collectors/CollectorsContext";
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

function RoutePanel({packet, destination, metrics}: {
  packet: ReportTravelSummaryRes;
  destination: string;
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

function TravelQuickActions(): ReactNode {
  return (
    <QuickActions>
      <QuickAction icon={AppIcons.getIcon("unitValues.token")}>
        {i18n.t("app:adventure.quick.advance")}
      </QuickAction>
      <QuickAction icon={AppIcons.getIcon("expedition.map")}>
        {i18n.t("app:adventure.quick.map")}
      </QuickAction>
    </QuickActions>
  );
}

function AdventureSheet({packet, currentTime}: {
  packet: ReportTravelSummaryRes;
  currentTime: number;
}): ReactNode {
  const metrics = getTravelMetrics(packet, currentTime);
  const destination = mapName(packet.endMap);
  const title = packet.isInCity
    ? i18n.t("app:adventure.cityTitle")
    : i18n.t("app:adventure.travel.title");
  const subtitle = packet.isInCity
    ? i18n.t("app:adventure.citySubtitle", {location: destination})
    : i18n.t("app:adventure.travel.subtitle", {
      nextStop: nextStopDuration(packet, currentTime),
      destination,
      remaining: formatDuration(metrics.remainingMilliseconds)
    });

  return (
    <Screen>
      <Hero
        eyebrow={packet.isInCity ? i18n.t("app:adventure.eyebrow") : i18n.t("app:adventure.travel.eyebrow")}
        title={title}
        subtitle={subtitle}
      />

      <RoutePanel packet={packet} destination={destination} metrics={metrics} />
      {!packet.isInCity ? <TravelQuickActions /> : null}
    </Screen>
  );
}

export default function Index(): ReactNode {
  const reportState = useGameQuery<ReportTravelSummaryRes>(GAME_ENTITIES.REPORT, requestReport);
  const {open: openCollectors} = useCollectors();
  const currentTime = useCurrentTime();

  const reportIsWaitingForCollector = openCollectors.length > 0
    && (reportState.status === "loading"
      || reportState.status === "empty" && reportState.packetName === ReactionCollectorCreation.name);

  if (reportIsWaitingForCollector) {
    return <Centered><EmptyState>{i18n.t("app:collector.pending")}</EmptyState></Centered>;
  }
  if (reportState.status === "loading") {
    return (
      <Centered>
        <ActivityIndicator />
        <Text style={styles.message}>{i18n.t("app:common.loading")}</Text>
      </Centered>
    );
  }
  if (reportState.status === "empty") {
    return <Centered><EmptyState>{i18n.t("app:adventure.empty")}</EmptyState></Centered>;
  }
  if (reportState.status === "failed") {
    return <Centered><Text style={styles.message}>{i18n.t("app:common.error")}</Text></Centered>;
  }

  return <AdventureSheet packet={reportState.data} currentTime={currentTime} />;
}
