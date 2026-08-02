import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { supabase } from "../supabase";
import { Ionicons } from "@expo/vector-icons";

export default function NotificacionesEmpleados() {
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    // 1. Obtener conteo inicial de empleados pendientes
    const fetchPendientes = async () => {
      const { count, error } = await supabase
        .from("empleados")
        .select("*", { count: "exact", head: true })
        .eq("aprobado", "pendiente");

      if (!error && count !== null) {
        setPendientesCount(count);
      }
    };

    fetchPendientes();

    // 2. Suscribirse a cambios en tiempo real de forma segura
    const channelName = "empleados_pendientes_channel";

    // Limpiar canal previo si ya existía para evitar conflictos
    supabase.removeChannel(supabase.channel(channelName));

    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "empleados" },
        (payload: any) => {
          if (payload.new && payload.new.aprobado === "pendiente") {
            setPendientesCount((prev) => prev + 1);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Conectado correctamente al canal
        }
      });

    // 3. Limpiar suscripción al desmontar el componente
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  if (pendientesCount === 0) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="notifications" size={22} color="#f59e0b" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{pendientesCount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
