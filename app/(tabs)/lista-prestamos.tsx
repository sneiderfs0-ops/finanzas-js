import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";

export default function ListaPrestamosScreen() {
  const { width } = useWindowDimensions();
  const esPantallaPequena = width < 768;

  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const obtenerNombreRegistrador = async (cedula: string) => {
    if (!cedula) return "Sin asignar";

    try {
      const { data: emp } = await supabase
        .from("empleados")
        .select("nombres, apellidos")
        .eq("cedula", cedula)
        .maybeSingle();
      if (emp) return `${emp.nombres} ${emp.apellidos}`;

      const { data: sec } = await supabase
        .from("secretaria")
        .select("nombres, apellidos")
        .eq("cedula", cedula)
        .maybeSingle();
      if (sec) return `${sec.nombres} ${sec.apellidos}`;

      const { data: adm } = await supabase
        .from("administradores")
        .select("nombres, apellidos")
        .eq("cedula", cedula)
        .maybeSingle();
      if (adm) return `${adm.nombres} ${adm.apellidos}`;
    } catch (e) {
      console.log("Error buscando registrador:", e);
    }
    return "Personal Autorizado";
  };

  const cargarPrestamos = async () => {
    setLoading(true);
    try {
      const { data: prestamosData, error: prestamoError } = await supabase
        .from("prestamos")
        .select("*")
        .order("fecha_prestamo", { ascending: false });

      if (prestamoError) throw prestamoError;

      if (prestamosData) {
        const prestamosProcesados = await Promise.all(
          prestamosData.map(async (p) => {
            let clienteInfo = {
              nombres: "Cliente",
              apellidos: "Desconocido",
              cedula: p.cedula || "N/A",
            };
            if (p.cedula) {
              const { data: cliData } = await supabase
                .from("clientes")
                .select("nombres, apellidos, cedula")
                .eq("cedula", p.cedula)
                .maybeSingle();
              if (cliData) clienteInfo = cliData;
            }

            const { data: pagosData } = await supabase
              .from("pagos")
              .select("monto_pagado")
              .eq("prestamo_id", p.id);

            const totalPagado = pagosData
              ? pagosData.reduce(
                  (sum: number, pago: any) =>
                    sum + Number(pago.monto_pagado || 0),
                  0,
                )
              : 0;

            const montoTotal = Number(p.monto_total) || 0;
            const saldoPendienteCalculado = montoTotal - totalPagado;
            const empleadoNombre = await obtenerNombreRegistrador(
              p.registrado_por_cedula,
            );

            let estadoCalculado = "activo";
            if (saldoPendienteCalculado <= 0) {
              estadoCalculado = "pagado";
            } else if (p.estado === "atrasado") {
              estadoCalculado = "atrasado";
            }

            return {
              ...p,
              clientes: clienteInfo,
              totalPagado,
              saldo_pendiente: saldoPendienteCalculado,
              estadoTexto: estadoCalculado,
              empleadoNombre,
            };
          }),
        );

        setPrestamos(prestamosProcesados);
      }
    } catch (err: any) {
      console.log("Error cargando préstamos:", err.message);
      Alert.alert("Error", "No se pudieron cargar los préstamos.");
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalles = async (item: any) => {
    setPrestamoSeleccionado(item);
    setModalVisible(true);
    setCargandoPagos(true);

    try {
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("prestamo_id", item.id)
        .order("fecha_pago", { ascending: false });

      if (error) throw error;
      setPagosPrestamo(data || []);
    } catch (err: any) {
      console.log("Error al cargar pagos del préstamo:", err.message);
      setPagosPrestamo([]);
    } finally {
      setCargandoPagos(false);
    }
  };

  const prestamosFiltrados = prestamos.filter((item) => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;

    const nombres = (item.clientes?.nombres || "").toLowerCase();
    const apellidos = (item.clientes?.apellidos || "").toLowerCase();
    const nombreCompleto = `${nombres} ${apellidos}`;
    const montoPrestado = String(item.monto_prestado || "").toLowerCase();
    const montoTotal = String(item.monto_total || "").toLowerCase();

    return (
      nombres.includes(texto) ||
      apellidos.includes(texto) ||
      nombreCompleto.includes(texto) ||
      montoPrestado.includes(texto) ||
      montoTotal.includes(texto)
    );
  });

  const exportarExcelTablaGeneral = () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

    if (Platform.OS === "web") {
      let csvContent =
        "data:text/csv;charset=utf-8,\uFEFFFecha;Cliente;Monto Prestado;Moneda;Porcentaje;Total a Pagar;Saldo Pendiente;Cuotas;Frecuencia;Registrado por;Estado\r\n";

      prestamosFiltrados.forEach((item) => {
        const fecha = item.fecha_prestamo
          ? `"${new Date(item.fecha_prestamo.replace("Z", "")).toLocaleDateString()}"`
          : '"N/A"';
        const cliente = item.clientes
          ? `"${item.clientes.nombres} ${item.clientes.apellidos}"`
          : '"Desconocido"';
        const montoPrestado = Number(
          item.monto_prestado || item.monto_total || 0,
        ).toFixed(2);
        const moneda = `"${item.moneda || "COP"}"`;
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagar = Number(item.monto_total || 0).toFixed(2);
        const saldoPendiente = Number(item.saldo_pendiente || 0).toFixed(2);
        const cuotas = item.cuotas || 0;
        const frecuencia = `"${item.frecuencia || "N/A"}"`;
        const empleado = `"${item.empleadoNombre}"`;
        const estado = `"${item.estadoTexto.toUpperCase()}"`;

        csvContent += `${fecha};${cliente};${montoPrestado};${moneda};${porcentaje};${totalPagar};${saldoPendiente};${cuotas};${frecuencia};${empleado};${estado}\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `reporte_prestamos_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert(
        "Aviso",
        "La exportación a Excel está optimizada para la versión web.",
      );
    }
  };

  const exportarPDFTablaGeneral = () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

    if (Platform.OS === "web") {
      let ventanaImpresion = window.open("", "_blank");
      if (!ventanaImpresion) {
        Alert.alert(
          "Error",
          "Permite las ventanas emergentes para generar el PDF.",
        );
        return;
      }

      let html = `
        <html>
          <head>
            <title>Reporte General de Préstamos</title>
            <style>
              @page { size: landscape; margin: 10mm; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background-color: #ffffff; }
              h2 { text-align: center; color: #0f172a; margin-bottom: 5px; font-size: 24px; font-weight: 700; }
              p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 11px; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
            <h2>Gestión y Detalles de Préstamos</h2>
            <p class="subtitle">Reporte generado el ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th class="text-right">Monto Prestado</th>
                  <th>Moneda</th>
                  <th>Porcentaje</th>
                  <th class="text-right">Total a Pagar</th>
                  <th class="text-right">Saldo Pendiente</th>
                  <th>Registrado por</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
      `;

      prestamosFiltrados.forEach((item) => {
        const fecha = item.fecha_prestamo
          ? new Date(item.fecha_prestamo.replace("Z", "")).toLocaleDateString()
          : "N/A";
        const cliente = item.clientes
          ? `${item.clientes.nombres} ${item.clientes.apellidos}`
          : "Desconocido";
        const montoPrestadoNum = Number(item.monto_prestado || 0).toFixed(2);
        const moneda = item.moneda || "COP";
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagarNum = Number(item.monto_total || 0).toFixed(2);
        const saldoPendienteNum = Number(item.saldo_pendiente || 0).toFixed(2);
        const empleado = item.empleadoNombre;
        const estado = item.estadoTexto.toUpperCase();

        html += `
          <tr>
            <td>${fecha}</td>
            <td><strong>${cliente}</strong></td>
            <td class="text-right">${montoPrestadoNum}</td>
            <td><strong>${moneda}</strong></td>
            <td>${porcentaje}</td>
            <td class="text-right">${totalPagarNum}</td>
            <td class="text-right"><strong>${saldoPendienteNum}</strong></td>
            <td>${empleado}</td>
            <td>${estado}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </body>
        </html>
      `;

      ventanaImpresion.document.write(html);
      ventanaImpresion.document.close();
      ventanaImpresion.focus();
      setTimeout(() => {
        ventanaImpresion.print();
      }, 500);
    } else {
      Alert.alert(
        "Aviso",
        "La exportación a PDF está optimizada para la versión web.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerTitleRow,
          { flexDirection: esPantallaPequena ? "column" : "row" },
        ]}
      >
        <Text style={styles.title}>Gestión y Detalles de Préstamos</Text>
        <View style={styles.globalExportRow}>
          <TouchableOpacity
            style={styles.btnGlobalExcel}
            onPress={exportarExcelTablaGeneral}
          >
            <Text style={styles.btnExportText}>📥 Descargar Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGlobalPdf}
            onPress={exportarPDFTablaGeneral}
          >
            <Text style={styles.btnExportText}>📥 Descargar PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersWrapper}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombres, apellidos o monto del préstamo..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity
              style={styles.btnLimpiar}
              onPress={() => setBusqueda("")}
            >
              <Text style={styles.btnLimpiarText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ marginTop: 10 }}>Cargando préstamos...</Text>
        </View>
      ) : (
        <View style={styles.tableFullContainer}>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            <ScrollView
              showsVerticalScrollIndicator={true}
              style={{ width: "100%" }}
            >
              <View style={styles.tableInnerWrapper}>
                <View style={[styles.gridRow, styles.gridHeader]}>
                  <View style={[styles.gridCell, styles.colFecha]}>
                    <Text style={styles.headerText}>Fecha</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colCliente]}>
                    <Text style={styles.headerText}>Cliente</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colMonto]}>
                    <Text style={styles.headerText}>Monto Prestado</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colMoneda]}>
                    <Text style={styles.headerText}>Moneda</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colPorcentaje]}>
                    <Text style={styles.headerText}>Porcentaje</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colTotal]}>
                    <Text style={styles.headerText}>Total a Pagar</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colTotal]}>
                    <Text style={styles.headerText}>Saldo Pendiente</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colEmpleado]}>
                    <Text style={styles.headerText}>Registrado por</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colAccion]}>
                    <Text style={styles.headerText}>Estado / Acción</Text>
                  </View>
                </View>

                {prestamosFiltrados.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No se encontraron préstamos registrados.
                  </Text>
                ) : (
                  prestamosFiltrados.map((item, index) => {
                    const nombreCliente = `${item.clientes.nombres} ${item.clientes.apellidos}`;
                    const fechaFormateada = item.fecha_prestamo
                      ? new Date(
                          item.fecha_prestamo.replace("Z", ""),
                        ).toLocaleDateString()
                      : "N/A";

                    const estado = item.estadoTexto;
                    let badgeBg = "#eff6ff";
                    let badgeColor = "#2563eb";
                    if (estado === "pagado") {
                      badgeBg = "#f0fdf4";
                      badgeColor = "#16a34a";
                    } else if (estado === "atrasado") {
                      badgeBg = "#fef2f2";
                      badgeColor = "#dc2626";
                    }

                    return (
                      <View
                        key={item.id || index}
                        style={[
                          styles.gridRow,
                          index % 2 === 1 ? styles.rowAlternate : null,
                        ]}
                      >
                        <View style={[styles.gridCell, styles.colFecha]}>
                          <Text style={styles.cellText}>{fechaFormateada}</Text>
                        </View>
                        <View style={[styles.gridCell, styles.colCliente]}>
                          <Text style={styles.cellTextBold} numberOfLines={1}>
                            {nombreCliente}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colMonto]}>
                          <Text style={styles.cellText}>
                            {Number(item.monto_prestado || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colMoneda]}>
                          <View style={styles.badgeMoneda}>
                            <Text style={styles.badgeMonedaText}>
                              {item.moneda || "COP"}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.gridCell, styles.colPorcentaje]}>
                          <Text style={styles.cellText}>
                            {item.tasa_interes}%
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colTotal]}>
                          <Text style={styles.cellTextBold}>
                            {Number(item.monto_total || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colTotal]}>
                          <Text
                            style={[styles.cellTextBold, { color: "#dc2626" }]}
                          >
                            {Number(item.saldo_pendiente || 0).toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colEmpleado]}>
                          <Text style={styles.cellText} numberOfLines={1}>
                            {item.empleadoNombre}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colAccion]}>
                          <View
                            style={[
                              styles.badgeEstado,
                              { backgroundColor: badgeBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeTextEstado,
                                { color: badgeColor },
                              ]}
                            >
                              {estado.toUpperCase()}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.btnVerAccion}
                            onPress={() => abrirDetalles(item)}
                          >
                            <Text style={styles.btnVerAccionText}>
                              Detalles
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
                <View style={{ height: 60 }} />
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      )}

      {/* MODAL CON TIPO DE OPERACIÓN Y USUARIO QUE HIZO LA VENTA */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Detalles del Préstamo</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeIconBtn}
              >
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {prestamoSeleccionado && (
              <ScrollView
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
              >
                {/* ETIQUETA DE TIPO DE OPERACIÓN */}
                <View
                  style={[
                    styles.modalRowItem,
                    {
                      backgroundColor: "#f1f5f9",
                      padding: 8,
                      borderRadius: 6,
                      marginBottom: 10,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: "bold", color: "#1e293b" }}>
                    Tipo de Operación:
                  </Text>
                  <Text style={{ fontWeight: "bold", color: "#4f46e5" }}>
                    VENTA A CRÉDITO
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Cliente:</Text>
                  <Text style={styles.modalValueBold}>
                    {prestamoSeleccionado.clientes?.nombres}{" "}
                    {prestamoSeleccionado.clientes?.apellidos}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Fecha de Préstamo:</Text>
                  <Text style={styles.modalValue}>
                    {prestamoSeleccionado.fecha_prestamo
                      ? new Date(
                          prestamoSeleccionado.fecha_prestamo.replace("Z", ""),
                        ).toLocaleDateString()
                      : "N/A"}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Monto Prestado:</Text>
                  <Text style={styles.modalValue}>
                    {Number(prestamoSeleccionado.monto_prestado || 0).toFixed(
                      2,
                    )}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Moneda:</Text>
                  <Text style={styles.modalValue}>
                    {prestamoSeleccionado.moneda || "COP"}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Total a Pagar:</Text>
                  <Text style={styles.modalValue}>
                    {Number(prestamoSeleccionado.monto_total || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Saldo Pendiente:</Text>
                  <Text
                    style={[
                      styles.modalValue,
                      { color: "#dc2626", fontWeight: "bold" },
                    ]}
                  >
                    {Number(prestamoSeleccionado.saldo_pendiente || 0).toFixed(
                      2,
                    )}
                  </Text>
                </View>

                {/* NOMBRE DEL USUARIO QUE HIZO LA VENTA */}
                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Registrado Por:</Text>
                  <Text
                    style={[
                      styles.modalValue,
                      { fontWeight: "bold", color: "#0f172a" },
                    ]}
                  >
                    {prestamoSeleccionado.empleadoNombre}
                  </Text>
                </View>

                <View style={styles.modalRowItem}>
                  <Text style={styles.modalLabel}>Estado:</Text>
                  <Text
                    style={[
                      styles.modalValue,
                      {
                        fontWeight: "bold",
                        color:
                          prestamoSeleccionado.estadoTexto === "pagado"
                            ? "#16a34a"
                            : "#2563eb",
                      },
                    ]}
                  >
                    {prestamoSeleccionado.estadoTexto.toUpperCase()}
                  </Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.btnCloseModal}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.btnCloseModalText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerTitleRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#0f172a" },
  globalExportRow: { flexDirection: "row", gap: 10 },
  btnGlobalExcel: {
    backgroundColor: "#10b981",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  btnGlobalPdf: {
    backgroundColor: "#ef4444",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  btnExportText: { color: "#fff", fontWeight: "600" },
  filtersWrapper: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  btnLimpiar: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnLimpiarText: { color: "#334155", fontWeight: "600" },
  tableFullContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === "web"
      ? { width: "100%", display: "flex", flex: 1 }
      : {}),
  },
  horizontalScrollContent: {
    minWidth: 1250,
    flexGrow: 1,
  },
  tableInnerWrapper: {
    flexDirection: "column",
    width: "100%",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
    minHeight: 50,
  },
  gridHeader: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    minHeight: 48,
  },
  rowAlternate: { backgroundColor: "#f8fafc" },
  gridCell: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  headerText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
  },
  cellTextBold: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 13,
  },
  colFecha: { width: 110 },
  colCliente: { flex: 1, minWidth: 180 },
  colMonto: { width: 140 },
  colMoneda: { width: 90 },
  colPorcentaje: { width: 130 },
  colTotal: { width: 130 },
  colEmpleado: { width: 140 },
  colAccion: { width: 180, flexDirection: "row", alignItems: "center", gap: 8 },
  badgeMoneda: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeMonedaText: { fontSize: 10, fontWeight: "bold", color: "#334155" },
  badgeEstado: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTextEstado: { fontSize: 10, fontWeight: "bold" },
  btnVerAccion: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnVerAccionText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 20, color: "#64748b" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    width: "100%",
    maxWidth: 500,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  closeIconBtn: { padding: 4 },
  closeIconText: { fontSize: 16, fontWeight: "bold", color: "#64748b" },
  modalRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalLabel: { fontSize: 13, color: "#64748b" },
  modalValue: { fontSize: 13, color: "#1e293b" },
  modalValueBold: { fontSize: 13, fontWeight: "bold", color: "#0f172a" },
  subTitleModal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  pagoItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  pagoTextFecha: { fontSize: 12, color: "#334155" },
  pagoTextMonto: { fontSize: 12, fontWeight: "bold", color: "#16a34a" },
  pagoTextMetodo: { fontSize: 12, color: "#64748b" },
  btnCloseModal: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 15,
  },
  btnCloseModalText: { color: "#fff", fontWeight: "bold" },
});
