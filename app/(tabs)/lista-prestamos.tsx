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

    const canalRealtime = supabase
      .channel("cambios-prestamos-y-pagos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prestamos" },
        () => {
          cargarPrestamos();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagos" },
        () => {
          cargarPrestamos();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [fechaInicio, fechaFin]);

  const handleFechaChange = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9-]/g, "");
    setter(cleaned);
  };

  const verificarRolAdministrador = async () => {
    setVerificandoRol(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const session = sessionData?.session;

      if (sessionError || !session || !session.user || !session.user.email) {
        Alert.alert("Acceso denegado", "No hay una sesión activa.");
        setVerificandoRol(false);
        return;
      }

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
          id,
          fecha_prestamo,
          monto_prestado,
          tasa_interes,
          monto_total,
          saldo_pendiente,
          registrado_por_cedula,
          cedula,
          moneda,
          frecuencia,
          cuotas,
          valor_cuota,
          estado,
          clientes (
            cedula,
            nombres,
            apellidos
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

      const { data: prestamosData, error: prestamoError } = await query;

      if (prestamoError) throw prestamoError;

      if (prestamosData) {
        const prestamosProcesados = await Promise.all(
          prestamosData.map(async (p) => {
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
            const saldoPendienteCalculado =
              Number(p.saldo_pendiente) ?? montoTotal - totalPagado;

            let estadoTexto = p.estado || "activo";
            const fechaPrestamoObj = new Date(p.fecha_prestamo);
            const hoy = new Date();
            const diferenciaDias = Math.floor(
              (hoy.getTime() - fechaPrestamoObj.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (totalPagado >= montoTotal && montoTotal > 0) {
              estadoTexto = "pagado";
            } else if (diferenciaDias > 10 && saldoPendienteCalculado > 0) {
              estadoTexto = "atrasado";
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
        "data:text/csv;charset=utf-8,\uFEFFFecha;Cliente;Cedula;Monto Prestado;Moneda;Porcentaje;Total a Pagar;Saldo Pendiente;Cuotas;Frecuencia;Valor Cuota;Registrado por;Estado\r\n";

      prestamosFiltrados.forEach((item) => {
        const fecha = item.fecha_prestamo
          ? `"${new Date(item.fecha_prestamo.replace("Z", "")).toLocaleDateString()}"`
          : '"N/A"';
        const cliente = item.clientes
          ? `"${item.clientes.nombres} ${item.clientes.apellidos}"`
          : '"Desconocido"';
        const cedula = `"${item.cedula || ""}"`;
        const montoPrestado = Number(
          item.monto_prestado || item.monto_total || 0,
        ).toFixed(2);
        const moneda = `"${item.moneda || "COP"}"`;
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagar = Number(item.monto_total || 0).toFixed(2);
        const saldoPendiente = Number(item.saldo_pendiente || 0).toFixed(2);
        const cuotas = item.cuotas || 0;
        const frecuencia = `"${item.frecuencia || "N/A"}"`;
        const valorCuota = Number(item.valor_cuota || 0).toFixed(2);
        const empleado = `"${item.empleadoNombre}"`;
        const estado = `"${item.estadoTexto.toUpperCase()}"`;

        csvContent += `${fecha};${cliente};${cedula};${montoPrestado};${moneda};${porcentaje};${totalPagar};${saldoPendiente};${cuotas};${frecuencia};${valorCuota};${empleado};${estado}\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "reporte_prestamos_detallado.csv");
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
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
            <h2>Gestión de Préstamos</h2>
            <p class="subtitle">Control de creditos</p>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th class="text-right">Monto Prestado</th>
                  <th>Moneda</th>
                  <th>Int. (%)</th>
                  <th class="text-right">Total a Pagar</th>
                  <th class="text-right">Saldo Pendiente</th>
                  <th>Cuotas</th>
                  <th>Frecuencia</th>
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
        const cedula = item.cedula || "";
        const montoPrestadoNum = Number(
          item.monto_prestado || item.monto_total || 0,
        ).toFixed(2);
        const moneda = item.moneda || "COP";
        const porcentaje = `${item.tasa_interes || 0}%`;
        const totalPagarNum = Number(item.monto_total || 0).toFixed(2);
        const saldoPendienteNum = Number(item.saldo_pendiente || 0).toFixed(2);
        const cuotas = item.cuotas || "-";
        const frecuencia = item.frecuencia || "-";
        const empleado = item.empleadoNombre;
        const estado = item.estadoTexto.toUpperCase();

        html += `
          <tr>
            <td>${fecha}</td>
            <td><strong>${cliente}</strong></td>
            <td>${cedula}</td>
            <td class="text-right">${montoPrestadoNum}</td>
            <td><strong>${moneda}</strong></td>
            <td>${porcentaje}</td>
            <td class="text-right">${totalPagarNum}</td>
            <td class="text-right"><strong>${saldoPendienteNum}</strong></td>
            <td>${cuotas}</td>
            <td>${frecuencia}</td>
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
    const cedula = (item.cedula || "").toLowerCase();
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
        </View>
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
              onChangeText={(text) => handleFechaChange(text, setFechaInicio)}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={styles.inputFecha}
              placeholder="Hasta (Ej: 2026-12-31)"
              value={fechaFin}
              onChangeText={(text) => handleFechaChange(text, setFechaFin)}
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
                    const nombreCliente = item.clientes
                      ? `${item.clientes.nombres} ${item.clientes.apellidos}`
                      : "Cliente desconocido";

                    const fechaFormateada = item.fecha_prestamo
                      ? new Date(
                          item.fecha_prestamo.replace("Z", ""),
                        ).toLocaleDateString()
                      : "N/A";

                    const estado = item.estadoTexto || "activo";
                    let badgeBg = "#eff6ff";
                    let badgeColor = "#2563eb";
                    if (estado === "pagado") {
                      badgeBg = "#f0fdf4";
                      badgeColor = "#16a34a";
                    }
                    if (estado === "atrasado") {
                      badgeBg = "#fef2f2";
                      badgeColor = "#dc2626";
                    }

                    const montoPrestadoMostrar =
                      item.monto_prestado ?? item.monto_total;
                    const monedaPrestamo = item.moneda || "COP";

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
                          <Text style={styles.subCedula}>{item.cedula}</Text>
                        </View>
                        <View style={[styles.gridCell, styles.colMonto]}>
                          <Text style={styles.cellText}>
                            {Number(montoPrestadoMostrar).toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colMoneda]}>
                          <View style={styles.badgeMoneda}>
                            <Text style={styles.badgeMonedaText}>
                              {monedaPrestamo}
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
                            {Number(item.monto_total).toFixed(2)}
                          </Text>
                        </View>
                        <View style={[styles.gridCell, styles.colTotal]}>
                          <Text
                            style={[styles.cellTextBold, { color: "#dc2626" }]}
                          >
                            {Number(item.saldo_pendiente).toFixed(2)}
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
                        : prestamoSeleccionado.cedula}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cédula:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.cedula}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Moneda:</Text>
                    <Text style={[styles.modalValue, { color: "#4f46e5" }]}>
                      {prestamoSeleccionado.moneda || "COP"}
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
                      {Number(
                        prestamoSeleccionado.monto_prestado ??
                          prestamoSeleccionado.monto_total,
                      ).toFixed(2)}{" "}
                      {prestamoSeleccionado.moneda || "COP"}
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
                      {Number(prestamoSeleccionado.monto_total).toFixed(2)}{" "}
                      {prestamoSeleccionado.moneda || "COP"}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Total Pagado:</Text>
                    <Text style={[styles.modalValue, { color: "#16a34a" }]}>
                      {prestamoSeleccionado.totalPagado.toFixed(2)}{" "}
                      {prestamoSeleccionado.moneda || "COP"}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Saldo Pendiente:</Text>
                    <Text style={[styles.modalValue, { color: "#dc2626" }]}>
                      {prestamoSeleccionado.saldo_pendiente.toFixed(2)}{" "}
                      {prestamoSeleccionado.moneda || "COP"}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Cuotas:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.cuotas || "-"}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Frecuencia:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.frecuencia || "-"}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Valor Cuota:</Text>
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.valor_cuota
                        ? `${Number(prestamoSeleccionado.valor_cuota).toFixed(2)} ${prestamoSeleccionado.moneda || "COP"}`
                        : "-"}
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
                  {pagosPrestamo.map((pago, index) => {
                    const monedaPago = prestamoSeleccionado?.moneda || "COP";
                    return (
                      <View key={index} style={styles.tablaFilaModal}>
                        <Text style={[styles.tablaCeldaModal, { flex: 1 }]}>
                          {Number(pago.monto_pagado).toFixed(2)} {monedaPago}
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
                    );
                  })}
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
    backgroundColor: "#f8fafc",
    padding: 16,
    ...(Platform.OS === "web"
      ? {
          width: "100%",
          minHeight: "100vh",
          boxSizing: "border-box",
        }
      : {}),
  },
  headerTitleRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    justifyContent: "space-between",
    alignItems: Platform.OS === "web" ? "center" : "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  globalExportRow: {
    flexDirection: "row",
    gap: 8,
  },
  btnGlobalExcel: {
    backgroundColor: "#16a34a",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnGlobalPdf: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnExportText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  filtersWrapper: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  filtroContainer: {
    gap: 8,
  },
  filtroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  inputsFechaRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
  },
  inputFecha: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  botonesFiltroRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btnFiltrar: {
    backgroundColor: "#4f46e5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnFiltrarText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  btnLimpiar: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnLimpiarText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  tableFullContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  horizontalScrollContent: {
    flexGrow: 1,
    ...(Platform.OS === "web" ? { minWidth: "100%" } : {}),
  },
  tableInnerWrapper: {
    ...(Platform.OS === "web" ? { width: "100%" } : { width: 1350 }),
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    minHeight: 52,
  },
  gridHeader: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 0,
  },
  rowAlternate: {
    backgroundColor: "#f8fafc",
  },
  gridCell: {
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  headerText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 13,
    color: "#334155",
  },
  cellTextBold: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  subCedula: {
    fontSize: 11,
    color: "#64748b",
  },
  colFecha: { ...(Platform.OS === "web" ? { flex: 0.8 } : { width: 100 }) },
  colCliente: { ...(Platform.OS === "web" ? { flex: 1.5 } : { width: 190 }) },
  colMonto: { ...(Platform.OS === "web" ? { flex: 1 } : { width: 120 }) },
  colMoneda: { ...(Platform.OS === "web" ? { flex: 0.7 } : { width: 90 }) },
  colPorcentaje: {
    ...(Platform.OS === "web" ? { flex: 0.8 } : { width: 100 }),
  },
  colTotal: { ...(Platform.OS === "web" ? { flex: 1 } : { width: 120 }) },
  colEmpleado: { ...(Platform.OS === "web" ? { flex: 1.2 } : { width: 150 }) },
  colAccion: {
    ...(Platform.OS === "web" ? { flex: 1.8 } : { width: 220 }),
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeMoneda: {
    backgroundColor: "#e0e7ff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  badgeMonedaText: {
    color: "#3730a3",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeEstado: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeTextEstado: {
    fontSize: 10,
    fontWeight: "700",
  },
  btnVerAccion: {
    backgroundColor: "#4f46e5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  btnVerAccionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    padding: 30,
    color: "#64748b",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  modalDetailsBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: "1px",
    borderBottomColor: "#f1f5f9",
  },
  modalLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  modalValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "600",
  },
  subtituloPagos: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 10,
    marginTop: 4,
  },
  sinPagosText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
    marginBottom: 16,
  },
  tablaContainerModal: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 20,
  },
  tablaFilaModal: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  tablaHeaderModal: {
    backgroundColor: "#f1f5f9",
  },
  tablaCeldaModal: {
    fontSize: 12,
    color: "#334155",
  },
  tablaHeaderTextoModal: {
    fontWeight: "bold",
    color: "#0f172s",
  },
  btnCerrarModal: {
    backgroundColor: "#334155",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  btnCerrarText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});
