import "react-native-gesture-handler";
import { useEffect, useState, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "../supabase";
import { View, ActivityIndicator, AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();

  // Referencias para controlar el temporizador y el tiempo en segundo plano
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimeRef = useRef<number | null>(null);

  // Definimos los tiempos independientes: 10 minutos para web, 5 minutos para móvil (Android)
  const WEB_TIMEOUT_MS = 10 * 60 * 1000;
  const MOBILE_TIMEOUT_MS = 5 * 60 * 1000;

  // Seleccionamos el tiempo según la plataforma actual
  const TIMEOUT_DURATION =
    Platform.OS === "web" ? WEB_TIMEOUT_MS : MOBILE_TIMEOUT_MS;

  // Función para cerrar sesión por inactividad
  const handleInactivityLogout = async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setUser(null);
    router.replace("/(auth)/sign-in");
  };

  // Función para reiniciar el contador de inactividad
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    // Si hay un usuario logueado, activamos el temporizador con la duración correspondiente
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        handleInactivityLogout();
      }, TIMEOUT_DURATION);
    }
  };

  useEffect(() => {
    // 1. Obtener la sesión actual al abrir la app de forma automática
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    // 2. Escuchar cambios de autenticación en tiempo real
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  // Manejar el temporizador y el comportamiento en segundo plano de manera precisa
  useEffect(() => {
    resetInactivityTimer();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Guardamos el momento exacto en que la app entra en segundo plano
        backgroundTimeRef.current = Date.now();
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      } else if (nextAppState === "active") {
        // Al volver, verificamos si pasó el tiempo límite en segundo plano
        if (backgroundTimeRef.current && user) {
          const elapsedMilliseconds = Date.now() - backgroundTimeRef.current;

          if (elapsedMilliseconds >= TIMEOUT_DURATION) {
            // Si pasaron los minutos correspondientes, cerramos sesión de inmediato
            handleInactivityLogout();
            backgroundTimeRef.current = null;
            return;
          }
        }
        // Si no pasó el tiempo límite, reanudamos el temporizador
        resetInactivityTimer();
        backgroundTimeRef.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  // 3. Proteger las rutas de forma segura usando un timeout para asegurar el montaje
  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === "(auth)";

    const timeout = setTimeout(() => {
      if (!user && !inAuthGroup) {
        router.replace("/(auth)/sign-in");
      } else if (user && inAuthGroup) {
        router.replace("/(tabs)");
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [user, initializing, segments]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0f172a",
        }}
      >
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          resetInactivityTimer();
          return false;
        }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="index" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
