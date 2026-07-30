import React, { useState, useEffect } from "react";
import { SymbolView } from "expo-symbols";
import { Link, Tabs } from "expo-router";
import { Pressable, Platform, View } from "react-native";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { supabase } from "../../supabase";
import NotificacionesEmpleados from "@/components/NotificacionesEmpleados";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    const verificarAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setEsAdmin(true);
      }
    };

    verificarAdmin();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEsAdmin(!!session?.user);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
        tabBarStyle: Platform.OS === "web" ? { display: "none" } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarButton: () => null,
          headerShown: true,
          headerTitle: "",
          headerStyle: {
            backgroundColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerRight: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: 15,
              }}
            >
              {esAdmin && <NotificacionesEmpleados />}
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <SymbolView
                      name={{
                        ios: "info.circle",
                        android: "info",
                        web: "info",
                      }}
                      size={22}
                      tintColor={Colors[colorScheme].text}
                      style={{ opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "person.2.fill", android: "group", web: "group" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="crear-prestamo"
        options={{
          title: "Nuevo Prestamo",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "plus.circle.fill", android: "add", web: "add" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="detalle-prestamo"
        options={{
          title: "Cobros",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "doc.text.fill", android: "list", web: "list" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="lista-prestamos"
        options={{
          title: "Lista prestamos",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "doc.text.fill", android: "list", web: "list" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="gastos"
        options={{
          title: "Gastos",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "arrow.down.circle.fill",
                android: "trending-down",
                web: "trending-down",
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />

      {/* --- NUEVAS PESTAÑAS AGREGADAS PARA EVITAR ADVERTENCIAS --- */}
      <Tabs.Screen
        name="caja"
        options={{
          title: "Balance General",
          tabBarButton: () => null, // Ocultas de la barra inferior al igual que index si usas cajón
        }}
      />
      <Tabs.Screen
        name="empleados"
        options={{
          title: "Empleados",
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="cierre-caja"
        options={{
          title: "Ganancia",
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: "Reportes",
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
