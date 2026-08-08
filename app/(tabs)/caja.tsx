import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { supabase } from "../../supabase";
import { globalStyles } from "@/constants/globalStyles";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

interface Caja {
  id: string;
  nombre: string;
  moneda: "USD" | "COP";
  saldo_actual: number;
}

export default function CajaScreen() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [dineroEnCalleUSD, setDineroEnCalleUSD] = useState(0);
  const [dineroEnCalleCOP, setDineroEnCalleCOP] = useState(0);
  const [totalGastosUSD, setTotalGastosUSD] = useState(0);
  const [totalGastosCOP, setTotalGastosCOP] = useState(0);
  const [totalGananciaUSD, setTotalGananciaUSD] = useState(0);
  const [totalGananciaCOP, setTotalGananciaCOP] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    verificarAccesoYcargarDatos();
  }, []);

  const verificarAccesoYcargarDatos = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user?.email) {
        Alert.alert("Acceso denegado", "Debe iniciar sesión para continuar.");
        setLoading(false);
        return;
      }

      const emailLogueado = session.user.email.trim().toLowerCase();

      const { data: adminData, error: adminError } = await supabase
        .from("administradores")
        .select("correo")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (adminError || !adminData) {
        Alert.alert(
          "Acceso Restringido",
          "No tiene permisos de administrador para ver esta sección.",
        );
        setLoading(false);
        return;
      }

      await cargarDatosCaja();
    } catch (error) {
      console.error("Error al verificar el rol de administrador:", error);
      setLoading(false);
    }
  };

  const cargarDatosCaja = async () => {
    // 1. Cargar cajas y bancos
    const { data: cajasData, error: cajasError } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda, saldo_actual");

    if (cajasError) {
      console.log("Error cargando cajas:", cajasError.message);
    } else {
      setCajas(cajasData || []);
    }

    // 2. Cargar dinero en la calle (préstamos activos)
    const { data: prestamosData, error: prestamosError } = await supabase
      .from("prestamos")
      .select("saldo_pendiente, estado, moneda")
      .eq("estado", "activo");

    let sumaCalleUSD = 0;
    let sumaCalleCOP = 0;

    if (!prestamosError && prestamosData) {
      prestamosData.forEach((curr) => {
        const saldoPendiente = Number(curr.saldo_pendiente || 0);
        if (curr.moneda === "USD") {
          sumaCalleUSD += saldoPendiente;
        } else {
          sumaCalleCOP += saldoPendiente;
        }
      });
      setDineroEnCalleUSD(Math.max(0, sumaCalleUSD));
      setDineroEnCalleCOP(Math.max(0, sumaCalleCOP));
    }

    // 3. Cargar todos los pagos/intereses acumulados
    const { data: pagosData, error: pagosError } = await supabase
      .from("pagos")
      .select("monto_pagado, moneda");

    let sumaInteresesUSD = 0;
    let sumaInteresesCOP = 0;

    if (!pagosError && pagosData) {
      pagosData.forEach((curr: any) => {
        const montoPagado = Number(curr.monto_pagado || 0);
        const interesEstimado = montoPagado * 0.15;

        if (curr.moneda === "USD") {
          sumaInteresesUSD += interesEstimado;
        } else {
          sumaInteresesCOP += interesEstimado;
        }
      });
    }

    // 4. Cargar todos los gastos acumulados
    const { data: gastosData, error: gastosError } = await supabase
      .from("gastos")
      .select("monto, moneda");

    let sumaGastosUSD = 0;
    let sumaGastosCOP = 0;

    if (!gastosError && gastosData) {
      gastosData.forEach((curr) => {
        const monto = Number(curr.monto || 0);
        if (curr.moneda === "USD") {
          sumaGastosUSD += monto;
        } else {
          sumaGastosCOP += monto;
        }
      });
      setTotalGastosUSD(Math.max(0, sumaGastosUSD));
      setTotalGastosCOP(Math.max(0, sumaGastosCOP));
    }

    // 5. Calcular Ganancia Neta Acumulada (Intereses - Gastos)
    setTotalGananciaUSD(Math.max(0, sumaInteresesUSD - sumaGastosUSD));
    setTotalGananciaCOP(Math.max(0, sumaInteresesCOP - sumaGastosCOP));

    setLoading(false);
  };

  let efectivoUSD = 0;
  let efectivoCOP = 0;
  let bancosUSD = 0;
  let bancosCOP = 0;

  cajas.forEach((caja) => {
    const saldo = Math.max(0, Number(caja.saldo_actual || 0));
    const nombre = caja.nombre.toLowerCase();
    if (caja.moneda === "USD") {
      if (
        nombre.includes("banco") ||
        nombre.includes("cuenta") ||
        nombre.includes("transferencia")
      )
        bancosUSD += saldo;
      else efectivoUSD += saldo;
    } else {
      if (
        nombre.includes("banco") ||
        nombre.includes("cuenta") ||
        nombre.includes("transferencia")
      )
        bancosCOP += saldo;
      else efectivoCOP += saldo;
    }
  });

  const fechaActual = new Date().toLocaleDateString();

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPdf(true);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Reporte General</title>
            <style>
              @page { size: landscape; margin: 10mm; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background-color: #ffffff; }
              h2 { text-align: center; color: #0f172a; margin-bottom: 5px; font-size: 24px; font-weight: 700; }
              p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
              tr:nth-child(even) { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <h2>Control de Caja y Bancos</h2>
            <p class="subtitle">Generado el: ${fechaActual}</p>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Efectivo USD</th>
                  <th>Efectivo COP</th>
                  <th>Bancos USD</th>
                  <th>Bancos COP</th>
                  <th>Calle USD</th>
                  <th>Calle COP</th>
                  <th>Gastos USD</th>
                  <th>Gastos COP</th>
                  <th>Ganancia USD</th>
                  <th>Ganancia COP</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>${fechaActual}</b></td>
                  <td>$${Math.max(0, efectivoUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, efectivoCOP).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, bancosUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, bancosCOP).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, dineroEnCalleUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, dineroEnCalleCOP).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, totalGastosUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, totalGastosCOP).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, totalGananciaUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${Math.max(0, totalGananciaCOP).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        } else {
          Alert.alert(
            "Aviso",
            "Por favor permita las ventanas emergentes para descargar el PDF.",
          );
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Reporte Consolidado de Caja",
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("Éxito", `PDF guardado en: ${uri}`);
        }
      }
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF. Intente nuevamente.");
    } finally {
      setGeneratingPdf(false);
    }
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
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.topHeaderRow}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Control de Caja y Bancos</Text>
          <Text style={styles.subtitle}>
            Balance general, efectivo, bancos, gastos y ganancia neta en tiempo
            real
          </Text>
        </View>

        <TouchableOpacity
          style={styles.pdfButton}
          onPress={handleDownloadPDF}
          disabled={generatingPdf}
        >
          {generatingPdf ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.pdfButtonText}>📥 Descargar PDF</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.gridContainer}>
        {cajas.map((caja) => {
          const saldoLimpio = Math.max(0, Number(caja.saldo_actual || 0));
          return (
            <View key={caja.id} style={[styles.card, styles.cardCaja]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{caja.nombre}</Text>
                <Text style={styles.monedaBadge}>{caja.moneda}</Text>
              </View>
              <Text style={styles.cardValue}>
                {caja.moneda === "USD" ? "$" : "$ "}
                {saldoLimpio.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          );
        })}

        <View style={[styles.card, styles.cardCalle]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleCalle}>Dinero en la Calle</Text>
            <Text style={styles.monedaBadgeCalle}>USD</Text>
          </View>
          <Text style={styles.cardValueCalle}>
            $
            {Math.max(0, dineroEnCalleUSD).toLocaleString(undefined, {
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
            {Math.max(0, dineroEnCalleCOP).toLocaleString(undefined, {
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
            {Math.max(0, totalGastosUSD).toLocaleString(undefined, {
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
            {Math.max(0, totalGastosCOP).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Tarjeta Ganancia Neta Acumulada USD */}
        <View style={[styles.card, styles.cardGanancia]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGanancia}>Ganancia Neta</Text>
            <Text style={styles.monedaBadgeGanancia}>USD</Text>
          </View>
          <Text style={styles.cardValueGanancia}>
            $
            {Math.max(0, totalGananciaUSD).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Tarjeta Ganancia Neta Acumulada COP */}
        <View style={[styles.card, styles.cardGanancia]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleGanancia}>Ganancia Neta</Text>
            <Text style={styles.monedaBadgeGanancia}>COP</Text>
          </View>
          <Text style={styles.cardValueGanancia}>
            $
            {Math.max(0, totalGananciaCOP).toLocaleString(undefined, {
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
    padding: 16,
    paddingBottom: 50,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topHeaderRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    justifyContent: "space-between",
    alignItems: Platform.OS === "web" ? "flex-start" : "stretch",
    marginBottom: 20,
    gap: 12,
  },
  headerContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  pdfButton: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: Platform.OS === "web" ? "auto" : "flex-end",
  },
  pdfButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
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
