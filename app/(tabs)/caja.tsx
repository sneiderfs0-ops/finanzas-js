import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";
import { globalStyles } from "@/constants/globalStyles";

interface Caja {
  id: string;
  nombre: string;
  moneda: "USD" | "COP";
  saldo_actual: number;
}

export default function CajaScreen() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [saldoActualUSD, setSaldoActualUSD] = useState(0);
  const [saldoActualCOP, setSaldoActualCOP] = useState(0);
  const [dineroEnCalleUSD, setDineroEnCalleUSD] = useState(0);
  const [dineroEnCalleCOP, setDineroEnCalleCOP] = useState(0);
  const [totalGastosUSD, setTotalGastosUSD] = useState(0);
  const [totalGastosCOP, setTotalGastosCOP] = useState(0);
  const [totalGananciaUSD, setTotalGananciaUSD] = useState(0);
  const [totalGananciaCOP, setTotalGananciaCOP] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatosCaja();
  }, []);

  const cargarDatosCaja = async () => {
    setLoading(true);

    // 1. Cargar cajas y bancos con su moneda
    const { data: cajasData, error: cajasError } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda, saldo_actual");

    if (cajasError) {
      console.log("Error cargando cajas:", cajasError.message);
    } else {
      setCajas(cajasData || []);
    }

    // 2. Cargar Préstamos Activos (Dinero en la Calle y Capital Inicial)
    const { data: prestamosData, error: prestamosError } = await supabase
      .from("prestamos")
      .select("saldo_pendiente, monto_prestado, estado, moneda")
      .eq("estado", "activo");

    let sumaCapitalInicialUSD = 0;
    let sumaCapitalInicialCOP = 0;
    let sumaCalleUSD = 0;
    let sumaCalleCOP = 0;

    if (!prestamosError && prestamosData) {
      prestamosData.forEach((curr) => {
        const saldoPendiente = Number(curr.saldo_pendiente || 0);
        const montoPrestado = Number(
          curr.monto_prestado || curr.saldo_pendiente || 0,
        );

        if (curr.moneda === "USD") {
          sumaCapitalInicialUSD += montoPrestado;
          sumaCalleUSD += saldoPendiente;
        } else {
          sumaCapitalInicialCOP += montoPrestado;
          sumaCalleCOP += saldoPendiente;
        }
      });
      setDineroEnCalleUSD(sumaCalleUSD);
      setDineroEnCalleCOP(sumaCalleCOP);
    }

    // 3. Cargar Pagos (Capital + Intereses recibidos)
    const { data: pagosData, error: pagosError } = await supabase
      .from("pagos")
      .select("monto_pagado, monto_interes, moneda");

    let sumaPagosEntradosUSD = 0;
    let sumaPagosEntradosCOP = 0;
    let sumaInteresesUSD = 0;
    let sumaInteresesCOP = 0;

    if (!pagosError && pagosData) {
      pagosData.forEach((curr: any) => {
        const montoPagado = Number(curr.monto_pagado || 0);
        const montoInteres = Number(curr.monto_interes || 0);

        if (curr.moneda === "USD") {
          sumaPagosEntradosUSD += montoPagado;
          sumaInteresesUSD += montoInteres;
        } else {
          sumaPagosEntradosCOP += montoPagado;
          sumaInteresesCOP += montoInteres;
        }
      });
    }

    // 4. Cargar el total de gastos
    const { data: gastosData, error: gastosError } = await supabase
      .from("gastos")
      .select("monto, moneda");

    let sumaGastosUSD = 0;
    let sumaGastosCOP = 0;
    if (!gastosError && gastosData) {
      gastosData.forEach((curr) => {
        const monto = Number(curr.monto || 0);
        if (curr.moneda === "USD") sumaGastosUSD += monto;
        else sumaGastosCOP += monto;
      });
      setTotalGastosUSD(sumaGastosUSD);
      setTotalGastosCOP(sumaGastosCOP);
    }

    // Cálculos finales
    setSaldoActualUSD(sumaCapitalInicialUSD + sumaPagosEntradosUSD);
    setSaldoActualCOP(sumaCapitalInicialCOP + sumaPagosEntradosCOP);
    setTotalGananciaUSD(sumaInteresesUSD - sumaGastosUSD);
    setTotalGananciaCOP(sumaInteresesCOP - sumaGastosCOP);

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[globalStyles.container, styles.loaderContainer]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.mainContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Control de Caja y Bancos</Text>
        <Text style={styles.subtitle}>
          Resumen financiero en tiempo real (USD / COP)
        </Text>
      </View>

      <View style={styles.gridContainer}>
        {cajas.map((caja) => (
          <View key={caja.id} style={[styles.card, styles.cardCaja]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{caja.nombre}</Text>
              <Text style={styles.monedaBadge}>{caja.moneda}</Text>
            </View>
            <Text style={styles.cardValue}>
              {caja.moneda === "USD" ? "$" : "$ "}
              {Number(caja.saldo_actual).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        ))}

        <View style={[styles.card, styles.cardCapital]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleCapital}>Saldo Actual Acumulado</Text>
            <Text style={styles.monedaBadgeCapital}>USD</Text>
          </View>
          <Text style={styles.cardValueCapital}>
            $
            {saldoActualUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardCapital]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleCapital}>Saldo Actual Acumulado</Text>
            <Text style={styles.monedaBadgeCapital}>COP</Text>
          </View>
          <Text style={styles.cardValueCapital}>
            $
            {saldoActualCOP.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardCalle]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleCalle}>Dinero en la Calle</Text>
            <Text style={styles.monedaBadgeCalle}>USD</Text>
          </View>
          <Text style={styles.cardValueCalle}>
            $
            {dineroEnCalleUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardCalle]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleCalle}>Dinero en la Calle</Text>
            <Text style={styles.monedaBadgeCalle}>COP</Text>
          </View>
          <Text style={styles.cardValueCalle}>
            $
            {dineroEnCalleCOP.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardGastos]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGastos}>Total Gastos</Text>
            <Text style={styles.monedaBadgeGastos}>USD</Text>
          </View>
          <Text style={styles.cardValueGastos}>
            $
            {totalGastosUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardGastos]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGastos}>Total Gastos</Text>
            <Text style={styles.monedaBadgeGastos}>COP</Text>
          </View>
          <Text style={styles.cardValueGastos}>
            $
            {totalGastosCOP.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardGanancia]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGanancia}>Ganancia Neta</Text>
            <Text style={styles.monedaBadgeGanancia}>USD</Text>
          </View>
          <Text style={styles.cardValueGanancia}>
            $
            {totalGananciaUSD.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={[styles.card, styles.cardGanancia]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGanancia}>Ganancia Neta</Text>
            <Text style={styles.monedaBadgeGanancia}>COP</Text>
          </View>
          <Text style={styles.cardValueGanancia}>
            $
            {totalGananciaCOP.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    width: Platform.OS === "web" ? "48.5%" : "100%",
    shadowColor: "#64748b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardCaja: {
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  cardCapital: {
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  cardCalle: {
    borderLeftWidth: 4,
    borderLeftColor: "#0ea5e9",
  },
  cardGastos: {
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  cardGanancia: {
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitleCapital: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b45309",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitleCalle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369a1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitleGastos: {
    fontSize: 14,
    fontWeight: "600",
    color: "#b91c1c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitleGanancia: {
    fontSize: 14,
    fontWeight: "600",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e293b",
  },
  cardValueCapital: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#d97706",
  },
  cardValueCalle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0284c7",
  },
  cardValueGastos: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#dc2626",
  },
  cardValueGanancia: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#059669",
  },
  monedaBadge: {
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#e0e7ff",
    color: "#4338ca",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  monedaBadgeCapital: {
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#fef3c7",
    color: "#b45309",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  monedaBadgeCalle: {
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  monedaBadgeGastos: {
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  monedaBadgeGanancia: {
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#d1fae5",
    color: "#047857",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
});
