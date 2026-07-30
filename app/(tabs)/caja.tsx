import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../supabase";

interface Caja {
  id: string;
  nombre: string;
  saldo_actual: number;
}

export default function CajaScreen() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [dineroEnCalle, setDineroEnCalle] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [totalGanancia, setTotalGanancia] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatosCaja();
  }, []);

  const cargarDatosCaja = async () => {
    setLoading(true);

    // 1. Cargar cajas y bancos
    const { data: cajasData, error: cajasError } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, saldo_actual");

    if (cajasError) {
      console.log("Error cargando cajas:", cajasError.message);
    } else {
      setCajas(cajasData || []);
    }

    // 2. Calcular el total del dinero en la calle (suma de saldos pendientes de préstamos activos)
    const { data: prestamosData, error: prestamosError } = await supabase
      .from("prestamos")
      .select("saldo_pendiente")
      .eq("estado", "activo");

    let sumaCalle = 0;
    if (!prestamosError && prestamosData) {
      sumaCalle = prestamosData.reduce(
        (acc, curr) => acc + Number(curr.saldo_pendiente || 0),
        0,
      );
      setDineroEnCalle(sumaCalle);
    }

    // 3. Calcular el total de gastos
    const { data: gastosData, error: gastosError } = await supabase
      .from("gastos")
      .select("monto");

    let sumaGastos = 0;
    if (!gastosError && gastosData) {
      sumaGastos = gastosData.reduce(
        (acc, curr) => acc + Number(curr.monto || 0),
        0,
      );
      setTotalGastos(sumaGastos);
    } else if (gastosError) {
      console.log("Error cargando gastos:", gastosError.message);
    }

    // 4. Calcular el total de ganancias (Suma de intereses de la tabla 'pagos' o calculada)
    // Nota: Asegúrate de que tu tabla de pagos tenga la columna 'monto_interes' (o cámbiala por el nombre real de tu columna de interés)
    const { data: pagosData, error: pagosError } = await supabase
      .from("pagos")
      .select("monto_interes");

    let sumaIntereses = 0;
    if (!pagosError && pagosData) {
      sumaIntereses = pagosData.reduce(
        (acc, curr) => acc + Number(curr.monto_interes || 0),
        0,
      );
    }

    // Ganancia Neta = Total Intereses Cobrados - Total Gastos
    const gananciaNeta = sumaIntereses - sumaGastos;
    setTotalGanancia(gananciaNeta);

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0984e3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Control de Caja y Bancos</Text>
      <Text style={styles.subtitle}>
        Dinero disponible, cartera en la calle, gastos y ganancias
      </Text>

      {/* Tarjetas de Cajas y Bancos */}
      {cajas.map((caja) => (
        <View key={caja.id} style={styles.card}>
          <Text style={styles.cardTitle}>{caja.nombre}</Text>
          <Text style={styles.cardValue}>
            $
            {Number(caja.saldo_actual).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      ))}

      {/* Tarjeta especial para el dinero en la calle */}
      <View style={[styles.card, styles.cardCalle]}>
        <Text style={styles.cardTitleCalle}>🏃‍♂️ Total Dinero en la Calle</Text>
        <Text style={styles.cardValueCalle}>
          $
          {dineroEnCalle.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>

      {/* Tarjeta especial para el total de gastos */}
      <View style={[styles.card, styles.cardGastos]}>
        <Text style={styles.cardTitleGastos}>📉 Total de Gastos</Text>
        <Text style={styles.cardValueGastos}>
          $
          {totalGastos.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>

      {/* Tarjeta especial para el total de ganancias */}
      <View style={[styles.card, styles.cardGanancia]}>
        <Text style={styles.cardTitleGanancia}>📈 Total de Ganancias</Text>
        <Text style={styles.cardValueGanancia}>
          $
          {totalGanancia.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f6fa" },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2f3640",
  },
  subtitle: {
    fontSize: 14,
    color: "#718093",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardCalle: {
    backgroundColor: "#e8f4fd",
    borderWidth: 1,
    borderColor: "#bbe1fa",
  },
  cardGastos: {
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fed7d7",
  },
  cardGanancia: {
    backgroundColor: "#f0fff4",
    borderWidth: 1,
    borderColor: "#c6f6d5",
  },
  cardTitle: {
    fontSize: 16,
    color: "#718093",
    marginBottom: 8,
    fontWeight: "600",
  },
  cardTitleCalle: {
    fontSize: 16,
    color: "#0077b6",
    marginBottom: 8,
    fontWeight: "bold",
  },
  cardTitleGastos: {
    fontSize: 16,
    color: "#c53030",
    marginBottom: 8,
    fontWeight: "bold",
  },
  cardTitleGanancia: {
    fontSize: 16,
    color: "#276749",
    marginBottom: 8,
    fontWeight: "bold",
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00b894",
  },
  cardValueCalle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#03045e",
  },
  cardValueGastos: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#9b2c2c",
  },
  cardValueGanancia: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2f855a",
  },
});
