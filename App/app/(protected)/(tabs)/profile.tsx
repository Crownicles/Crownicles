import {useFocusEffect, useNavigation} from "expo-router";
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {ProfileReq} from "@/src/@types/protobufs-client";
import {ProfileNotFound, ProfileRes} from "@/src/@types/protobufs-server";
import {useCallback, useEffect, useState} from "react";
import {AppConstants} from "@/src/AppConstants";
import {useProfile} from "@/src/contexts/ProfileContext";

type LoadingState = 'loading' | 'success' | 'error' | 'timeout';

export default function Profile() {
	const { profileData, setProfileData } = useProfile();
	const [profileState, setProfileState] = useState<LoadingState>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const navigation = useNavigation();

	const loadProfile = () => {
		setProfileState('loading');
		setErrorMessage('');

		WebSocketClient.getInstance().sendPacket(ProfileReq.create({ askedPlayer: {} }), {
			[ProfileRes.name]: (packet: ProfileRes) => {
				setProfileData({
					pseudo: packet.pseudo,
					classId: packet.classId
				});
				setProfileState('success');
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
		if (profileState === 'success' && profileData.pseudo) {
			navigation.setOptions({ title: profileData.pseudo });
		}
	}, [profileState, profileData.pseudo, navigation]);

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
					<View style={styles.centerContent}>
						<Text style={styles.placeholderText}>Profile content will be implemented here</Text>
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
});
