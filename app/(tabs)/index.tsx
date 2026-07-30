import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../supabase";

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState({
    prestadoHoy: 0,
    recaudadoHoy: 0,
    activos: 0,
  });
  const [cajasBancos, setCajasBancos] = useState<any[]>([]);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/(auth)/sign-in");
    } else {
      await cargarResumen();
      await cargarCajasYBancos();
      setLoading(false);
    }
  };

  const cargarResumen = async () => {
    const hoy = new Date().toISOString().split("T")[0];

    const { data: prestamos } = await supabase
      .from("prestamos")
      .select("monto_total, fecha_prestamo")
      .gte("fecha_prestamo", `${hoy}T00:00:00`);

    const totalPrestado =
      prestamos?.reduce((acc, curr) => acc + Number(curr.monto_total), 0) || 0;

    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto_pagado")
      .gte("fecha_pago", `${hoy}T00:00:00`);

    const totalRecaudado =
      pagos?.reduce((acc, curr) => acc + Number(curr.monto_pagado), 0) || 0;

    setResumen({
      prestadoHoy: totalPrestado,
      recaudadoHoy: totalRecaudado,
      activos: prestamos?.length || 0,
    });
  };

  const cargarCajasYBancos = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("nombre, saldo_actual");
    if (data) {
      setCajasBancos(data);
    }
  };

  const totalGeneral = resumen.prestadoHoy + resumen.recaudadoHoy;
  const porcentajePrestado =
    totalGeneral > 0 ? (resumen.prestadoHoy / totalGeneral) * 100 : 50;
  const porcentajeRecaudado =
    totalGeneral > 0 ? (resumen.recaudadoHoy / totalGeneral) * 100 : 50;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0984e3" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      <Text style={styles.headerTitle}>Panel de Control</Text>
      <Text style={styles.subtitle}>
        Resumen financiero y accesos rápidos de hoy
      </Text>

      {/* Tarjetas Principales de Resumen */}
      <View style={styles.cardGrid}>
        <View style={[styles.card, { backgroundColor: "#e3f2fd" }]}>
          <Text style={styles.cardTitle}>Prestado Hoy</Text>
          <Text style={[styles.cardValue, { color: "#1976d2" }]}>
            ${resumen.prestadoHoy.toLocaleString()}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: "#e8f5e9" }]}>
          <Text style={styles.cardTitle}>Recaudado Hoy</Text>
          <Text style={[styles.cardValue, { color: "#2e7d32" }]}>
            ${resumen.recaudadoHoy.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Gráfico de Torta / Proporción Visual Llamativo */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>📊 Flujo de Dinero de Hoy</Text>

        <View style={styles.donutContainer}>
          <View style={styles.donutCircle}>
            <Text style={styles.donutCenterText}>Total</Text>
            <Text style={styles.donutCenterValue}>
              ${totalGeneral.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendColor, { backgroundColor: "#1976d2" }]}
            />
            <Text style={styles.legendText}>
              Prestado ({porcentajePrestado.toFixed(0)}%)
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendColor, { backgroundColor: "#2e7d32" }]}
            />
            <Text style={styles.legendText}>
              Recaudado ({porcentajeRecaudado.toFixed(0)}%)
            </Text>
          </View>
        </View>
      </View>

      {/* Tarjetas Agrupadas / Accesos Rápidos Estilizados con Resultados Reales */}
      <Text style={styles.sectionTitle}>Módulos y Saldos</Text>

      <View style={styles.menuGrid}>
        <TouchableOpacity
          style={[styles.menuCard, { borderLeftColor: "#ff4757" }]}
          onPress={() => router.push("/(tabs)/detalle-prestamo")}
        >
          <Text style={styles.menuEmoji}>💸</Text>
          <Text style={styles.menuTitle}>Cobros</Text>
          <Text style={styles.menuDesc}>
            Gestionar abonos y cuotas de créditos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { borderLeftColor: "#2ed573" }]}
          onPress={() => router.push("/(tabs)/caja")}
        >
          <Text style={styles.menuEmoji}>💰</Text>
          <Text style={styles.menuTitle}>Caja / Bancos</Text>
          <View style={styles.saldosContainer}>
            {cajasBancos.length > 0 ? (
              cajasBancos.map((item, index) => (
                <Text key={index} style={styles.saldoText}>
                  {item.nombre}:{" "}
                  <Text style={styles.boldSaldo}>
                    ${Number(item.saldo_actual).toLocaleString()}
                  </Text>
                </Text>
              ))
            ) : (
              <Text style={styles.menuDesc}>Sin cajas registradas</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { borderLeftColor: "#ffa502" }]}
          onPress={() => router.push("/(tabs)/gastos")}
        >
          <Text style={styles.menuEmoji}>📑</Text>
          <Text style={styles.menuTitle}>Gastos & Nómina</Text>
          <Text style={styles.menuDesc}>
            Pagos de empleados y egresos generales
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { borderLeftColor: "#3742fa" }]}
          onPress={() => router.push("/(tabs)/empleados")}
        >
          <Text style={styles.menuEmoji}>👥</Text>
          <Text style={styles.menuTitle}>Empleados</Text>
          <Text style={styles.menuDesc}>
            Autorizaciones y accesos de personal
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  container: { flex: 1, padding: 16, backgroundColor: "#f5f6fa" },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#2f3640",
  },
  subtitle: {
    fontSize: 14,
    color: "#718093",
    marginBottom: 16,
  },
  cardGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  cardTitle: {
    fontSize: 13,
    color: "#57606f",
    marginBottom: 6,
    fontWeight: "600",
  },
  cardValue: { fontSize: 20, fontWeight: "bold" },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 14,
  },
  donutContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 14,
    borderColor: "#1976d2",
    borderLeftColor: "#2e7d32",
    borderBottomColor: "#ff4757",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  donutCircle: {
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterText: {
    fontSize: 12,
    color: "#718093",
    fontWeight: "600",
  },
  donutCenterValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2f3640",
  },
  legendContainer: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "center",
    width: "100%",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: "#4b6584",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  menuCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  menuEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 12,
    color: "#718093",
    lineHeight: 16,
  },
  saldosContainer: {
    marginTop: 4,
  },
  saldoText: {
    fontSize: 12,
    color: "#718093",
    marginBottom: 2,
  },
  boldSaldo: {
    fontWeight: "bold",
    color: "#2e7d32",
  },
});
