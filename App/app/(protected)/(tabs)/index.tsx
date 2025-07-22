import {Button, Text, View} from "react-native";
import {useContext} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

export default function Index() {
  const authState = useContext(AuthContext);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
      <View style={{ height: 24 }} />
      <Button title="Logout" onPress={() => {
		  authState.setState(AuthStateEnum.NO_TOKEN);
		  authState.clearToken().then().catch((err) => {
			  console.error("Failed to clear token:", err);
		  });
	  }} />
    </View>
  );
}
