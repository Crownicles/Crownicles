import {useNavigation} from "expo-router";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
	type StyleProp,
	type TextStyle,
	type ViewStyle
} from "react-native";
import {ReactElement, useEffect, useState} from "react";
import {GameClient} from "@/src/networking/GameClient";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ProfileReq} from "ws-packets/src/fromClient/ProfileReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {InventoryReq} from "ws-packets/src/fromClient/InventoryReq";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {i18n} from "@/src/translations/i18n";
import {styles} from "./profile.styles";

interface TooltipState {
	visible: boolean;
	text: string;
	x: number;
	y: number;
}

type StatTooltipHandler = (statName: string, x: number, y: number, width: number) => void;
type CurrencyTooltipHandler = (currencyType: "money" | "gems", x: number, y: number, width: number) => void;
type ScoreRankTooltipHandler = (type: "score" | "rank", x: number, y: number) => void;

interface ProfileProps {
	profile: ProfileRes;
}

interface ProgressBarProps {
	current: number;
	max: number;
	color: string;
	label: string;
}

interface CardMeasurement {
	width: number;
	pageX: number;
	pageY: number;
}

interface TooltipCardProps {
	emoji: string;
	value: number | string;
	cardStyle: StyleProp<ViewStyle>;
	emojiStyle: StyleProp<TextStyle>;
	valueStyle: StyleProp<TextStyle>;
	onMeasure: (measurement: CardMeasurement) => void;
}

interface StatCardProps {
	emoji: string;
	value: string;
	label: string;
	onShow: StatTooltipHandler;
}

interface CurrencyCardProps {
	type: "money" | "gems";
	emoji: string;
	value: number;
	onShow: CurrencyTooltipHandler;
}

interface CurrencySectionProps extends ProfileProps {
	onShow: CurrencyTooltipHandler;
}

interface ScoreRankCardProps {
	type: "score" | "rank";
	emoji: string;
	value: number | string;
	onShow: ScoreRankTooltipHandler;
}

interface ScoreRankSectionProps extends ProfileProps {
	onShow: ScoreRankTooltipHandler;
}

interface StatsSectionProps extends ProfileProps {
	onShow: StatTooltipHandler;
}

interface ProfileDetailsProps extends ProfileProps {
	onShowStatTooltip: StatTooltipHandler;
	onShowCurrencyTooltip: CurrencyTooltipHandler;
	onShowScoreRankTooltip: ScoreRankTooltipHandler;
}

interface ProfileStateViewProps {
	profileState: RequestState<ProfileRes>;
	onShowStatTooltip: StatTooltipHandler;
	onShowCurrencyTooltip: CurrencyTooltipHandler;
	onShowScoreRankTooltip: ScoreRankTooltipHandler;
}

function ProgressBar({ current, max, color, label }: ProgressBarProps): ReactElement {
	const percentage = Math.min((current / max) * 100, 100);

	return (
		<View style={styles.progressBarContainer}>
			<Text style={styles.progressLabel}>{label}</Text>
			<View style={styles.progressBarWrapper}>
				<View style={styles.progressBarBackground}>
					<View
						style={[
							styles.progressBarFill,
							{ width: `${percentage}%`, backgroundColor: color }
						]}
					/>
				</View>
				<Text style={styles.progressText}>
					{current} / {max}
				</Text>
			</View>
		</View>
	);
}

function HealthExperienceSection({ profile }: ProfileProps): ReactElement {
	return (
		<View style={styles.barsContainer}>
			<View style={styles.barItem}>
				<ProgressBar
					current={profile.health.value}
					max={profile.health.max}
					color="#ff4444"
					label={i18n.t("app:profile.titles.health")}
				/>
			</View>
			<View style={styles.barItem}>
				<ProgressBar
					current={profile.experience.value}
					max={profile.experience.max}
					color="#FFDF00"
					label={i18n.t("app:profile.titles.experience")}
				/>
			</View>
		</View>
	);
}

function TooltipCard({ emoji, value, cardStyle, emojiStyle, valueStyle, onMeasure }: TooltipCardProps): ReactElement {
	return (
		<TouchableOpacity
			style={cardStyle}
			onPress={(event): void => {
				event.currentTarget.measure((_frameX, _frameY, width, _height, pageX, pageY): void => {
					onMeasure({width, pageX, pageY});
				});
			}}
		>
			<Text style={emojiStyle}>{emoji}</Text>
			<Text style={valueStyle}>{value}</Text>
		</TouchableOpacity>
	);
}

