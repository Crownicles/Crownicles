import {useNavigation} from "expo-router";
import {ActivityIndicator, ScrollView, Text, TouchableOpacity, View} from "react-native";
import {useEffect, useState} from "react";
import {GameClient} from "@/src/networking/GameClient";
import {useGameQuery} from "@/src/store/useGameQuery";
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

export default function Profile() {
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

	const renderProgressBar = (current: number, max: number, color: string, label: string) => {
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
	};

	const showStatTooltip = (statName: string, x: number, y: number, width: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		// Calculate center position above the stat item
		const centerX = x + 50 + width / 2;
		const tooltipY = y - 150; // Show above the stat item

		setTooltip({
			visible: true,
			text: statName,
			x: centerX,
			y: tooltipY
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 2000);

		setTooltipTimeout(newTimeout);
	};

	const showCurrencyTooltip = (currencyType: 'money' | 'gems', x: number, y: number, width: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		const tooltipText = currencyType === 'money'
			? i18n.t("app:profile.tooltips.money")
			: i18n.t("app:profile.tooltips.gems");

		setTooltip({
			visible: true,
			text: tooltipText,
			x: currencyType === 'money' ? x + width / 2 + 60 : x + width / 2 - 50,
			y: y - 150
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 3000);

		setTooltipTimeout(newTimeout);
	};

	const showScoreRankTooltip = (type: 'score' | 'rank', x: number, y: number) => {
		// Clear any existing timeout
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
		}

		const tooltipText = type === 'score'
			? i18n.t("app:profile.tooltips.score")
			: i18n.t("app:profile.tooltips.rank");

		setTooltip({
			visible: true,
			text: tooltipText,
			x: x,
			y: y - 50
		});

		// Set new timeout and store its reference
		const newTimeout = setTimeout(() => {
			setTooltip(prev => ({ ...prev, visible: false }));
			setTooltipTimeout(null);
		}, 3000);

		setTooltipTimeout(newTimeout);
	};

	const renderStatItem = (emoji: string, value: string, statName: string) => {
		return (
			<TouchableOpacity
				style={styles.statItem}
				onPress={(event) => {
					// Convert relative coordinates to absolute screen coordinates
					event.currentTarget.measure((fx, fy, width, height, px, py) => {
						showStatTooltip(statName, px, py, width);
					});
				}}
			>
				<Text style={styles.statEmoji}>{emoji}</Text>
				<Text style={styles.statValue}>{value}</Text>
			</TouchableOpacity>
		);
	};

	const renderStatsContainer = () => {
		if (!profile?.stats) return null;

		const { stats } = profile;

		return (
			<View style={styles.statsContainer}>
				<Text style={styles.statsTitle}>{i18n.t("app:profile.titles.statistics")}</Text>
				<View style={styles.statsGrid}>
					{renderStatItem("⚡", `${stats.energy.value} / ${stats.energy.max}`, i18n.t("app:profile.tooltips.energy"))}
					{renderStatItem("🌬️", `${stats.breath.base} / ${stats.breath.max}`, i18n.t("app:profile.tooltips.breath"))}
					{renderStatItem("🫁", `${stats.breath.regen}`, i18n.t("app:profile.tooltips.breathRegen"))}
					{renderStatItem("⚔️", `${stats.attack}`, i18n.t("app:profile.tooltips.attack"))}
					{renderStatItem("🛡️", `${stats.defense}`, i18n.t("app:profile.tooltips.defense"))}
					{renderStatItem("🚀", `${stats.speed}`, i18n.t("app:profile.tooltips.speed"))}
				</View>
			</View>
		);
	};

	const renderProfileSection = () => {
		switch (profileState.status) {
			case 'loading':
				return (
					<View style={styles.centerContent}>
						<ActivityIndicator size="large" color="#007AFF" />
						<Text style={styles.loadingText}>Loading profile...</Text>
					</View>
				);
			case 'empty':
			case 'failed':
				return (
					<View style={styles.centerContent}>
						<Text style={styles.errorText}>
							{profileState.status === 'empty' ? 'Profile not found' : 'Request timed out. Please try again.'}
						</Text>
					</View>
				);
			case 'ready':
				return (
					<View style={styles.profileContent}>
						{profile && (
							<>
								{/* Health and Experience Bars Row */}
								<View style={styles.barsContainer}>
									<View style={styles.barItem}>
										{renderProgressBar(
											profile.health.value,
											profile.health.max,
											'#ff4444',
											i18n.t("app:profile.titles.health")
										)}
									</View>
									<View style={styles.barItem}>
										<View style={styles.experienceBarContainer}>
											<Text style={styles.progressLabel}>{i18n.t("app:profile.titles.experience")}</Text>
											<View style={styles.progressBarWrapper}>
												<View style={styles.progressBarBackground}>
													<View
														style={[
															styles.progressBarFill,
															{ width: `${Math.min((profile.experience.value / profile.experience.max) * 100, 100)}%`, backgroundColor: '#FFDF00' }
														]}
													/>
												</View>
												<Text style={styles.progressText}>
													{profile.experience.value} / {profile.experience.max}
												</Text>
											</View>
										</View>
									</View>
								</View>

								{/* Currency Section */}
								<View style={styles.currencyContainer}>
									<Text style={styles.currencyTitle}>{i18n.t("app:profile.titles.currencies")}</Text>
									<View style={styles.currencyGrid}>
										<TouchableOpacity
												style={styles.currencyItem}
												onPress={(event) => {
													event.currentTarget.measure((fx, fy, width, height, px, py) => {
														showCurrencyTooltip('money', px, py, width);
													});
												}}
										>
											<Text style={styles.currencyEmoji}>💰</Text>
											<Text style={styles.currencyValue}>{profile.money}</Text>
										</TouchableOpacity>

										<TouchableOpacity
												style={styles.currencyItem}
												onPress={(event) => {
													event.currentTarget.measure((fx, fy, width, height, px, py) => {
														showCurrencyTooltip('gems', px, py, width);
													});
												}}
										>
											<Text style={styles.currencyEmoji}>💎</Text>
											<Text style={styles.currencyValue}>{profile.missions.gems}</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Score and Rank Section */}
								<View style={styles.scoreRankContainer}>
									<Text style={styles.scoreRankTitle}>{i18n.t("app:profile.titles.scoreAndRank")}</Text>
									<View style={styles.scoreRankGrid}>
										<TouchableOpacity
											style={styles.scoreRankItem}
											onPress={(event) => {
												event.currentTarget.measure((fx, fy, width, height, px, py) => {
													showScoreRankTooltip('score', px + width / 2, py);
												});
											}}
										>
											<Text style={styles.scoreRankEmoji}>🏅</Text>
											<Text style={styles.scoreRankValue}>{profile.rank.score}</Text>
										</TouchableOpacity>

										<TouchableOpacity
											style={styles.scoreRankItem}
											onPress={(event) => {
												event.currentTarget.measure((fx, fy, width, height, px, py) => {
													showScoreRankTooltip('rank', px + width / 2, py);
												});
											}}
										>
											<Text style={styles.scoreRankEmoji}>🏆</Text>
											<Text style={styles.scoreRankValue}>
												{profile.rank.unranked ? 'Unranked' : `${profile.rank.rank} / ${profile.rank.numberOfPlayers}`}
											</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Statistics Container */}
								{renderStatsContainer()}
							</>
						)}
					</View>
				);
			default:
				return null;
		}
	};

	const hideTooltip = () => {
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
					{renderProfileSection()}
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
