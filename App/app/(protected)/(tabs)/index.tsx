import {ReactNode, useEffect, useRef, useState} from "react";
import {ActivityIndicator, Animated, Easing, StyleSheet, Text, View} from "react-native";
import {useQueryClient} from "@tanstack/react-query";
import {notificationAsync, NotificationFeedbackType} from "expo-haptics";
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
import {GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
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
import {ActionBanner, Figure, Figures, Standing} from "@/src/design/Sections";
import {Entrance} from "@/src/design/Entrance";
import {Cure, CureEmblem, HappyEmblem} from "@/src/components/CureEmblem";
import {plainStory} from "@/src/display/Markdown";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {SilentAnswer, useReportShortcut} from "@/src/store/useReportShortcut";
import {BookOpen, CircleAlert, Clock3} from "@/src/design/FightIcons";
import {PlayerVitals} from "@/src/components/PlayerVitals";
import {formatMoney} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {WorldMap} from "@/src/components/WorldMap";
import {DetailScreen} from "@/src/design/DetailScreen";
import {PrisonerRelease} from "@/src/components/Utilities";
import {DeathScreen} from "@/src/components/DeathScreen";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {AdventureWelcome} from "@/src/components/AdventureWelcome";
import {JourneyGuide} from "@/src/components/JourneyGuide";
import {useJourney} from "@/src/journey/useJourney";
import {PLAYER_EFFECTS} from "ws-packets/src/objects/PlayerUtility";
import {COMMAND_REJECTIONS} from "ws-packets/src/objects/CommandRejection";
import {useReportView, useReportAdvance} from "@/src/store/useReportActions";
import {GameMutation} from "@/src/store/useGameMutation";
import {ReportCity} from "@/src/components/ReportCity";

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
const FULL_PROGRESS = 1;
const NO_PROGRESS = 0;
const PERCENTAGE_SCALE = 100;
const REPORT_READY_PULSE = {fromScale: 0.96, damping: 18, stiffness: 220, mass: 0.8} as const;

/** The run to the next stop once tokens are spent: long enough to be seen, short enough not to be waited for. */
const TRAVEL_DASH = {durationMs: 1_100, strideMs: 110, hop: -7, lean: "10deg"} as const;

/** Where the runner dashes to, and what happens once it is there. */
type TravelDash = {to: number; onDone: () => void};

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
  actions: {
    gap: Theme.spacing.md
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

function acceptAnswer(collector: ReactionCollectorCreation): SilentAnswer | null {
	const reactionIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
	return reactionIndex >= 0 ? {collectorId: collector.id, reactionIndex} : null;
}

/** The button already names the token cost, so pressing it answers Core's confirmation, if it can be answered. */
function tokenAdvanceConfirmation(answer: GameAnswer<ReactionCollectorCreation>): SilentAnswer | null {
	if (answer.kind !== "answer") return null;
	const {data} = answer.packet;
	if (data.type !== REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS || data.data.playerTokens < data.data.cost) return null;
	return acceptAnswer(answer.packet);
}

/** The heal button already names its price, so pressing it answers Core's confirmation the same way. */
function healConfirmation(answer: GameAnswer<ReactionCollectorCreation>): SilentAnswer | null {
	if (answer.kind !== "answer" || answer.packet.data.type !== REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL) return null;
	return acceptAnswer(answer.packet);
}

function celebrate(): void {
	notificationAsync(NotificationFeedbackType.Success).catch(() => undefined);
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
	return formatDurationMinutes(milliseconds / MILLISECONDS_PER_MINUTE);
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

/** Twemoji draws the walker and the ferry heading left, so it is mirrored to face the destination on the right. */
function TravelRunner({packet, position, stride}: {packet: ReportTravelSummaryRes; position: Animated.AnimatedInterpolation<string>; stride: Animated.Value}): ReactNode {
  return <Animated.View style={[styles.runner, {left: position}]}>
    <Animated.View style={{transform: [
      {translateY: stride.interpolate({inputRange: [0, 1], outputRange: [0, TRAVEL_DASH.hop]})},
      {rotate: stride.interpolate({inputRange: [0, 1], outputRange: ["0deg", TRAVEL_DASH.lean]})},
      {scaleX: -1}
    ]}}>
      <TwemojiIcon emoji={runnerIcon(packet)} size={Theme.dimensions.quickActionIcon} />
    </Animated.View>
  </Animated.View>;
}

function TravelPath({packet, progress, dash}: { packet: ReportTravelSummaryRes; progress: number; dash: TravelDash | null }): ReactNode {
  const progressLabel = i18n.t("app:adventure.onTheRoad");
  const reducedMotion = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(progress));
  const [stride] = useState(() => new Animated.Value(0));
  const reached = useRef<number | null>(null);

  useEffect(() => {
    if (dash) return;
    // The refreshed report may still place the runner before the stop it just dashed to.
    if (reached.current !== null && progress < reached.current) return;
    reached.current = null;
    shown.setValue(progress);
  }, [dash, progress, shown]);

  useEffect(() => {
    if (!dash) return undefined;
    if (reducedMotion) {
      reached.current = dash.to;
      shown.setValue(dash.to);
      dash.onDone();
      return undefined;
    }
    const strides = Animated.loop(Animated.sequence([
      Animated.timing(stride, {toValue: 1, duration: TRAVEL_DASH.strideMs, easing: Easing.out(Easing.quad), useNativeDriver: true}),
      Animated.timing(stride, {toValue: 0, duration: TRAVEL_DASH.strideMs, easing: Easing.in(Easing.quad), useNativeDriver: true})
    ]));
    strides.start();
    Animated.timing(shown, {toValue: dash.to, duration: TRAVEL_DASH.durationMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false}).start(() => {
      reached.current = dash.to;
      strides.stop();
      stride.setValue(0);
      dash.onDone();
    });
    return (): void => strides.stop();
  }, [dash, reducedMotion, shown, stride]);

  const position = shown.interpolate({inputRange: [NO_PROGRESS, FULL_PROGRESS], outputRange: ["0%", "100%"]});
  return (
    <View
      accessible
      accessibilityLabel={`${progressLabel}: ${Math.round(progress * PERCENTAGE_SCALE)}%`}
      style={styles.travelPath}
    >
      <View style={styles.mapNode}>{mapIcon(packet.startMap)}</View>
      <View style={styles.travelTrack}>
        <Animated.View style={[styles.travelFill, {width: position}]} />
        <TravelRunner packet={packet} position={position} stride={stride} />
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

function isAlterationReport(packet: ReportTravelSummaryRes): boolean {
	return packet.effect !== undefined && packet.effect !== "none";
}

function reportOpensAt(packet: ReportTravelSummaryRes): number {
	const nextStopOrArrival = Math.min(packet.nextStopTime, packet.arriveTime);
	return isAlterationReport(packet) ? Math.max(nextStopOrArrival, packet.effectEndTime ?? 0) : nextStopOrArrival;
}

/** Arriving opens the report too, so a stop planned after the arrival never delays it; an alteration holds it until it ends. */
export function reportWait(packet: ReportTravelSummaryRes, currentTime: number): string {
	const opensAt = reportOpensAt(packet);
	return opensAt <= currentTime ? i18n.t("app:adventure.now") : formatDuration(opensAt - currentTime);
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
	const advices = i18n.tArray("advices:advices").filter(advice => !/(?:^|\s)\/[a-z][\w-]*/i.test(advice));
	return advices.length === 0 ? "" : plainStory(advices[Math.abs(stopTime) % advices.length]);
}

export function reportRefreshDelay(packet: ReportTravelSummaryRes, now = Date.now()): number | null {
	const nextRefresh = packet.isInCity ? packet.effectEndTime : reportOpensAt(packet);
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
	if (rejection?.type === COMMAND_REJECTIONS.EFFECT && rejection.currentEffectId === PLAYER_EFFECTS.DEAD) return <DeathScreen />;
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

function RoutePanel({packet, metrics, dash}: {
  packet: ReportTravelSummaryRes;
  metrics: TravelMetrics;
  dash: TravelDash | null;
}): ReactNode {
  return <TravelPath packet={packet} progress={metrics.progress} dash={dash} />;
}

/** A report-side action the player triggers, and whether Core is still answering it. */
type PendingAction = {pending: boolean; onPress: () => void};

function HealAction({heal, action}: {heal: NonNullable<ReportTravelSummaryRes["heal"]>; action: PendingAction}): ReactNode {
	return <ActionBanner
		icon={CircleAlert}
		emoji={AppIcons.getIcon("shopItems.healAlteration")}
		label={i18n.t("app:adventure.quick.healWithCost", {price: formatMoney(heal.price)})}
		pending={action.pending}
		{...heal.canAfford ? {} : {lock: {reason: i18n.t("app:adventure.quick.healNotEnough", {price: formatMoney(heal.price)}), icon: CircleAlert}}}
		onPress={action.onPress}
	/>;
}

/** Long enough for the whole cure choreography, so only a cure whose emblem vanished ends here. */
const CURE_SAFETY_MS = 5_000;

/** Ends the cure once: when the emblem finishes it, or later if the report refreshes into a layout without the emblem. */
function once(finish: () => void): () => void {
	let finished = false;
	const end = (): void => {
		if (finished) return;
		finished = true;
		finish();
	};
	setTimeout(end, CURE_SAFETY_MS);
	return end;
}

function offersTokens(packet: ReportTravelSummaryRes): boolean {
	return packet.tokens !== undefined && (!packet.isInCity || isAlterationReport(packet));
}

function canCure(packet: ReportTravelSummaryRes): boolean {
	return !packet.isInCity || isAlterationReport(packet);
}


function alterationTitle(packet: ReportTravelSummaryRes): string {
	return packet.effect ? i18n.t(`error:effects.${packet.effect}.self`) : i18n.t("app:adventure.alteration.title");
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

/** Where the traveller stands: arrived, waiting at a stop the report will open, or still walking. */
const JOURNEY_STAGES = {ARRIVED: "arrived", STOP_DUE: "stopDue", TRAVELLING: "travelling"} as const;
type JourneyStage = typeof JOURNEY_STAGES[keyof typeof JOURNEY_STAGES];

function journeyStage({packet, metrics, currentTime}: AdventureContext): JourneyStage {
	if (metrics.remainingMilliseconds <= 0) return JOURNEY_STAGES.ARRIVED;
	return packet.nextStopTime <= currentTime ? JOURNEY_STAGES.STOP_DUE : JOURNEY_STAGES.TRAVELLING;
}

function travelTitle(context: AdventureContext): string {
	if (journeyStage(context) === JOURNEY_STAGES.ARRIVED) return i18n.t("app:adventure.travel.arrivedTitle");
	const {lastSmallEventId} = context.packet;
	const lastSmallEvent = lastSmallEventId ? AppIcons.getIconOrNull(`smallEvents.${lastSmallEventId}`) : null;
	return lastSmallEvent
		? i18n.t("app:adventure.travel.titleWithLastEvent", {smallEvent: lastSmallEvent})
		: i18n.t("app:adventure.travel.title");
}

function adventureTitle(context: AdventureContext): string {
	if (isAlterationReport(context.packet)) {
		return alterationTitle(context.packet);
	}
	if (context.packet.isInCity) {
		return i18n.t("app:adventure.cityTitle");
	}
	return travelTitle(context);
}

function travelSubtitle(context: AdventureContext): string {
	const {packet, currentTime, metrics, destination} = context;
	const stage = journeyStage(context);
	if (stage !== JOURNEY_STAGES.TRAVELLING) return i18n.t(`app:adventure.travel.${stage}Subtitle`, {destination});
	const remaining = formatDuration(metrics.remainingMilliseconds);
	return hasNextStop(packet)
		? i18n.t("app:adventure.travel.subtitle", {nextStop: nextStopDuration(packet, currentTime), destination, remaining})
		: i18n.t("app:adventure.travel.subtitleArrivingSoon", {destination, remaining});
}

function adventureSubtitle(context: AdventureContext): string {
	const {packet, currentTime, metrics, destination} = context;
	if (isAlterationReport(packet)) {
		return i18n.t("app:adventure.alteration.description", {time: formatDuration(alterationRemainingMilliseconds(packet, metrics, currentTime))});
	}
	if (packet.isInCity) {
		return i18n.t("app:adventure.citySubtitle", {location: destination});
	}
	return travelSubtitle(context);
}

/** The emblem shows how the player is doing: the alteration holding them back, or a smile when all is well. */
function adventureEmblem(packet: ReportTravelSummaryRes, cure: Cure | null): ReactNode {
	if (cure) return <CureEmblem cure={cure} />;
	if (!isAlterationReport(packet)) {
		const healthy = AppIcons.getIconOrNull("effects.none");
		return healthy ? <HappyEmblem emoji={healthy} /> : null;
	}
	const icon = packet.effect ? AppIcons.getIconOrNull(`effects.${packet.effect}`) : null;
	return icon ? <TwemojiIcon emoji={icon} size={Theme.dimensions.headerIcon} /> : null;
}

/** Only what is still ahead is counted: an arrived traveller has no time left, a waiting stop no countdown. */
function travelFigures(context: AdventureContext): Figure[] {
	const {packet, metrics, currentTime} = context;
	const stage = journeyStage(context);
	return [
		...stage === JOURNEY_STAGES.ARRIVED ? [] : [{caption: i18n.t("app:adventure.fields.timeRemaining"), value: formatDuration(metrics.remainingMilliseconds)}],
		...stage === JOURNEY_STAGES.TRAVELLING && hasNextStop(packet) ? [{caption: i18n.t("app:adventure.fields.nextStop"), value: nextStopDuration(packet, currentTime)}] : [],
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

/** Tokens reach the stop now; the wait the report would otherwise need is written under the button. */
function TokenAdvance({tokens, reportAction, waitFor, advance}: {
	tokens: NonNullable<ReportTravelSummaryRes["tokens"]>;
	reportAction: GameMutation<void>;
	waitFor: string;
	advance: PendingAction;
}): ReactNode {
	return <>
		{reportAction.message ? <Note>{reportAction.message}</Note> : null}
		<ActionBanner
			icon={BookOpen}
			emoji={AppIcons.getIcon("unitValues.token")}
			label={tokens.canAfford
				? i18n.t("app:adventure.quick.advanceWithCost", {count: tokens.cost})
				: i18n.t("app:adventure.quick.getTokens")}
			pending={advance.pending || reportAction.pending}
			hint={{reason: i18n.t("app:adventure.notReady", {time: waitFor}), icon: Clock3}}
			onPress={advance.onPress}
		/>
	</>;
}

/** Tokens are only worth spending while the report is not ready yet. */
function tokenOffer(packet: ReportTravelSummaryRes, reportReady: boolean): NonNullable<ReportTravelSummaryRes["tokens"]> | null {
	return reportReady || !offersTokens(packet) ? null : packet.tokens ?? null;
}

/** A greyed report says nothing the figures do not: the cure, when there is one, is the thing to do. */
function cureReplacesReport(packet: ReportTravelSummaryRes, reportReady: boolean): boolean {
	return !reportReady && packet.heal !== undefined && canCure(packet);
}

function ReportReadyPulse({ready, children}: {ready: boolean; children: ReactNode}): ReactNode {
	const reducedMotion = useReducedMotion();
	const [scale] = useState(() => new Animated.Value(1));
	const wasReady = useRef(ready);

	useEffect(() => {
		if (!wasReady.current && ready && !reducedMotion) {
			scale.setValue(REPORT_READY_PULSE.fromScale);
			Animated.spring(scale, {
				toValue: 1,
				damping: REPORT_READY_PULSE.damping,
				stiffness: REPORT_READY_PULSE.stiffness,
				mass: REPORT_READY_PULSE.mass,
				useNativeDriver: true
			}).start();
		}
		wasReady.current = ready;
	}, [ready, reducedMotion, scale]);

	return <Animated.View style={{transform: [{scale}]}}>{children}</Animated.View>;
}

/** A single way on: the free report once it is ready, otherwise tokens to reach the stop now. */
function JourneyAction({packet, reportReady, reportAction, waitFor, advance}: {
	packet: ReportTravelSummaryRes;
	reportReady: boolean;
	reportAction: GameMutation<void>;
	waitFor: string;
	advance: PendingAction;
}): ReactNode {
	const tokens = tokenOffer(packet, reportReady);
	const action = tokens
		? <TokenAdvance tokens={tokens} reportAction={reportAction} waitFor={waitFor} advance={advance} />
		: cureReplacesReport(packet, reportReady)
			? null
			: <ReportAdvance reportReady={reportReady} reportAction={reportAction} waitFor={waitFor} />;
	return action ? <ReportReadyPulse ready={reportReady}>{action}</ReportReadyPulse> : null;
}

const ADVENTURE_TOOLS = {
	MAP: {title: "app:map.title", content: WorldMap},
	UNLOCK: {title: "app:utilities.unlock", content: PrisonerRelease}
} as const;
type AdventureTool = keyof typeof ADVENTURE_TOOLS;

/** Side trips that belong to the journey screen itself, never on top of an open menu. */
function AdventureTools({onOpen}: {onOpen: (tool: AdventureTool) => void}): ReactNode {
	// Bailing other players out means nothing yet to someone still discovering the game.
	const beginner = useJourney().nextStep !== null;
	return <QuickActions>
		<QuickAction icon={AppIcons.getIcon("expedition.map")} onPress={(): void => onOpen("MAP")}>{i18n.t("app:map.title")}</QuickAction>
		{beginner ? null : <QuickAction icon={AppIcons.getIcon("notifications.types.playerFreedFromJail")} onPress={(): void => onOpen("UNLOCK")}>{i18n.t("app:utilities.unlock")}</QuickAction>}
	</QuickActions>;
}

type SheetActions = {
	advance: PendingAction;
	heal: PendingAction;
	reportReady: boolean;
	reportAction: GameMutation<void>;
};

/** In a city with an ailment there is no road to draw: only the ailment and what curing it costs. */
function showsAilmentOnly(packet: ReportTravelSummaryRes): boolean {
	return isAlterationReport(packet) && packet.isInCity;
}

function adventureCaption(context: AdventureContext): string {
	const {packet} = context;
	if (isAlterationReport(packet)) return i18n.t("app:adventure.alteration.eyebrow");
	if (packet.isInCity) return i18n.t("app:adventure.eyebrow");
	return i18n.t(journeyStage(context) === JOURNEY_STAGES.ARRIVED ? "app:adventure.travel.arrivedEyebrow" : "app:adventure.travel.eyebrow");
}

function AdventureHeader({context, dash, cure}: {context: AdventureContext; dash: TravelDash | null; cure: Cure | null}): ReactNode {
	const {packet, metrics, currentTime} = context;
	return <>
		<Standing
			emblem={adventureEmblem(packet, cure)}
			caption={adventureCaption(context)}
			title={adventureTitle(context)}
			subtitle={adventureSubtitle(context)}
		>
			{showsAilmentOnly(packet) ? null : <RoutePanel packet={packet} metrics={metrics} dash={dash} />}
		</Standing>
		{showsAilmentOnly(packet)
			? <AlterationPanel packet={packet} metrics={metrics} currentTime={currentTime} />
			: <Figures items={travelFigures(context)} />}
	</>;
}

function AdventureActions({packet, currentTime, actions}: {packet: ReportTravelSummaryRes; currentTime: number; actions: SheetActions}): ReactNode {
	return <View style={styles.actions}>
		<JourneyAction
			packet={packet}
			reportReady={actions.reportReady}
			reportAction={actions.reportAction}
			waitFor={reportWait(packet, currentTime)}
			advance={actions.advance}
		/>
		{packet.heal && canCure(packet) ? <HealAction heal={packet.heal} action={actions.heal} /> : null}
	</View>;
}

function AdventureSheet({packet, currentTime, actions, tools, dash, cure}: {
	packet: ReportTravelSummaryRes;
	currentTime: number;
	actions: SheetActions;
	tools: ReactNode;
	dash: TravelDash | null;
	cure: Cure | null;
}): ReactNode {
	const metrics = getTravelMetrics(packet, currentTime);
	const context: AdventureContext = {packet, currentTime, metrics, destination: mapName(packet.endMap)};
	const advice = travelAdvice(packet.nextStopTime);

	return (
		<Screen>
			<AdventureHeader context={context} dash={dash} cure={cure} />
			<AdventureActions packet={packet} currentTime={currentTime} actions={actions} />
			<JourneyGuide />
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
	const advance = useReportShortcut({request: requestTokenAdvance, confirm: tokenAdvanceConfirmation, outcome: reportEventStore.getTokenSnapshot});
	const heal = useReportShortcut({request: requestBuyHeal, confirm: healConfirmation, outcome: reportEventStore.getHealSnapshot});
	const [dash, setDash] = useState<TravelDash | null>(null);
	const [cure, setCure] = useState<Cure | null>(null);
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
		const nextStop = travel && !showsAilmentOnly(travel) ? getTravelMetrics(travel, travel.nextStopTime).progress : null;
		advance.run((outcome, done) => {
			if (outcome.kind !== "used") {
				done();
				return;
			}
			// Discord then asks for a report; here the runner dashes to the stop, which then opens.
			celebrate();
			const openStop = (): void => {
				reportAction.submit().catch(console.error).finally(() => {
					setDash(null);
					done();
				});
			};
			if (nextStop === null) openStop();
			else setDash({to: nextStop, onDone: openStop});
		});
	};

	const buyHeal = (): void => {
		const ailment = travel?.effect ? AppIcons.getIconOrNull(`effects.${travel.effect}`) : null;
		heal.run((outcome, done) => {
			if (outcome.kind !== "accepted" || !ailment) {
				done();
				return;
			}
			celebrate();
			setCure({from: ailment, onDone: once(() => {
				setCure(null);
				done();
			})});
		});
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
		healOutcome: cure ? null : healOutcome,
		shopResult,
		reactToCollector,
		isAnswerPending,
		continueAfterTokenOutcome,
		continueAfterHealOutcome
  });
  if (collectorOutcome) {
		return <Entrance key={bigEventCollector?.id ?? adventureCollector?.id ?? "outcome"}>{collectorOutcome}</Entrance>;
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
			<AdventureWelcome />
			{pendingReportConfirmation}
		</>;
	}

	return (
		<>
			<AdventureSheet
				packet={travel}
				currentTime={currentTime}
				actions={{
					advance: {pending: advance.pending, onPress: advanceWithTokens},
					heal: {pending: heal.pending, onPress: buyHeal},
					reportReady: reportState.data.reportReady,
					reportAction
				}}
				tools={tools}
				dash={dash}
				cure={cure}
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
