import {useFocusEffect, useNavigation} from "expo-router";
import {StyleSheet, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {ProfileReq} from "@/src/@types/protobufs-client";
import {ProfileNotFound, ProfileRes} from "@/src/@types/protobufs-server";
import {useCallback, useEffect} from "react";
import {AppConstants} from "@/src/AppConstants";
import {useProfile} from "@/src/contexts/ProfileContext";

export default function Profile() {
	const navigation = useNavigation();
	const { profileData, setProfileData } = useProfile();

	const loadProfile = () => {
		WebSocketClient.getInstance().sendPacket(ProfileReq.create({ askedPlayer: {} }), {
			[ProfileRes.name]: (packet: ProfileRes) => {
				setProfileData({
					pseudo: packet.pseudo,
					classId: packet.classId
				});
			},
			[ProfileNotFound.name]: (packet: ProfileNotFound) => {
				// TODO
			}
		}, {
			time: AppConstants.PACKET_TIMEOUT,
			callback: () => {
				// TODO
			}
		});
	}

	// Update header title when profile data changes
	useEffect(() => {
		navigation.setOptions({
			title: profileData.pseudo
		});
	}, [navigation, profileData.pseudo]);

	// todo: verify that it does not run twice in production mode
	useFocusEffect(useCallback(() => {
		loadProfile();
		}, [])
	);


	return (
		<View style={styles.container}>
			{/* Main content goes here */}
			<View style={styles.content}>
				{/* Add your profile content here */}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	content: {
		flex: 1,
		marginTop: 25,
	},
});
