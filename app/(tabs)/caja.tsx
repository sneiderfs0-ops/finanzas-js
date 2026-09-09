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
  useWindowDimensions,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { supabase } from "../../supabase";
import { globalStyles } from "@/constants/globalStyles";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

interface ResumenFinanciero {
  titulo: string;
  montoUSD: number;
  montoCOP: number;
  tipo: "caja" | "calle" | "gastos" | "ganancia";
}

export default function CajaScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768 || Platform.OS !== "web";

  const [resumenData, setResumenData] = useState<ResumenFinanciero[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Estados para el modal de edición de caja/banco
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editEfectivoUSD, setEditEfectivoUSD] = useState("");
  const [editEfectivoCOP, setEditEfectivoCOP] = useState("");
  const [editBancosUSD, setEditBancosUSD] = useState("");
  const [editBancosCOP, setEditBancosCOP] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Mapeo de IDs de la tabla cajas_bancos
  const [idsCajas, setIdsCajas] = useState({
    efectivoUSDId: "",
    efectivoCOPId: "",
    bancosUSDId: "",
    bancosCOPId: "",
  });

  const [totalesPDF, setTotalesPDF] = useState({
    efectivoUSD: 0,
    efectivoCOP: 0,
    bancosUSD: 0,
    bancosCOP: 0,
    calleUSD: 0,
    calleCOP: 0,
    gastosUSD: 0,
    gastosCOP: 0,
    gananciaUSD: 0,
    gananciaCOP: 0,
  });

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

      const channelName = `rt-caja-screen-${session.user.id}-${Date.now()}`;
      const channelRealtime = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prestamos" },
          () => {
            cargarDatosCaja();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pagos" },
          () => {
            cargarDatosCaja();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gastos" },
          () => {
            cargarDatosCaja();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cajas_bancos" },
          () => {
            cargarDatosCaja();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "productos" },
          () => {
            cargarDatosCaja();
          },
        )
        .subscribe();

      setLoading(false);

      return () => {
        supabase.removeChannel(channelRealtime);
      };
    } catch (error) {
      console.error("Error al verificar el rol de administrador:", error);
      setLoading(false);
    }
  };

  const cargarDatosCaja = async () => {
    try {
      const { data: cajasData, error: cajasError } = await supabase
        .from("cajas_bancos")
        .select("id, nombre, moneda, saldo_actual");

      let locEfectivoUSD = 0;
      let locEfectivoCOP = 0;
      let locBancosUSD = 0;
      let locBancosCOP = 0;
      let listaCajasRender: ResumenFinanciero[] = [];

      let idEfUSD = "";
      let idEfCOP = "";
      let idBaUSD = "";
      let idBaCOP = "";

      if (!cajasError && cajasData) {
        cajasData.forEach((caja) => {
          const saldo = Math.max(0, Number(caja.saldo_actual || 0));
          const nombreLower = caja.nombre.toLowerCase();

          if (caja.moneda === "USD") {
            if (
              nombreLower.includes("banco") ||
              nombreLower.includes("cuenta") ||
              nombreLower.includes("transferencia")
            ) {
              locBancosUSD += saldo;
              idBaUSD = caja.id;
            } else {
              locEfectivoUSD += saldo;
              idEfUSD = caja.id;
            }
          } else {
            if (
              nombreLower.includes("banco") ||
              nombreLower.includes("cuenta") ||
              nombreLower.includes("transferencia")
            ) {
              locBancosCOP += saldo;
              idBaCOP = caja.id;
            } else {
              locEfectivoCOP += saldo;
              idEfCOP = caja.id;
            }
          }

          listaCajasRender.push({
            titulo: caja.nombre,
            montoUSD: caja.moneda === "USD" ? saldo : 0,
            montoCOP: caja.moneda === "COP" ? saldo : 0,
            tipo: "caja",
          });
        });

        setIdsCajas({
          efectivoUSDId: idEfUSD,
          efectivoCOPId: idEfCOP,
          bancosUSDId: idBaUSD,
          bancosCOPId: idBaCOP,
        });

        // Actualizar valores para los inputs del modal
        setEditEfectivoUSD(locEfectivoUSD.toString());
        setEditEfectivoCOP(locEfectivoCOP.toString());
        setEditBancosUSD(locBancosUSD.toString());
        setEditBancosCOP(locBancosCOP.toString());
      }

      const { data: prestamosData, error: prestamosError } = await supabase
        .from("prestamos")
        .select("saldo_pendiente, estado, moneda");

      let sumaCalleUSD = 0;
      let sumaCalleCOP = 0;

      if (!prestamosError && prestamosData) {
        prestamosData.forEach((curr) => {
          const saldoPendiente = Number(curr.saldo_pendiente || 0);
          const moneda = curr.moneda?.toUpperCase();

          if (curr.estado === "activo") {
            if (moneda === "USD") {
              sumaCalleUSD += saldoPendiente;
            } else if (moneda === "COP") {
              sumaCalleCOP += saldoPendiente;
            }
          }
        });
      }

      const { data: vistaData, error: vistaError } = await supabase
        .from("vista_ganancias_totales")
        .select("moneda, gastos, ganancia_neta");

      let sumaGastosUSD = 0;
      let sumaGastosCOP = 0;
      let netaUSD = 0;
      let netaCOP = 0;

      if (!vistaError && vistaData) {
        vistaData.forEach((row: any) => {
          const moneda = row.moneda?.toUpperCase();
          const gastos = Number(row.gastos || 0);
          const gananciaNeta = Number(row.ganancia_neta || 0);

          if (moneda === "USD") {
            sumaGastosUSD += gastos;
            netaUSD += gananciaNeta;
          } else if (moneda === "COP") {
            sumaGastosCOP += gastos;
            netaCOP += gananciaNeta;
          }
        });
      }

      setTotalesPDF({
        efectivoUSD: locEfectivoUSD,
        efectivoCOP: locEfectivoCOP,
        bancosUSD: locBancosUSD,
        bancosCOP: locBancosCOP,
        calleUSD: sumaCalleUSD,
        calleCOP: sumaCalleCOP,
        gastosUSD: Math.max(0, sumaGastosUSD),
        gastosCOP: Math.max(0, sumaGastosCOP),
        gananciaUSD: Math.max(0, netaUSD),
        gananciaCOP: Math.max(0, netaCOP),
      });

      const consolidado: ResumenFinanciero[] = [
        ...listaCajasRender,
        {
          titulo: "Dinero en la Calle",
          montoUSD: sumaCalleUSD,
          montoCOP: 0,
          tipo: "calle",
        },
        {
          titulo: "Dinero en la Calle",
          montoUSD: 0,
          montoCOP: sumaCalleCOP,
          tipo: "calle",
        },
        {
          titulo: "Total Gastos",
          montoUSD: Math.max(0, sumaGastosUSD),
          montoCOP: 0,
          tipo: "gastos",
        },
        {
          titulo: "Total Gastos",
          montoUSD: 0,
          montoCOP: Math.max(0, sumaGastosCOP),
          tipo: "gastos",
        },
        {
          titulo: "Ganancia",
          montoUSD: Math.max(0, netaUSD),
          montoCOP: 0,
          tipo: "ganancia",
        },
        {
          titulo: "Ganancia",
          montoUSD: 0,
          montoCOP: Math.max(0, netaCOP),
          tipo: "ganancia",
        },
      ];

      setResumenData(consolidado);
    } catch (error) {
      console.error("Error al cargar datos de caja:", error);
    }
  };

  const handleGuardarCambiosCajas = async () => {
    try {
      setGuardandoEdicion(true);

      const actualizaciones = [];

      if (idsCajas.efectivoUSDId) {
        actualizaciones.push(
          supabase
            .from("cajas_bancos")
            .update({ saldo_actual: parseFloat(editEfectivoUSD) || 0 })
            .eq("id", idsCajas.efectivoUSDId),
        );
      }
      if (idsCajas.efectivoCOPId) {
        actualizaciones.push(
          supabase
            .from("cajas_bancos")
            .update({ saldo_actual: parseFloat(editEfectivoCOP) || 0 })
            .eq("id", idsCajas.efectivoCOPId),
        );
      }
      if (idsCajas.bancosUSDId) {
        actualizaciones.push(
          supabase
            .from("cajas_bancos")
            .update({ saldo_actual: parseFloat(editBancosUSD) || 0 })
            .eq("id", idsCajas.bancosUSDId),
        );
      }
      if (idsCajas.bancosCOPId) {
        actualizaciones.push(
          supabase
            .from("cajas_bancos")
            .update({ saldo_actual: parseFloat(editBancosCOP) || 0 })
            .eq("id", idsCajas.bancosCOPId),
        );
      }

      await Promise.all(actualizaciones);

      Alert.alert(
        "Éxito",
        "Saldos de caja y bancos actualizados correctamente.",
      );
      setModalEditarVisible(false);
      await cargarDatosCaja();
    } catch (error) {
      console.error("Error al actualizar cajas y bancos:", error);
      Alert.alert("Error", "No se pudieron actualizar los saldos.");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarDatosCaja();
    setRefreshing(false);
  };

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
              th { background-color: #0f172a; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 11px; }
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
                  <td>$${totalesPDF.efectivoUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.efectivoCOP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.bancosUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.bancosCOP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.calleUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.calleCOP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.gastosUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.gastosCOP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.gananciaUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>$${totalesPDF.gananciaCOP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
            "Permita las ventanas emergentes para descargar el PDF.",
          );
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF.");
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
          colors={["#6366f1"]}
        />
      }
    >
      <View
        style={[styles.topHeaderRow, isMobile && styles.topHeaderRowMobile]}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Control de Caja y Bancos</Text>
          <Text style={styles.subtitle}>
            Balance general, efectivo, bancos, gastos y ganancia en tiempo real
          </Text>
        </View>

        {/* Botones de acción alineados */}
        <View style={styles.headerButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.editCajaButton,
              isMobile && styles.editCajaButtonMobile,
            ]}
            onPress={() => setModalEditarVisible(true)}
          >
            <Text style={styles.editCajaButtonText}>✏️ Caja/Banco</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pdfButton, isMobile && styles.pdfButtonMobile]}
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
      </View>

      <View style={styles.gridContainer}>
        {resumenData.map((item, index) => {
          const esUSD =
            item.montoUSD > 0 ||
            (item.montoUSD === 0 && item.montoCOP === 0 && index % 2 === 0);
          const moneda = esUSD ? "USD" : "COP";
          const monto = esUSD ? item.montoUSD : item.montoCOP;

          let cardStyle = styles.cardCaja;
          let titleStyle = styles.cardTitle;
          let valueStyle = styles.cardValue;
          let badgeStyle = styles.monedaBadge;

          if (item.tipo === "calle") {
            cardStyle = styles.cardCalle;
            titleStyle = styles.cardTitleCalle;
            valueStyle = styles.cardValueCalle;
            badgeStyle = styles.monedaBadgeCalle;
          } else if (item.tipo === "gastos") {
            cardStyle = styles.cardGastos;
            titleStyle = styles.cardTitleGastos;
            valueStyle = styles.cardValueGastos;
            badgeStyle = styles.monedaBadgeGastos;
          } else if (item.tipo === "ganancia") {
            cardStyle = styles.cardGanancia;
            titleStyle = styles.cardTitleGanancia;
            valueStyle = styles.cardValueGanancia;
            badgeStyle = styles.monedaBadgeGanancia;
          }

          return (
            <View
              key={index}
              style={[
                styles.card,
                cardStyle,
                { width: isMobile ? "100%" : "48.5%" },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={titleStyle}>{item.titulo}</Text>
                <Text style={badgeStyle}>{moneda}</Text>
              </View>
              <Text style={valueStyle}>
                {moneda === "USD" ? "$" : "$ "}
                {Math.max(0, monto).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Modal para Editar Caja/Banco */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalEditarVisible}
        onRequestClose={() => setModalEditarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, isMobile && styles.modalContentMobile]}
          >
            <Text style={styles.modalTitle}>
              Editar Saldos de Caja y Bancos
            </Text>
            <Text style={styles.modalSubtitle}>
              Modifique directamente los valores de efectivo y bancos en la base
              de datos.
            </Text>

            <Text style={styles.inputLabel}>Efectivo USD</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editEfectivoUSD}
              onChangeText={setEditEfectivoUSD}
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>Efectivo COP</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editEfectivoCOP}
              onChangeText={setEditEfectivoCOP}
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>Bancos / Transferencia USD</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editBancosUSD}
              onChangeText={setEditBancosUSD}
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>Bancos / Transferencia COP</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editBancosCOP}
              onChangeText={setEditBancosCOP}
              placeholder="0.00"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalEditarVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleGuardarCambiosCajas}
                disabled={guardandoEdicion}
              >
                {guardandoEdicion ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 16, paddingBottom: 50 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 12,
  },
  topHeaderRowMobile: { flexDirection: "column", alignItems: "stretch" } as any,
  headerContainer: { flex: 1 },
  headerButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  editCajaButton: {
    backgroundColor: "#11135f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101141",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editCajaButtonMobile: { alignSelf: "flex-end" },
  editCajaButtonText: { color: "#ffffff", fontWeight: "bold", fontSize: 14 },
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
  },
  pdfButtonMobile: { alignSelf: "flex-end" },
  pdfButtonText: { color: "#ffffff", fontWeight: "bold", fontSize: 14 },
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
  cardCaja: { borderLeftWidth: 4, borderLeftColor: "#6366f1" },
  cardCalle: { borderLeftWidth: 4, borderLeftColor: "#0ea5e9" },
  cardGastos: { borderLeftWidth: 4, borderLeftColor: "#ef4444" },
  cardGanancia: { borderLeftWidth: 4, borderLeftColor: "#10b981" },
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
  cardValue: { fontSize: 26, fontWeight: "bold", color: "#1e293b" },
  cardValueCalle: { fontSize: 26, fontWeight: "bold", color: "#0284c7" },
  cardValueGastos: { fontSize: 26, fontWeight: "bold", color: "#dc2626" },
  cardValueGanancia: { fontSize: 26, fontWeight: "bold", color: "#059669" },
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
  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 450,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalContentMobile: { width: "100%" },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 14,
    backgroundColor: "#f8fafc",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  cancelButtonText: { color: "#334155", fontWeight: "600", fontSize: 14 },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  saveButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
});
