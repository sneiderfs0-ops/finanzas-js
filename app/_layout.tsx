import React, { useEffect, useState, createContext, useContext } from "react";
import { useRouter, useSegments } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { supabase } from "../supabase";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Session } from "@supabase/supabase-js";

// 1. Contexto global para compartir el estado del Tema en toda la App
export const ThemeContext = createContext({
  isDarkMode: false,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// 2. Componente personalizado para el Menú Lateral de forma nativa
function CustomDrawerContent(props: any) {
  const { isDarkMode, toggleTheme } = props;
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.drawerContainer,
        isDarkMode && styles.darkDrawer,
      ]}
    >
      {/* Encabezado del Menú */}
      <View style={[styles.drawerHeader, isDarkMode && styles.darkHeader]}>
        <Text style={[styles.drawerTitle, isDarkMode && styles.darkText]}>
          💰 Sistema de Prestamos
        </Text>
        <Text style={styles.drawerSubtitle}>Panel Administrativo</Text>
      </View>

      {/* Enlaces de Navegación manuales con iconos llamativos */}
      <View style={styles.navLinks}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            🏠 Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/caja")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            📊 Balance General
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/empleados")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            👥 Empleados
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/clientes")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            📇 Clientes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/detalle-prestamo")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            💸 Cobros
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/lista-prestamos")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            💸 Lista prestamos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/crear-prestamo")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            📝 Nuevos Préstamos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/gastos")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            📉 Gastos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/cierre-caja")}
        >
          <Text style={[styles.navText, isDarkMode && styles.darkText]}>
            📈 Ganancia
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer: Cambiar Tema y Cerrar Sesión */}
      <View style={[styles.drawerFooter, isDarkMode && styles.darkFooter]}>
        <TouchableOpacity
          style={[
            styles.themeBtn,
            isDarkMode ? styles.btnDark : styles.btnLight,
          ]}
          onPress={toggleTheme}
        >
          <Text style={[styles.themeBtnText, isDarkMode && styles.btnDarkText]}>
            {isDarkMode ? "☀️ Modo Claro" : "🌙 Modo Oscuro"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// 3. Layout Principal
export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === "(auth)";

    const timeout = setTimeout(() => {
      if (!session && !inAuthGroup) {
        router.replace("/(auth)/sign-in");
      } else if (session && inAuthGroup) {
        router.replace("/");
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [session, initializing, segments]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDarkMode ? "#1e272e" : "#f5f6fa",
        }}
      >
        <ActivityIndicator size="large" color="#2ed573" />
      </View>
    );
  }

  const colors = {
    bg: isDarkMode ? "#1e272e" : "#f5f6fa",
    cardBg: isDarkMode ? "#2f3640" : "#ffffff",
    text: isDarkMode ? "#f5f6fa" : "#2f3640",
    headerBg: isDarkMode ? "#2f3640" : "#ffffff",
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <Drawer
        drawerContent={(props) => (
          <CustomDrawerContent
            {...props}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        )}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.headerBg,
          },
          headerTintColor: colors.text,
          drawerStyle: {
            backgroundColor: colors.cardBg,
            width: 280,
          },
          sceneStyle: {
            backgroundColor: colors.bg,
          },
          tabBarStyle:
            Platform.OS === "web"
              ? { display: "none" }
              : {
                  backgroundColor: colors.cardBg,
                  borderTopColor: isDarkMode ? "#475569" : "#dfe4ea",
                  height: 60,
                  paddingBottom: 8,
                },
          tabBarActiveTintColor: "#2ed573",
          tabBarInactiveTintColor: isDarkMode ? "#b2bec3" : "#636e72",
          headerTitle: "Sistema de Préstamos",
        }}
      >
        <Drawer.Screen
          name="(auth)"
          options={{
            drawerItemStyle: { display: "none" },
            headerShown: false,
            href: null,
          }}
        />

        <Drawer.Screen
          name="(tabs)/index"
          options={{
            title: "Inicio",
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="(tabs)/clientes"
          options={{
            title: "Clientes",
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="(tabs)/crear-prestamo"
          options={{
            title: "Préstamos",
            drawerItemStyle: { display: "none" },
            headerShown: false,
          }}
        />
        <Drawer.Screen
          name="(tabs)/detalle-prestamo"
          options={{
            title: "Cobros",
            drawerItemStyle: { display: "none" },
          }}
        />
        <Drawer.Screen
          name="(tabs)/lista-prestamos"
          options={{
            title: "Lista prestamos",
            drawerItemStyle: { display: "none" },
          }}
        />
        <Drawer.Screen
          name="(tabs)/caja"
          options={{
            title: "Balance General",
            drawerItemStyle: { display: "none" },
            href: null,
          }}
        />
        <Drawer.Screen
          name="(tabs)/empleados"
          options={{
            title: "Empleados",
            drawerItemStyle: { display: "none" },
            href: null,
          }}
        />
        <Drawer.Screen
          name="(tabs)/gastos"
          options={{
            title: "Gastos",
            drawerItemStyle: { display: "none" },
            href: null,
          }}
        />
        <Drawer.Screen
          name="(tabs)/cierre-caja"
          options={{
            title: "Ganancia",
            drawerItemStyle: { display: "none" },
            href: null,
          }}
        />
        <Drawer.Screen
          name="(tabs)/reportes"
          options={{
            title: "Reportes",
            drawerItemStyle: { display: "none" },
            href: null,
          }}
        />
      </Drawer>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  darkDrawer: {
    backgroundColor: "#2f3640",
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe4ea",
    marginBottom: 10,
  },
  darkHeader: {
    borderBottomColor: "#475569",
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2f3640",
  },
  darkText: {
    color: "#f5f6fa",
  },
  drawerSubtitle: {
    fontSize: 12,
    color: "#a4b0be",
    marginTop: 2,
  },
  navLinks: {
    paddingHorizontal: 15,
    flex: 1,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  navText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2f3640",
  },
  drawerFooter: {
    paddingHorizontal: 16,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#dfe4ea",
    gap: 10,
  },
  darkFooter: {
    borderTopColor: "#475569",
  },
  themeBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnLight: {
    backgroundColor: "#2f3640",
  },
  btnDark: {
    backgroundColor: "#f1f2f6",
  },
  themeBtnText: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#fff",
  },
  btnDarkText: {
    color: "#2f3640",
  },
  logoutBtn: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ff4757",
    alignItems: "center",
  },
  logoutBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
