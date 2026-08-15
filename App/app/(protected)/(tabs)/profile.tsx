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

type ProfileCardVariant = "stats" | "currency" | "scoreRank";

interface ProfileCardData<Type extends string> {
	key: string;
	type: Type;
	emoji: string;
	value: number | string;
}

interface ProfileCardSectionStyles {
	container: StyleProp<ViewStyle>;
	title: StyleProp<TextStyle>;
	grid: StyleProp<ViewStyle>;
	card: StyleProp<ViewStyle>;
	emoji: StyleProp<TextStyle>;
	value: StyleProp<TextStyle>;
}

interface ProfileCardProps {
	emoji: string;
	value: number | string;
	sectionStyles: ProfileCardSectionStyles;
	onMeasure: (measurement: CardMeasurement) => void;
}

interface ProfileCardSectionProps<Type extends string> {
	variant: ProfileCardVariant;
	title: string;
	items: readonly ProfileCardData<Type>[];
	onShow: (type: Type, measurement: CardMeasurement) => void;
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

const profileCardSectionStyles: Record<ProfileCardVariant, ProfileCardSectionStyles> = {
	stats: {
		container: styles.statsContainer,
		title: styles.statsTitle,
		grid: styles.statsGrid,
		card: styles.statItem,
		emoji: styles.statEmoji,
		value: styles.statValue
	},
	currency: {
		container: styles.currencyContainer,
		title: styles.currencyTitle,
		grid: styles.currencyGrid,
		card: styles.currencyItem,
		emoji: styles.currencyEmoji,
		value: styles.currencyValue
	},
	scoreRank: {
		container: styles.scoreRankContainer,
		title: styles.scoreRankTitle,
		grid: styles.scoreRankGrid,
		card: styles.scoreRankItem,
		emoji: styles.scoreRankEmoji,
		value: styles.scoreRankValue
	}
};

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

function ProfileCard({ emoji, value, sectionStyles, onMeasure }: ProfileCardProps): ReactElement {
	return (
		<TooltipCard
			cardStyle={sectionStyles.card}
			emojiStyle={sectionStyles.emoji}
			valueStyle={sectionStyles.value}
			emoji={emoji}
			value={value}
			onMeasure={onMeasure}
		/>
	);
}

function ProfileCardSection<Type extends string>({ variant, title, items, onShow }: ProfileCardSectionProps<Type>): ReactElement {
	const sectionStyles = profileCardSectionStyles[variant];

	return (
		<View style={sectionStyles.container}>
			<Text style={sectionStyles.title}>{title}</Text>
			<View style={sectionStyles.grid}>
				{items.map((item) => (
					<ProfileCard
						key={item.key}
						emoji={item.emoji}
						value={item.value}
						sectionStyles={sectionStyles}
						onMeasure={(measurement): void => onShow(item.type, measurement)}
					/>
				))}
			</View>
		</View>
	);
}

function StatsSection({ profile, onShow }: StatsSectionProps): ReactElement | null {
	if (!profile.stats) {
		return null;
	}

	const { stats } = profile;
	const statItems: ProfileCardData<string>[] = [
		{ key: "energy", type: i18n.t("app:profile.tooltips.energy"), emoji: "⚡", value: `${stats.energy.value} / ${stats.energy.max}` },
		{ key: "breath", type: i18n.t("app:profile.tooltips.breath"), emoji: "🌬️", value: `${stats.breath.base} / ${stats.breath.max}` },
		{ key: "breathRegen", type: i18n.t("app:profile.tooltips.breathRegen"), emoji: "🫁", value: `${stats.breath.regen}` },
		{ key: "attack", type: i18n.t("app:profile.tooltips.attack"), emoji: "⚔️", value: `${stats.attack}` },
		{ key: "defense", type: i18n.t("app:profile.tooltips.defense"), emoji: "🛡️", value: `${stats.defense}` },
		{ key: "speed", type: i18n.t("app:profile.tooltips.speed"), emoji: "🚀", value: `${stats.speed}` }
	];

	return (
		<ProfileCardSection
			variant="stats"
			title={i18n.t("app:profile.titles.statistics")}
			items={statItems}
			onShow={(type, {pageX, pageY, width}): void => onShow(type, pageX, pageY, width)}
		/>
	);
}

function CurrencySection({ profile, onShow }: ProfileProps & { onShow: CurrencyTooltipHandler }): ReactElement {
	const currencyItems: ProfileCardData<"money" | "gems">[] = [
		{ key: "money", type: "money", emoji: "💰", value: profile.money },
		{ key: "gems", type: "gems", emoji: "💎", value: profile.missions.gems }
	];

	return (
		<ProfileCardSection
			variant="currency"
			title={i18n.t("app:profile.titles.currencies")}
			items={currencyItems}
			onShow={(type, {pageX, pageY, width}): void => onShow(type, pageX, pageY, width)}
		/>
	);
}

function ScoreRankSection({ profile, onShow }: ProfileProps & { onShow: ScoreRankTooltipHandler }): ReactElement {
	const rank = profile.rank.unranked ? "Unranked" : `${profile.rank.rank} / ${profile.rank.numberOfPlayers}`;
	const scoreRankItems: ProfileCardData<"score" | "rank">[] = [
		{ key: "score", type: "score", emoji: "🏅", value: profile.rank.score },
		{ key: "rank", type: "rank", emoji: "🏆", value: rank }
	];

	return (
		<ProfileCardSection
			variant="scoreRank"
			title={i18n.t("app:profile.titles.scoreAndRank")}
			items={scoreRankItems}
			onShow={(type, {pageX, pageY, width}): void => onShow(type, pageX + width / 2, pageY)}
		/>
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
