/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './src/app.json';
import Login from "./src/screens/Login";
import Home from "./src/screens/Home";
import {useEffect, useState} from "react";
import {AuthTokenManager} from "./src/networking/authentication/AuthTokenManager";

const Root = () => {
  const [initialScreen, setInitialScreen] = useState(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AuthTokenManager.getInstance().getToken();
        if (token && await token.getAccessTokenAndRefreshIfNeeded()) {
          setInitialScreen(<Home />);
        } else {
          setInitialScreen(<Login />);
        }
      } catch {
        setInitialScreen(<Login />);
      }
    };
    checkToken().then();
  }, []);

  if (!initialScreen) return null;
  return initialScreen;
};

AppRegistry.registerComponent(appName, () => Root);
