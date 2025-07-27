import {useFocusEffect, useNavigation} from "expo-router";
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {ProfileReq} from "@/src/@types/protobufs-client";
import {ProfileNotFound, ProfileRes} from "@/src/@types/protobufs-server";
import {useCallback, useEffect, useState} from "react";
import {AppConstants} from "@/src/AppConstants";
import {useProfile} from "@/src/contexts/ProfileContext";

type LoadingState = 'loading' | 'success' | 'error' | 'timeout';

interface PlayerStats {
	level: number;
	health: { value: number; max: number };
	experience: { value: number; max: number };
	money: number;
	gems: number;
	score: number;
	rank: {
		unranked: boolean;
		rank: number;
		numberOfPlayers: number;
	};
	stats?: {
		energy: { value: number; max: number };
		attack: number;
		defense: number;
		speed: number;
		breath: { base: number; max: number; regen: number };
	};
}

interface TooltipState {
	visible: boolean;
	text: string;
	x: number;
	y: number;
}

export default function Profile() {
	const { profileData, setProfileData } = useProfile();
	const [profileState, setProfileState] = useState<LoadingState>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
	const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
	const [tooltipTimeout, setTooltipTimeout] = useState<number | null>(null);
	const navigation = useNavigation();

	const loadProfile = () => {
		setProfileState('loading');
		setErrorMessage('');

		WebSocketClient.getInstance().sendPacket(ProfileReq.create({ askedPlayer: {} }), {
			[ProfileRes.name]: (packet: ProfileRes) => {
				setProfileData({
					pseudo: packet.pseudo,
					classId: packet.classId,
					level: packet.level
				});
				setPlayerStats({
					level: packet.level,
					health: packet.health,
					experience: packet.experience,
					money: packet.money,
					gems: packet.missions.gems,
					score: packet.rank.score,
					rank: {
						unranked: packet.rank.unranked,
						rank: packet.rank.rank,
						numberOfPlayers: packet.rank.numberOfPlayers
					},
					stats: packet.stats ? {
						energy: packet.stats.energy,
						attack: packet.stats.attack,
						defense: packet.stats.defense,
						speed: packet.stats.speed,
						breath: packet.stats.breath
					} : undefined
				});
				setProfileState('success');
				// Update navigation title with pseudo and level
				navigation.setOptions({
					title: `${packet.pseudo} · Level ${packet.level}`
				});
			},
			[ProfileNotFound.name]: (packet: ProfileNotFound) => {
				setErrorMessage('Profile not found');
				setProfileState('error');
			}
		}, {
			time: AppConstants.PACKET_TIMEOUT,
			callback: () => {
				setErrorMessage('Request timed out. Please try again.');
				setProfileState('timeout');
			}
		});
	}

	// todo: verify that it does not run twice in production mode
	useFocusEffect(useCallback(() => {
		loadProfile();
		}, [])
	);

	useEffect(() => {
		if (profileState === 'success' && profileData.pseudo && playerStats) {
			navigation.setOptions({
				title: `${profileData.pseudo}`
			});
		}
	}, [profileState, profileData.pseudo, playerStats, navigation]);

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
			? 'Money'
			: 'Gems. Can be acquired by finishing missions.';

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
			? 'Score. Represents your overall performance.'
			: 'Rank. Your position among all players.';

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
				onLayout={(event) => {
					const { x, y, width, height } = event.nativeEvent.layout;
					// Store layout info for this stat item
					event.currentTarget._layoutInfo = { x, y, width, height };
				}}
				onPress={(event) => {
					const layoutInfo = event.currentTarget._layoutInfo;
					if (layoutInfo) {
						// Convert relative coordinates to absolute screen coordinates
						event.currentTarget.measure((fx, fy, width, height, px, py) => {
							showStatTooltip(statName, px, py, width);
						});
					}
				}}
			>
				<Text style={styles.statEmoji}>{emoji}</Text>
				<Text style={styles.statValue}>{value}</Text>
			</TouchableOpacity>
		);
	};

	const renderStatsContainer = () => {
		if (!playerStats?.stats) return null;

		const { stats } = playerStats;

		return (
			<View style={styles.statsContainer}>
				<Text style={styles.statsTitle}>Statistics</Text>
				<View style={styles.statsGrid}>
					{renderStatItem("⚡", `${stats.energy.value} / ${stats.energy.max}`, "Energy")}
					{renderStatItem("🌬️", `${stats.breath.base} / ${stats.breath.max}`, "Breath")}
					{renderStatItem("🫁", `${stats.breath.regen}`, "Breath Regen")}
					{renderStatItem("⚔️", `${stats.attack}`, "Attack")}
					{renderStatItem("🛡️", `${stats.defense}`, "Defense")}
					{renderStatItem("🚀", `${stats.speed}`, "Speed")}
				</View>
			</View>
		);
	};

	const renderProfileSection = () => {
		switch (profileState) {
			case 'loading':
				return (
					<View style={styles.centerContent}>
						<ActivityIndicator size="large" color="#007AFF" />
						<Text style={styles.loadingText}>Loading profile...</Text>
					</View>
				);
			case 'error':
			case 'timeout':
				return (
					<View style={styles.centerContent}>
						<Text style={styles.errorText}>{errorMessage}</Text>
					</View>
				);
			case 'success':
				return (
					<View style={styles.profileContent}>
						{playerStats && (
							<>
								{/* Health and Experience Bars Row */}
								<View style={styles.barsContainer}>
									<View style={styles.barItem}>
										{renderProgressBar(
											playerStats.health.value,
											playerStats.health.max,
											'#ff4444',
											'Health'
										)}
									</View>
									<View style={styles.barItem}>
										<View style={styles.experienceBarContainer}>
											<Text style={styles.progressLabel}>Experience</Text>
											<View style={styles.progressBarWrapper}>
												<View style={styles.progressBarBackground}>
													<View
														style={[
															styles.progressBarFill,
															{ width: `${Math.min((playerStats.experience.value / playerStats.experience.max) * 100, 100)}%`, backgroundColor: '#FFDF00' }
														]}
													/>
												</View>
												<Text style={styles.progressText}>
													{playerStats.experience.value} / {playerStats.experience.max}
												</Text>
											</View>
										</View>
									</View>
								</View>

								{/* Currency Section */}
								<View style={styles.currencyContainer}>
									<Text style={styles.currencyTitle}>Currencies</Text>
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
											<Text style={styles.currencyValue}>{playerStats.money}</Text>
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
											<Text style={styles.currencyValue}>{playerStats.gems}</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Score and Rank Section */}
								<View style={styles.scoreRankContainer}>
									<Text style={styles.scoreRankTitle}>Score and rank</Text>
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
											<Text style={styles.scoreRankValue}>{playerStats.score}</Text>
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
												{playerStats.rank.unranked ? 'Unranked' : `${playerStats.rank.rank} / ${playerStats.rank.numberOfPlayers}`}
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
					<View style={styles.centerContent}>
						<Text style={styles.placeholderText}>Inventory will be implemented here</Text>
					</View>
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	scrollContainer: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	section: {
		flex: 1,
		minHeight: 200,
		padding: 20,
	},
	centerContent: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	separator: {
		height: 1,
		backgroundColor: '#e0e0e0',
		marginHorizontal: 20,
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: '#666',
	},
	errorText: {
		fontSize: 16,
		color: '#ff4444',
		textAlign: 'center',
		paddingHorizontal: 20,
	},
	placeholderText: {
		fontSize: 16,
		color: '#999',
		textAlign: 'center',
		fontStyle: 'italic',
	},
	profileContent: {
		flex: 1,
		padding: 10,
		justifyContent: 'flex-start',
	},
	levelContainer: {
		alignItems: 'center',
		marginBottom: 20,
	},
	levelText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#666',
	},
	progressBarContainer: {
		width: '100%',
	},
	progressLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 8,
	},
	progressBarWrapper: {
		position: 'relative',
	},
	progressBarBackground: {
		height: 20,
		backgroundColor: '#e0e0e0',
		borderRadius: 10,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		borderRadius: 10,
	},
	progressText: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		textAlign: 'center',
		lineHeight: 20,
		fontSize: 12,
		fontWeight: '600',
		color: '#333',
		textShadowColor: 'rgba(255, 255, 255, 0.8)',
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 1,
	},
	experienceBarContainer: {
		// Removed marginTop to align with health bar
	},
	statsContainer: {
		marginTop: 20,
	},
	statsTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	statItem: {
		width: '31%',
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginBottom: 10,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	statEmoji: {
		fontSize: 24,
		textAlign: 'center',
	},
	statValue: {
		fontSize: 14,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
		textAlign: 'center',
	},
	tooltip: {
		position: 'absolute',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		zIndex: 1000,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
		transform: [{ translateX: -50 }], // Center the tooltip horizontally
	},
	tooltipText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	currencyContainer: {
		marginTop: 20,
	},
	currencyTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	currencyGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	currencyItem: {
		flex: 1,
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	currencyEmoji: {
		fontSize: 24,
	},
	currencyValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
	},
	moneyContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 10,
	},
	moneyText: {
		fontSize: 18,
		fontWeight: '700',
		color: '#333',
	},
	scoreRankContainer: {
		marginTop: 20,
	},
	scoreRankTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#333',
		marginBottom: 10,
	},
	scoreRankGrid: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	scoreRankItem: {
		flex: 1,
		backgroundColor: '#f9f9f9',
		borderRadius: 10,
		padding: 12,
		marginHorizontal: 5,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	scoreRankEmoji: {
		fontSize: 24,
	},
	scoreRankValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#333',
		marginTop: 5,
		textAlign: 'center',
	},
	barsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%',
	},
	barItem: {
		flex: 1,
		marginHorizontal: 5,
	},
});