function StatCard({ emoji, value, label, onShow }: StatCardProps): ReactElement {
	return (
		<TooltipCard
			cardStyle={styles.statItem}
			emojiStyle={styles.statEmoji}
			valueStyle={styles.statValue}
			emoji={emoji}
			value={value}
			onMeasure={({pageX, pageY, width}): void => onShow(label, pageX, pageY, width)}
		/>
	);
}

function StatsSection({ profile, onShow }: StatsSectionProps): ReactElement | null {
	if (!profile.stats) {
		return null;
	}

	const { stats } = profile;
	const statItems = [
		{ key: "energy", emoji: "⚡", value: `${stats.energy.value} / ${stats.energy.max}`, label: i18n.t("app:profile.tooltips.energy") },
		{ key: "breath", emoji: "🌬️", value: `${stats.breath.base} / ${stats.breath.max}`, label: i18n.t("app:profile.tooltips.breath") },
		{ key: "breathRegen", emoji: "🫁", value: `${stats.breath.regen}`, label: i18n.t("app:profile.tooltips.breathRegen") },
		{ key: "attack", emoji: "⚔️", value: `${stats.attack}`, label: i18n.t("app:profile.tooltips.attack") },
		{ key: "defense", emoji: "🛡️", value: `${stats.defense}`, label: i18n.t("app:profile.tooltips.defense") },
		{ key: "speed", emoji: "🚀", value: `${stats.speed}`, label: i18n.t("app:profile.tooltips.speed") }
	];

	return (
		<View style={styles.statsContainer}>
			<Text style={styles.statsTitle}>{i18n.t("app:profile.titles.statistics")}</Text>
			<View style={styles.statsGrid}>
				{statItems.map(({ key, emoji, value, label }) => (
					<StatCard key={key} emoji={emoji} value={value} label={label} onShow={onShow} />
				))}
			</View>
		</View>
	);
}

function CurrencyCard({ type, emoji, value, onShow }: CurrencyCardProps): ReactElement {
	return (
		<TooltipCard
			cardStyle={styles.currencyItem}
			emojiStyle={styles.currencyEmoji}
			valueStyle={styles.currencyValue}
			emoji={emoji}
			value={value}
			onMeasure={({pageX, pageY, width}): void => onShow(type, pageX, pageY, width)}
		/>
	);
}

function CurrencySection({ profile, onShow }: CurrencySectionProps): ReactElement {
	return (
		<View style={styles.currencyContainer}>
			<Text style={styles.currencyTitle}>{i18n.t("app:profile.titles.currencies")}</Text>
			<View style={styles.currencyGrid}>
				<CurrencyCard type="money" emoji="💰" value={profile.money} onShow={onShow} />
				<CurrencyCard type="gems" emoji="💎" value={profile.missions.gems} onShow={onShow} />
			</View>
		</View>
	);
}

function ScoreRankCard({ type, emoji, value, onShow }: ScoreRankCardProps): ReactElement {
	return (
		<TooltipCard
			cardStyle={styles.scoreRankItem}
			emojiStyle={styles.scoreRankEmoji}
			valueStyle={styles.scoreRankValue}
			emoji={emoji}
			value={value}
			onMeasure={({pageX, pageY, width}): void => onShow(type, pageX + width / 2, pageY)}
		/>
	);
}

function ScoreRankSection({ profile, onShow }: ScoreRankSectionProps): ReactElement {
	const rank = profile.rank.unranked ? "Unranked" : `${profile.rank.rank} / ${profile.rank.numberOfPlayers}`;

	return (
		<View style={styles.scoreRankContainer}>
			<Text style={styles.scoreRankTitle}>{i18n.t("app:profile.titles.scoreAndRank")}</Text>
			<View style={styles.scoreRankGrid}>
				<ScoreRankCard type="score" emoji="🏅" value={profile.rank.score} onShow={onShow} />
				<ScoreRankCard type="rank" emoji="🏆" value={rank} onShow={onShow} />
			</View>
		</View>
	);
}

function ProfileDetails({
	profile,
	onShowStatTooltip,
	onShowCurrencyTooltip,
	onShowScoreRankTooltip
}: ProfileDetailsProps): ReactElement {
	return (
		<View style={styles.profileContent}>
			<HealthExperienceSection profile={profile} />
			<CurrencySection profile={profile} onShow={onShowCurrencyTooltip} />
			<ScoreRankSection profile={profile} onShow={onShowScoreRankTooltip} />
			<StatsSection profile={profile} onShow={onShowStatTooltip} />
		</View>
	);
}

