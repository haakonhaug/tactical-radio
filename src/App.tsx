import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import CallScreen from './screens/CallScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkTheme: Theme = {
  dark: true,
  colors: {
    primary: '#00ff41',
    background: '#0a0a0a',
    card: '#1a1a1a',
    text: '#e0e0e0',
    border: '#333333',
    notification: '#ff9800',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{
            gestureEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
