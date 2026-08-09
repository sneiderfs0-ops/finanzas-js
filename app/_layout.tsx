import "react-native-gesture-handler";
import { useEffect, useState, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "../supabase";
import { View, ActivityIndicator, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();

  // Referencia para controlar el temporizador de inactividad
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Función para cerrar sesión por inactividad
  const handleInactivityLogout = async () => {
    if (user) {
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
    }
  };

  // Función para reiniciar el contador de los 10 minutos
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    // Si hay un usuario logueado, activamos el temporizador de 10 minutos (600,000 ms)
    if (user) {
      inactivityTimer.current = setTimeout(
        () => {
          handleInactivityLogout();
        },
        10 * 60 * 1000,
      );
    }
  };

  useEffect(() => {
    // 1. Obtener la sesión actual al abrir la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitializing(false);
    });

    // 2. Escuchar cambios de autenticación
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

  // Manejar el temporizador cada vez que cambia el estado del usuario o app en segundo plano
  useEffect(() => {
    resetInactivityTimer();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        resetInactivityTimer();
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

    // Usar setTimeout evita errores de navegación si el componente aún no termina de renderizar
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