function ProfileStateView({
	profileState,
	onShowStatTooltip,
	onShowCurrencyTooltip,
	onShowScoreRankTooltip
}: ProfileStateViewProps): ReactElement | null {
	if (profileState.status === "loading") {
		return (
			<View style={styles.centerContent}>
				<ActivityIndicator size="large" color="#007AFF" />
				<Text style={styles.loadingText}>Loading profile...</Text>
			</View>
		);
	}

	if (profileState.status === "empty" || profileState.status === "failed") {
		return (
			<View style={styles.centerContent}>
				<Text style={styles.errorText}>
					{profileState.status === "empty" ? "Profile not found" : "Request timed out. Please try again."}
				</Text>
			</View>
		);
	}

	return (
		<ProfileDetails
			profile={profileState.data}
			onShowStatTooltip={onShowStatTooltip}
			onShowCurrencyTooltip={onShowCurrencyTooltip}
			onShowScoreRankTooltip={onShowScoreRankTooltip}
		/>
	);
}

export default function Profile(): ReactElement {
	const profileState = useGameQuery<ProfileRes>(
		GAME_ENTITIES.PROFILE,
		() => GameClient.request(makeFromClientPacket(ProfileReq, { askedPlayer: {} }), ProfileRes, [PlayerNotFound])
	);
	const inventoryState = useGameQuery<InventoryRes>(
		GAME_ENTITIES.INVENTORY,
		() => GameClient.request(makeFromClientPacket(InventoryReq, { askedPlayer: {} }), InventoryRes, [PlayerNotFound])
	);
	const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
	const [tooltipTimeout, setTooltipTimeout] = useState<number | null>(null);
	const navigation = useNavigation();

	const profile = profileState.status === "ready" ? profileState.data : null;

	// The server leaves the payload out when it has no inventory to show, so its absence is the empty case
	const inventoryData: InventoryData | null = inventoryState.status === "ready" ? inventoryState.data.data ?? null : null;

	useEffect(() => {
		if (profile) {
			navigation.setOptions({ title: profile.pseudo });
		}
	}, [profile, navigation]);

	const showTooltip = (text: string, x: number, y: number, duration: number): void => {
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		setTooltip({
			visible: true,
			text,
			x,
			y
		});

		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({...prev, visible: false}));
			setTooltipTimeout(null);
		}, duration);

		setTooltipTimeout(newTimeout);
	};

	const showStatTooltip = (statName: string, x: number, y: number, width: number): void => {
		const centerX = x + 50 + width / 2;
		showTooltip(statName, centerX, y - 150, 2000);
	};

	const showCurrencyTooltip = (currencyType: "money" | "gems", x: number, y: number, width: number): void => {
		const tooltipText = currencyType === "money"
			? i18n.t("app:profile.tooltips.money")
			: i18n.t("app:profile.tooltips.gems");
		const tooltipX = currencyType === "money" ? x + width / 2 + 60 : x + width / 2 - 50;
		showTooltip(tooltipText, tooltipX, y - 150, 3000);
	};

	const showScoreRankTooltip = (type: "score" | "rank", x: number, y: number): void => {
		const tooltipText = type === "score"
			? i18n.t("app:profile.tooltips.score")
			: i18n.t("app:profile.tooltips.rank");
		showTooltip(tooltipText, x, y - 50, 3000);
	};

	const hideTooltip = (): void => {
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
			setTooltipTimeout(null);
		}
		setTooltip(prev => ({ ...prev, visible: false }));
	};

	return (
		<View style={styles.container}>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				onTouchStart={hideTooltip}
			>
				{/* Profile Section */}
				<View style={styles.section}>
					<ProfileStateView
						profileState={profileState}
						onShowStatTooltip={showStatTooltip}
						onShowCurrencyTooltip={showCurrencyTooltip}
						onShowScoreRankTooltip={showScoreRankTooltip}
					/>
				</View>

				{/* Separator Line */}
				<View style={styles.separator} />

				{/* Inventory Section */}
				<View style={styles.section}>
					<Inventory inventoryData={inventoryData} />
				</View>
			</ScrollView>

			{/* Tooltip Overlay */}
			{tooltip.visible && (
				<TouchableOpacity
					style={[
						styles.tooltip,
						{
							left: tooltip.x - 50,
							top: tooltip.y
						}
					]}
					onPress={hideTooltip}
					activeOpacity={1}
				>
					<Text style={styles.tooltipText}>{tooltip.text}</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}
