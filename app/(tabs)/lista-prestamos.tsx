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
  const [verificandoRol, setVerificandoRol] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  useEffect(() => {
    verificarRolAdministrador();
  }, []);

  // ==========================================
  // FUNCIÓN ACTUALIZADA (Autenticación por email contra tabla "empleados")
  // ==========================================
  const verificarRolAdministrador = async () => {
    setVerificandoRol(true);
    try {
      // Usar getSession en lugar de getUser evita bucles y cierres de sesión fantasma
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const session = sessionData?.session;

      if (sessionError || !session || !session.user || !session.user.email) {
        Alert.alert("Acceso denegado", "No hay una sesión activa.");
        setVerificandoRol(false);
        return;
      }

      // Consultar de forma directa y exclusiva en la tabla "empleados" por correo y rol de administrador
      const { data: empleadoData, error: empleadoError } = await supabase
        .from("empleados")
        .select("*")
        .eq("correo", session.user.email)
        .eq("rol", "administrador")
        .maybeSingle();

      if (empleadoError || !empleadoData) {
        Alert.alert(
          "Acceso Restringido",
          "Esta sección es exclusiva para administradores.",
        );
        setVerificandoRol(false);
        return;
      }

      cargarPrestamos();
    } catch (err: any) {
      console.log("Error al verificar rol:", err.message);
      Alert.alert("Error", "No se pudieron verificar los permisos de acceso.");
    } finally {
      setVerificandoRol(false);
    }
  };
  // ==========================================

  const obtenerNombreRegistrador = async (cedula: string) => {
    if (!cedula) return "Administrador";

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
      let query = supabase
        .from("prestamos")
        .select(
          `
          *,
          clientes:cliente_cedula (
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

            let estadoTexto = "pagando";
            const fechaPrestamoObj = new Date(p.fecha_prestamo);
            const hoy = new Date();
            const diferenciaDias = Math.floor(
              (hoy.getTime() - fechaPrestamoObj.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (totalPagado >= montoTotal) {
              estadoTexto = "pagado";
            } else if (diferenciaDias > 10 && saldoPendienteCalculado > 0) {
              estadoTexto = "en mora";
            } else {
              estadoTexto = "pagando";
            }

            const empleadoNombre = await obtenerNombreRegistrador(
              p.registrado_por_cedula,
            );

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
        const montoPrestado = item.monto_prestado || item.monto_total || 0;
        const porcentaje = item.tasa_interes || 0;
        const totalPagar = item.monto_total || 0;
        const empleado = `"${item.empleadoNombre}"`;
        const estado = item.estadoTexto.toUpperCase();

        csvContent += `${fecha},${cliente},${cedula},${montoPrestado},${porcentaje},${totalPagar},${empleado},${estado}\r\n`;
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
              @page { size: landscape; margin: 10mm; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background-color: #ffffff; }
              h2 { text-align: center; color: #0f172a; margin-bottom: 5px; font-size: 24px; font-weight: 700; }
              p.subtitle { text-align: center; color: #64748b; margin-top: 0; margin-bottom: 25px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              th, td { border: 1px solid #e2e8f0; padding: 12px 14px; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
            <h2>Gestión de Préstamos</h2>
            <p class="subtitle">Reporte General del Sistema</p>
            <table>
              <thead>
                <tr>
                  <th>Fecha de Préstamo</th>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th class="text-right">Monto Prestado</th>
                  <th>Porcentaje (%)</th>
                  <th class="text-right">Total a Pagar</th>
                  <th>Registrado por</th>
                  <th>Estado Actual</th>
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
        const montoPrestado = Number(
          item.monto_prestado || item.monto_total || 0,
        ).toFixed(2);
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagar = Number(item.monto_total || 0).toFixed(2);
        const empleado = item.empleadoNombre;
        const estado = item.estadoTexto.toUpperCase();

        html += `
          <tr>
            <td>${fecha}</td>
            <td><strong>${cliente}</strong></td>
            <td>${cedula}</td>
            <td class="text-right">$${montoPrestado}</td>
            <td>${porcentaje}</td>
            <td class="text-right"><strong>$${totalPagar}</strong></td>
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

  if (verificandoRol) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={[styles.subtitle, { marginTop: 10 }]}>
          Verificando permisos...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerTitleRow}>
        <View>
          <Text style={styles.title}>Gestión y Detalles de Préstamos</Text>
          <Text style={styles.subtitle}>Panel de control financiero</Text>
        </View>
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

      <View style={styles.filtersWrapper}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cédula, nombres o apellidos del cliente..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.filtroContainer}>
          <Text style={styles.filtroLabel}>
            Filtrar por Rango de Fecha (AAAA-MM-DD):
          </Text>
          <View style={styles.inputsFechaRow}>
            <TextInput
              style={styles.inputFecha}
              placeholder="Desde (Ej: 2026-01-01)"
              value={fechaInicio}
              onChangeText={setFechaInicio}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={styles.inputFecha}
              placeholder="Hasta (Ej: 2026-12-31)"
              value={fechaFin}
              onChangeText={setFechaFin}
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.botonesFiltroRow}>
            <TouchableOpacity
              style={styles.btnFiltrar}
              onPress={cargarPrestamos}
            >
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
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
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

                    const estado = item.estadoTexto || "pagando";
                    let badgeBg = "#eff6ff";
                    let badgeColor = "#2563eb";
                    if (estado === "pagado") {
                      badgeBg = "#f0fdf4";
                      badgeColor = "#16a34a";
                    }
                    if (estado === "en mora") {
                      badgeBg = "#fef2f2";
                      badgeColor = "#dc2626";
                    }

                    const montoPrestadoMostrar =
                      item.monto_prestado ?? item.monto_total;

                    return (
                      <View
                        key={item.id?.toString() || index}
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
                          <Text style={styles.subCedula}>
                            {item.cliente_cedula}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colMonto]}>
                          <Text style={styles.cellText}>
                            ${Number(montoPrestadoMostrar).toFixed(2)}
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

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                Detalles Completos del Préstamo
              </Text>

              {prestamoSeleccionado && (
                <View style={styles.modalDetailsBox}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cliente:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.clientes
                        ? `${prestamoSeleccionado.clientes.nombres} ${prestamoSeleccionado.clientes.apellidos}`
                        : prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cédula:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Registrado por:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.empleadoNombre}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Capital Prestado:</Text>
                    <Text style={styles.modalValue}>
                      $
                      {Number(
                        prestamoSeleccionado.monto_prestado ??
                          prestamoSeleccionado.monto_total,
                      ).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tasa de Interés:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.tasa_interes}%
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Total a Pagar:</Text>
                    <Text style={styles.modalValue}>
                      ${Number(prestamoSeleccionado.monto_total).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Total Pagado:</Text>
                    <Text style={[styles.modalValue, { color: "#16a34a" }]}>
                      ${prestamoSeleccionado.totalPagado.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Saldo Pendiente:</Text>
                    <Text style={[styles.modalValue, { color: "#dc2626" }]}>
                      ${prestamoSeleccionado.saldo_pendiente.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.subtituloPagos}>
                Historial de Abonos / Pagos
              </Text>

              {cargandoPagos ? (
                <ActivityIndicator
                  size="small"
                  color="#4f46e5"
                  style={{ marginVertical: 15 }}
                />
              ) : pagosPrestamo.length === 0 ? (
                <Text style={styles.sinPagosText}>
                  No hay pagos registrados aún para este préstamo.
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
                        {pago.registrado_por_cedula || "N/A"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.btnCerrarModal}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCerrarText}>Cerrar Ventana</Text>
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
    padding: 24,
    backgroundColor: "#f8fafc",
    ...(Platform.OS === "web"
      ? {
          width: "100vw",
          height: "100vh",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }
      : {}),
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  globalExportRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnGlobalExcel: {
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  btnGlobalPdf: {
    backgroundColor: "#e11d48",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  btnExportText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  filtersWrapper: {
    marginBottom: 16,
    gap: 12,
  },
  searchContainer: {
    width: "100%",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 14,
    color: "#1e293b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filtroContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filtroLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  inputsFechaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  inputFecha: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    fontSize: 13,
    color: "#1e293b",
  },
  botonesFiltroRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnFiltrar: {
    backgroundColor: "#4f46e5",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  btnFiltrarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnLimpiar: {
    backgroundColor: "#94a3b8",
    padding: 10,
    borderRadius: 8,
    width: 100,
    alignItems: "center",
  },
  btnLimpiarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
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
    minWidth: 1000,
    flexGrow: 1,
  },
  tableInnerWrapper: {
    width: "100%",
  },
  gridHeader: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#334155",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  rowAlternate: {
    backgroundColor: "#f8fafc",
  },
  gridCell: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  colFecha: { width: 110 },
  colCliente: { flex: 2, minWidth: 180 },
  colMonto: { width: 130, alignItems: "flex-end" },
  colPorcentaje: { width: 90, alignItems: "center" },
  colTotal: { width: 120, alignItems: "flex-end" },
  colEmpleado: { flex: 1.5, minWidth: 140 },
  colAccion: { width: 180, flexDirection: "row", alignItems: "center", gap: 6 },
  headerText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  cellText: {
    color: "#1e293b",
    fontSize: 13,
  },
  cellTextBold: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  subCedula: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    padding: 30,
    fontSize: 14,
  },
  badgeEstado: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTextEstado: {
    fontSize: 10,
    fontWeight: "800",
  },
  btnVerAccion: {
    backgroundColor: "#4f46e5",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnVerAccionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  modalDetailsBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
    gap: 8,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  modalValue: {
    fontSize: "13@s" as any,
    fontWeight: "700",
    color: "#1e293b",
  },
  subtituloPagos: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  sinPagosText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    marginBottom: 15,
  },
  tablaContainerModal: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
  },
  tablaFilaModal: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  tablaHeaderModal: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 0,
  },
  tablaCeldaModal: {
    fontSize: 12,
    color: "#1e293b",
  },
  tablaHeaderTextoModal: {
    color: "#ffffff",
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: 11,
  },
  btnCerrarModal: {
    backgroundColor: "#64748b",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnCerrarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
