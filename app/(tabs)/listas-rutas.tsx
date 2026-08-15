import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { supabase } from "../../supabase";
import { colors, globalStyles } from "@/constants/globalStyles";

export default function ListasRutasScreen() {
  const [rutasConEmpleados, setRutasConEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarRutasYEmpleados();
  }, []);

  const cargarRutasYEmpleados = async () => {
    try {
      setLoading(true);

      // 1. Obtener todas las rutas
      const { data: rutasData, error: rutasError } = await supabase
        .from("rutas")
        .select("*")
        .order("created_at", { ascending: false });

      if (rutasError) throw rutasError;
      if (!rutasData) return;

      // 2. Obtener las relaciones usando 'nombres' y 'apellidos' en lugar de 'nombre'
      const { data: asignacionesData, error: asigError } = await supabase.from(
        "empleado_rutas",
      ).select(`
          ruta_id,
          empleados (
            id,
            nombres,
            apellidos,
            correo
          )
        `);

      if (asigError) throw asigError;

      // 3. Cruzar la información para agrupar los empleados por cada ruta
      const rutasCombinadas = rutasData.map((ruta: any) => {
        const empleadosDeEstaRuta = asignacionesData
          ? asignacionesData
              .filter((item: any) => item.ruta_id === ruta.id)
              .map((item: any) => item.empleados)
              .filter(Boolean)
          : [];

        return {
          ...ruta,
          empleados: empleadosDeEstaRuta,
        };
      });

      setRutasConEmpleados(rutasCombinadas);
    } catch (error) {
      console.error("Error al cargar el reporte de rutas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          globalStyles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={localStyles.screenContainer}>
      <View style={globalStyles.mainWrapper}>
        <Text style={globalStyles.title}>📋 Reporte General de Rutas</Text>
        <Text style={globalStyles.subtitle}>
          Visualiza las rutas registradas, sus sectores y el personal asignado
        </Text>

        <FlatList
          data={rutasConEmpleados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
          renderItem={({ item }) => (
            <View style={[globalStyles.dashboardCard, localStyles.cardSpacing]}>
              <Text style={localStyles.routeName}>{item.nombre_ruta}</Text>
              <Text style={localStyles.routeDesc}>
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  Sectores:{" "}
                </Text>
                {item.descripcion || "Sin descripción"}
              </Text>

              <View style={localStyles.divider} />

              <Text style={localStyles.empleadosTitle}>
                👥 Empleados Asignados:
              </Text>

              {item.empleados && item.empleados.length > 0 ? (
                item.empleados.map((emp: any, index: number) => (
                  <View key={emp.id || index} style={localStyles.empleadoRow}>
                    <Text style={localStyles.empleadoText}>
                      •{" "}
                      {emp.nombres
                        ? `${emp.nombres} ${emp.apellidos || ""}`
                        : emp.correo}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={localStyles.sinAsignarText}>
                  ⚠️ Ningún empleado asignado a esta ruta.
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={localStyles.emptyText}>
              No hay rutas registradas en el sistema.
            </Text>
          }
        />
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  cardSpacing: {
    width: "100%",
    marginBottom: 16,
    padding: 16,
  },
  routeName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 6,
  },
  routeDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border || "#333",
    marginVertical: 10,
  },
  empleadosTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  empleadoRow: {
    marginLeft: 8,
    marginVertical: 2,
  },
  empleadoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sinAsignarText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginLeft: 8,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 15,
  },
});
