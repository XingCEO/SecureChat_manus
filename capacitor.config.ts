import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securechat.app',
  appName: 'SecureChat',
  webDir: 'src/web',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#2563eb",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2563eb"
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true
    },
    App: {
      launchUrl: "index.html"
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2563eb",
      sound: "beep.wav"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  ios: {
    scheme: "SecureChat",
    contentInset: "automatic"
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: "APK"
    }
  }
};

export default config;

