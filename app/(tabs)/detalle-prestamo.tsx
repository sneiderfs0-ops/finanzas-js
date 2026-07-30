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
  Platform,
} from "react-native";
import { supabase } from "../../supabase";

export default function ListaPrestamosScreen() {
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscador de cliente (nombres, apellidos o cédula)
  const [busqueda, setBusqueda] = useState("");

  // Filtros por fecha (formato YYYY-MM-DD)
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Modal para ver detalles y pagos acumulados
  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const cargarPrestamos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("prestamos")
        .select(
          `
          *,
          clientes (
            cedula,
            nombres,
            apellidos
          ),
          pagos (
            prestamo_id,
            monto_pagado,
            fecha_pago,
            registrado_por_cedula
          )
        `,
        )
        .order("fecha_prestamo", { ascending: false });

      if (fechaInicio) {
        query = query.gte("fecha_prestamo", `${fechaInicio}T00:00:00`);
      }
      if (fechaFin) {
        query = query.lte("fecha_prestamo", `${fechaFin}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const prestamosProcesados = await Promise.all(
          data.map(async (p) => {
            const totalPagado = p.pagos
              ? p.pagos.reduce(
                  (sum: number, pago: any) =>
                    sum + Number(pago.monto_pagado || 0),
                  0,
                )
              : 0;

            const montoTotal = Number(p.monto_total) || 0;
            const saldoPendienteCalculado =
              Number(p.saldo_pendiente) ?? montoTotal - totalPagado;

            let estadoTexto = p.estado || "activo";
            if (totalPagado >= montoTotal) {
              estadoTexto = "pagado";
            } else if (estadoTexto === "atrasado") {
              estadoTexto = "en mora";
            } else if (estadoTexto === "activo") {
              estadoTexto = "activo pagando";
            }

            let empleadoNombre = "Administrador";

            return {
              ...p,
              totalPagado,
              saldo_pendiente: saldoPendienteCalculado,
              estadoTexto,
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
        .select("prestamo_id, monto_pagado, fecha_pago, registrado_por_cedula")
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

  const exportarExcelTablaGeneral = () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

    if (Platform.OS === "web") {
      let csvContent =
        "data:text/csv;charset=utf-8,Fecha,Cliente,Cedula,Monto Prestado,Porcentaje,Total a Pagar,Registrado por,Estado\r\n";

      prestamosFiltrados.forEach((item) => {
        const fecha = item.fecha_prestamo
          ? new Date(item.fecha_prestamo.replace("Z", "")).toLocaleDateString()
          : "N/A";
        const cliente = item.clientes
          ? `"${item.clientes.nombres} ${item.clientes.apellidos}"`
          : "Desconocido";
        const cedula = item.cliente_cedula || "";
        const monto = item.monto_total || 0;
        const porcentaje = item.tasa_interes || 0;
        const totalPagar = item.monto_total || 0;
        const empleado = `"${item.empleadoNombre}"`;
        const estado = item.estadoTexto.toUpperCase();

        csvContent += `${fecha},${cliente},${cedula},${monto},${porcentaje},${totalPagar},${empleado},${estado}\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "reporte_prestamos.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h2 { text-align: center; color: #2f3640; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th, td { border: 1px solid #dcdde1; padding: 8px; text-align: left; }
              th { background-color: #f1f2f6; color: #2f3640; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
            <h2>Gestión de Préstamos - Reporte General</h2>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th>Monto Prestado</th>
                  <th>Porcentaje</th>
                  <th>Total a Pagar</th>
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
        const cedula = item.cliente_cedula || "";
        const monto = Number(item.monto_total || 0).toFixed(2);
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagar = Number(item.monto_total || 0).toFixed(2);
        const empleado = item.empleadoNombre;
        const estado = item.estadoTexto.toUpperCase();

        html += `
          <tr>
            <td>${fecha}</td>
            <td>${cliente}</td>
            <td>${cedula}</td>
            <td class="text-right">$${monto}</td>
            <td>${porcentaje}</td>
            <td class="text-right">$${totalPagar}</td>
            <td>${empleado}</td>
            <td><b>${estado}</b></td>
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
    }
  };

  const prestamosFiltrados = prestamos.filter((item) => {
    if (!busqueda.trim()) return true;
    const texto = busqueda.toLowerCase();
    const cedula = (item.cliente_cedula || "").toLowerCase();
    const nombres = (item.clientes?.nombres || "").toLowerCase();
    const apellidos = (item.clientes?.apellidos || "").toLowerCase();
    const nombreCompleto = `${nombres} ${apellidos}`;

    return (
      cedula.includes(texto) ||
      nombres.includes(texto) ||
      apellidos.includes(texto) ||
      nombreCompleto.includes(texto)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>Gestión de Préstamos</Text>
        <View style={styles.globalExportRow}>
          <TouchableOpacity
            style={styles.btnGlobalExcel}
            onPress={exportarExcelTablaGeneral}
          >
            <Text style={styles.btnExportText}>Descargar Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGlobalPdf}
            onPress={exportarPDFTablaGeneral}
          >
            <Text style={styles.btnExportText}>Descargar PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buscador y Filtros */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cédula, nombres o apellidos..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor="#aaa"
        />
      </View>

      <View style={styles.filtroContainer}>
        <Text style={styles.filtroLabel}>Filtrar por Fecha (AAAA-MM-DD):</Text>
        <View style={styles.inputsFechaRow}>
          <TextInput
            style={styles.inputFecha}
            placeholder="Desde (Ej: 2026-01-01)"
            value={fechaInicio}
            onChangeText={setFechaInicio}
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={styles.inputFecha}
            placeholder="Hasta (Ej: 2026-12-31)"
            value={fechaFin}
            onChangeText={setFechaFin}
            placeholderTextColor="#aaa"
          />
        </View>
        <View style={styles.botonesFiltroRow}>
          <TouchableOpacity style={styles.btnFiltrar} onPress={cargarPrestamos}>
            <Text style={styles.btnFiltrarText}>Aplicar Filtro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnLimpiar}
            onPress={() => {
              setFechaInicio("");
              setFechaFin("");
              cargarPrestamos();
            }}
          >
            <Text style={styles.btnLimpiarText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenedor principal de la tabla al 100% de la web */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#0984e3"
          style={{ marginTop: 20 }}
        />
      ) : (
        <View style={styles.tableFullContainer}>
          <ScrollView
            showsVerticalScrollIndicator={true}
            style={{ width: "100%" }}
          >
            <View style={styles.tableInnerWrapper}>
              {/* Cabecera de la Tabla */}
              <View style={[styles.gridRow, styles.gridHeader]}>
                <View style={[styles.gridCell, styles.colFecha]}>
                  <Text style={styles.headerText}>Fecha</Text>
                </View>
                <View style={[styles.gridCell, styles.colCliente]}>
                  <Text style={styles.headerText}>Cliente / Cédula</Text>
                </View>
                <View style={[styles.gridCell, styles.colMonto]}>
                  <Text style={styles.headerText}>Monto Prestado</Text>
                </View>
                <View style={[styles.gridCell, styles.colPorcentaje]}>
                  <Text style={styles.headerText}>Porcentaje</Text>
                </View>
                <View style={[styles.gridCell, styles.colTotal]}>
                  <Text style={styles.headerText}>Total a Pagar</Text>
                </View>
                <View style={[styles.gridCell, styles.colEmpleado]}>
                  <Text style={styles.headerText}>Registrado por</Text>
                </View>
                <View style={[styles.gridCell, styles.colAccion]}>
                  <Text style={styles.headerText}>Estado / Acción</Text>
                </View>
              </View>

              {/* Filas Dinámicas mapeadas de forma robusta para web */}
              {prestamosFiltrados.length === 0 ? (
                <Text style={styles.emptyText}>
                  No se encontraron préstamos registrados.
                </Text>
              ) : (
                prestamosFiltrados.map((item, index) => {
                  const nombreCliente = item.clientes
                    ? `${item.clientes.nombres} ${item.clientes.apellidos}`
                    : "Cliente desconocido";

                  const fechaFormateada = item.fecha_prestamo
                    ? new Date(
                        item.fecha_prestamo.replace("Z", ""),
                      ).toLocaleDateString()
                    : "N/A";

                  const estado = item.estadoTexto || "activo pagando";
                  let badgeColor = "#0984e3";
                  if (estado === "pagado") badgeColor = "#2ed573";
                  if (estado === "en mora") badgeColor = "#e74c3c";

                  return (
                    <View
                      key={item.id?.toString() || index}
                      style={styles.gridRow}
                    >
                      <View style={[styles.gridCell, styles.colFecha]}>
                        <Text style={styles.cellText}>{fechaFormateada}</Text>
                      </View>
                      <View style={[styles.gridCell, styles.colCliente]}>
                        <Text style={styles.cellTextBold} numberOfLines={1}>
                          {nombreCliente}
                        </Text>
                        <Text style={styles.subCedula}>
                          {item.cliente_cedula}
                        </Text>
                      </View>
                      <View style={[styles.gridCell, styles.colMonto]}>
                        <Text style={styles.cellText}>
                          ${Number(item.monto_total).toFixed(2)}
                        </Text>
                      </View>
                      <View style={[styles.gridCell, styles.colPorcentaje]}>
                        <Text style={styles.cellText}>
                          {item.tasa_interes}%
                        </Text>
                      </View>
                      <View style={[styles.gridCell, styles.colTotal]}>
                        <Text style={styles.cellTextBold}>
                          ${Number(item.monto_total).toFixed(2)}
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
                            { backgroundColor: badgeColor },
                          ]}
                        >
                          <Text style={styles.badgeTextEstado}>
                            {estado.toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.btnVerAccion}
                          onPress={() => abrirDetalles(item)}
                        >
                          <Text style={styles.btnVerAccionText}>Detalles</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              <View style={{ height: 60 }} />
            </View>
          </ScrollView>
        </View>
      )}

      {/* Modal de Detalles */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Detalles del Préstamo</Text>

              {prestamoSeleccionado && (
                <>
                  <Text style={styles.modalLabel}>
                    Cliente:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.clientes
                        ? `${prestamoSeleccionado.clientes.nombres} ${prestamoSeleccionado.clientes.apellidos}`
                        : prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Cédula:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Registrado por:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.empleadoNombre}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Tasa de Interés:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.tasa_interes}%
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Monto Total:{" "}
                    <Text style={styles.modalValue}>
                      ${Number(prestamoSeleccionado.monto_total).toFixed(2)}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Total Pagado:{" "}
                    <Text style={[styles.modalValue, { color: "#2ed573" }]}>
                      ${prestamoSeleccionado.totalPagado.toFixed(2)}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Saldo Pendiente:{" "}
                    <Text style={[styles.modalValue, { color: "#e74c3c" }]}>
                      ${prestamoSeleccionado.saldo_pendiente.toFixed(2)}
                    </Text>
                  </Text>

                  <Text style={styles.subtituloPagos}>
                    Historial de Abonos:
                  </Text>

                  {cargandoPagos ? (
                    <ActivityIndicator size="small" color="#0984e3" />
                  ) : pagosPrestamo.length === 0 ? (
                    <Text style={styles.sinPagosText}>
                      No hay pagos registrados aún.
                    </Text>
                  ) : (
                    <View style={styles.tablaContainerModal}>
                      <View
                        style={[styles.tablaFilaModal, styles.tablaHeaderModal]}
                      >
                        <Text
                          style={[
                            styles.tablaCeldaModal,
                            styles.tablaHeaderTextoModal,
                            { flex: 1 },
                          ]}
                        >
                          Monto
                        </Text>
                        <Text
                          style={[
                            styles.tablaCeldaModal,
                            styles.tablaHeaderTextoModal,
                            { flex: 1.5 },
                          ]}
                        >
                          Fecha
                        </Text>
                        <Text
                          style={[
                            styles.tablaCeldaModal,
                            styles.tablaHeaderTextoModal,
                            { flex: 1.2 },
                          ]}
                        >
                          Reg. por
                        </Text>
                      </View>
                      {pagosPrestamo.map((pago, index) => (
                        <View key={index} style={styles.tablaFilaModal}>
                          <Text style={[styles.tablaCeldaModal, { flex: 1 }]}>
                            ${Number(pago.monto_pagado).toFixed(2)}
                          </Text>
                          <Text style={[styles.tablaCeldaModal, { flex: 1.5 }]}>
                            {pago.fecha_pago
                              ? new Date(
                                  pago.fecha_pago.replace("Z", ""),
                                ).toLocaleDateString()
                              : "N/A"}
                          </Text>
                          <Text style={[styles.tablaCeldaModal, { flex: 1.2 }]}>
                            {pago.registrado_por_cedula || "Administrador"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.btnCerrarModal}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCerrarText}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f6fa",
    ...(Platform.OS === "web"
      ? { width: "100%", height: "100vh", boxSizing: "border-box" }
      : {}),
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2f3640",
  },
  globalExportRow: {
    flexDirection: "row",
    gap: 8,
  },
  btnGlobalExcel: {
    backgroundColor: "#27ae60",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnGlobalPdf: {
    backgroundColor: "#c0392b",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnExportText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 14,
    width: "100%",
  },
  filtroContainer: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  filtroLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 6,
  },
  inputsFechaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  inputFecha: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 12,
  },
  botonesFiltroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  btnFiltrar: {
    backgroundColor: "#0984e3",
    padding: 8,
    borderRadius: 6,
    flex: 1,
    alignItems: "center",
  },
  btnFiltrarText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  btnLimpiar: {
    backgroundColor: "#b2bec3",
    padding: 8,
    borderRadius: 6,
    width: 90,
    alignItems: "center",
  },
  btnLimpiarText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  tableFullContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dcdde1",
    overflow: "hidden",
    ...(Platform.OS === "web" ? { width: "100%", display: "flex" } : {}),
  },
  tableInnerWrapper: {
    width: "100%",
    minWidth: "100%",
  },
  gridHeader: {
    backgroundColor: "#f1f2f6",
    borderBottomWidth: 2,
    borderBottomColor: "#b2bec3",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
    backgroundColor: "#fff",
    ...(Platform.OS === "web" ? { width: "100%" } : {}),
  },
  gridCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#f0f0f0",
  },
  headerText: {
    fontWeight: "bold",
    color: "#2f3640",
    fontSize: 13,
  },
  cellText: {
    fontSize: 13,
    color: "#333",
  },
  cellTextBold: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2f3640",
  },

  // Distribución mediante Flex para que cubran estrictamente el 100% del ancho web
  colFecha: { flex: 1.1 },
  colCliente: { flex: 2.2 },
  colMonto: { flex: 1.3 },
  colPorcentaje: { flex: 0.9 },
  colTotal: { flex: 1.3 },
  colEmpleado: { flex: 1.5 },
  colAccion: { flex: 1.4, borderRightWidth: 0, alignItems: "center" },

  subCedula: { fontSize: 11, color: "#718093", marginTop: 2 },
  badgeEstado: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeTextEstado: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  btnVerAccion: {
    backgroundColor: "#f1f2f6",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  btnVerAccionText: { color: "#0984e3", fontSize: 12, fontWeight: "600" },

  emptyText: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
    ...(Platform.OS === "web"
      ? { maxWidth: 600, alignSelf: "center", width: "100%" }
      : {}),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
    color: "#2f3640",
    textAlign: "center",
  },
  modalLabel: { fontSize: 14, color: "#555", marginBottom: 6 },
  modalValue: { fontWeight: "bold", color: "#2f3640" },
  subtituloPagos: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2f3640",
    marginTop: 14,
    marginBottom: 8,
  },
  sinPagosText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    marginBottom: 10,
  },
  tablaContainerModal: {
    borderWidth: 1,
    borderColor: "#dcdde1",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  tablaFilaModal: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tablaHeaderModal: {
    backgroundColor: "#f1f2f6",
  },
  tablaHeaderTextoModal: {
    fontWeight: "bold",
    color: "#2f3640",
    fontSize: 12,
  },
  tablaCeldaModal: {
    fontSize: 12,
    color: "#555",
  },
  btnCerrarModal: {
    backgroundColor: "#718093",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  btnCerrarText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
