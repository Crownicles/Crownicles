import {useFocusEffect, useNavigation} from "expo-router";
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from "react-native";
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
}

export default function Profile() {
	const { profileData, setProfileData } = useProfile();
	const [profileState, setProfileState] = useState<LoadingState>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
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
					experience: packet.experience
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
								{/* Health Bar */}
								{renderProgressBar(
									playerStats.health.value,
									playerStats.health.max,
									'#ff4444',
									'Health'
								)}

								{/* Experience Bar with Level */}
								<View style={styles.experienceContainer}>
									<View style={styles.experienceLabelContainer}>
										<Text style={styles.progressLabel}>Experience</Text>
										<Text style={styles.levelText}>Level {playerStats.level}</Text>
									</View>
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
							</>
						)}
					</View>
				);
			default:
				return null;
		}
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
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
		padding: 20,
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
		marginVertical: 15,
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
	experienceContainer: {
		marginTop: 5,
	},
	experienceLabelContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
});
