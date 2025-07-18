import {Button, Text, View} from "react-native";
import {useContext} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";

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
      <Button title="Logout" onPress={authState.logOut} />
    </View>
  );
}
