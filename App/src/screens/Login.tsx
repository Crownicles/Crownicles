import React from "react";
import {Alert, Image, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import InAppBrowser from "react-native-inappbrowser-reborn";
import {toast} from "react-toastify";
import {RestApi} from "../networking/RestApi.ts";
import {AuthTokenManager} from "../networking/authentication/AuthTokenManager.ts";
import {Buffer} from "buffer";

const Login = () => {
  const handleDiscordLogin = () => {
    if (InAppBrowser) {
      RestApi.loginWithDiscord()
        .then(async result => {
          if (result.type === 'success') {
            // Handle successful login
            Alert.alert('Succès', 'Connexion Discord réussie: ' + JSON.stringify(result));
			let token = result.url.split('token=')[1];
			if (token) {
			    await AuthTokenManager.getInstance().setTokenFromKeycloakOAuth2Token(JSON.parse(Buffer.from(token, 'base64').toString('utf-8')));
				toast("Connexion Discord réussie !", {
					type: 'success',
				    autoClose: 5000,
				});
			}
			else {
				toast("Une erreur s'est produite lors de la connexion Discord. Veuillez réessayer.", {
					type: 'error',
				    autoClose: 5000,
				});
			}
          } else {
			toast("Connexion Discord annulée ou échouée. Veuillez réessayer.", {
				type: 'error',
			    autoClose: 5000,
			});
          }
        })
        .catch(error => {
          toast("Erreur lors de la connexion Discord: " + error.message, {
				type: 'error',
				autoClose: 5000,
          })
        });
    }
  };

  return (
		  <View style={styles.container}>
			  <View style={styles.topSection}>
				  <Image source={require("../assets/crownicles-logo.png")} style={styles.logo}/>
				  <Text style={styles.title}>Crownicles</Text>
			  </View>
			  <View style={styles.middleSection}>
				  <TouchableOpacity style={styles.discordButton} onPress={handleDiscordLogin}>
					  <Image source={require("../assets/discord-icon.png")} style={styles.discordIcon}/>
					  <Text style={styles.buttonText}>Se connecter avec Discord</Text>
				  </TouchableOpacity>
			  </View>
		  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#b95e4b',
  },
  topSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  discordIcon: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default Login;