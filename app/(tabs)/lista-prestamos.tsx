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
  FlatList,
  RefreshControl,
} from "react-native";
import { supabase } from "../../supabase";
import { formatearFechaLocal } from "../../utils/fechass";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

export default function ListaPrestamosScreen() {
  const { width } = useWindowDimensions();
  const esPantallaPequena = width < 768;

  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Cambiado a false para que no bloquee la pantalla de inicio
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Modal de Detalles e Historial
  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  // Estados para el Modal de Edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [prestamoAEditar, setPrestamoAEditar] = useState<any>(null);
  const [editFecha, setEditFecha] = useState("");
  const [editFrecuencia, setEditFrecuencia] = useState("Diario");
  const [editPorcentaje, setEditPorcentaje] = useState("");
  const [editMonto, setEditMonto] = useState("");
  const [editCuotas, setEditCuotas] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // Estados para el Modal de Confirmación de Eliminación
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [prestamoAEliminar, setPrestamoAEliminar] = useState<any>(null);
  // Estados para el Modal de Éxito y Mensajes
  const [modalExitoVisible, setModalExitoVisible] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  // Estado para el modal de error al intentar eliminar un préstamo con pagos
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  // Estado para el modal de éxito al eliminar un préstamo
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  // Nuevo estado opcional para rastrear el ID que se está eliminando
  const [idPrestamoBorrando, setIdPrestamoBorrando] = useState<string | null>(
    null,
  );

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const obtenerNombreRegistrador = async (cedula: string) => {
    if (!cedula) return "Sin asignar";
    try {
      const { data, error } = await supabase.rpc("obtener_nombre_registrador", {
        p_cedula: String(cedula).trim(),
      });
      if (!error && data) return data;
    } catch (e) {
      console.log("Error buscando registrador:", e);
    }
    return `Cédula: ${cedula}`;
  };

  const cargarPrestamos = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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

            const monto_pagado = pagosData
              ? pagosData.reduce(
                  (sum: number, pago: any) =>
                    sum + Number(pago.monto_pagado || 0),
                  0,
                )
              : 0;

            const montoTotal = Number(p.monto_total) || 0;
            const saldoPendienteCalculado = montoTotal - monto_pagado;
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
              monto_pagado,
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
      setRefreshing(false);
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

  const abrirModalEdicion = (item: any) => {
    setPrestamoAEditar(item);
    let fechaOriginal = "";
    if (item.fecha_prestamo) {
      fechaOriginal = item.fecha_prestamo.split("T")[0];
    }
    setEditFecha(fechaOriginal);
    setEditFrecuencia(item.frecuencia || "Diario");
    setEditPorcentaje(String(item.tasa_interes ?? ""));
    setEditMonto(String(item.monto_prestado ?? item.monto_total ?? ""));
    setEditCuotas(String(item.cuotas ?? ""));
    setEditModalVisible(true);
  };

  const confirmarEliminarPrestamo = async (item: any) => {
    try {
      const { data: pagosRegistrados, error } = await supabase
        .from("pagos")
        .select("id, monto_pagado")
        .eq("prestamo_id", item.id);

      if (error) throw error;

      if (pagosRegistrados && pagosRegistrados.length > 0) {
        setErrorModalVisible(true);
        return;
      }

      setPrestamoAEliminar(item);
      setDeleteModalVisible(true);
    } catch (err) {
      console.error("Error al verificar pagos del préstamo:", err);
      setErrorModalVisible(true);
    }
  };

  const ejecutarEliminacion = async (item: any) => {
    try {
      setIdPrestamoBorrando(item.id);

      const { error } = await supabase
        .from("prestamos")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setPrestamos((prevPrestamos: any[]) =>
        prevPrestamos.filter((p) => p.id !== item.id),
      );

      setDeleteModalVisible(false);
      setPrestamoAEliminar(null);
      setSuccessModalVisible(true);
    } catch (err) {
      console.error("Error al eliminar el préstamo:", err);
      Alert.alert(
        "Error",
        "No se pudo eliminar el préstamo de la base de datos.",
      );
    } finally {
      setIdPrestamoBorrando(null);
    }
  };

  const guardarEdicionPrestamo = async () => {
    if (!prestamoAEditar) return;

    const montoNum = parseFloat(editMonto);
    const porcentajeNum = parseFloat(editPorcentaje);
    const cuotasNum = parseInt(editCuotas) || 1;

    if (isNaN(montoNum) || montoNum <= 0) {
      Alert.alert("Error", "Ingresa un monto de préstamo válido.");
      return;
    }
    if (isNaN(porcentajeNum) || porcentajeNum < 0) {
      Alert.alert("Error", "Ingresa un porcentaje de interés válido.");
      return;
    }

    setGuardandoEdicion(true);
    try {
      const interesCalculado = (montoNum * porcentajeNum) / 100;
      const nuevoMontoTotal = montoNum + interesCalculado;

      const { error } = await supabase
        .from("prestamos")
        .update({
          fecha_prestamo: editFecha
            ? `${editFecha}T00:00:00.000Z`
            : prestamoAEditar.fecha_prestamo,
          frecuencia: editFrecuencia,
          tasa_interes: porcentajeNum,
          monto_prestado: montoNum,
          monto_total: nuevoMontoTotal,
          cuotas: cuotasNum,
        })
        .eq("id", prestamoAEditar.id);

      if (error) throw error;

      Alert.alert("Éxito", "Préstamo actualizado correctamente.");
      setEditModalVisible(false);
      cargarPrestamos();
    } catch (err: any) {
      console.log("Error al actualizar préstamo:", err.message);
      Alert.alert("Error", "No se pudo actualizar el préstamo: " + err.message);
    } finally {
      setGuardandoEdicion(false);
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

  const exportarExcelTablaGeneral = async () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

    // Estructura del archivo CSV con soporte para caracteres especiales (\uFEFF para tildes y eñes)
    let csvContent =
      "\uFEFFFecha;Cliente;Monto Prestado;Moneda;Porcentaje;Total a Pagar;Saldo Pendiente;Cuotas;Frecuencia;Registrado por;Estado\r\n";

    prestamosFiltrados.forEach((item) => {
      const fecha = item.fecha_prestamo
        ? `"${formatearFechaLocal(item.fecha_prestamo)}"`
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

    const nombreArchivo = `reporte_prestamos_${new Date().toISOString().slice(0, 10)}.csv`;

    if (Platform.OS === "web") {
      // --- COMPORTAMIENTO PARA WEB ---
      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // --- COMPORTAMIENTO PARA APK MÓVIL (Android / iOS) ---
      try {
        // 1. Guardar el archivo temporalmente en el directorio de caché del dispositivo
        const fileUri = `${FileSystem.cacheDirectory}${nombreArchivo}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // 2. Abrir el menú nativo para compartir, enviar por WhatsApp o guardar en archivos
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Reporte General de Préstamos",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert("Éxito", `Archivo CSV guardado en: ${fileUri}`);
        }
      } catch (error: any) {
        console.log("Error al exportar Excel en móvil:", error);
        Alert.alert(
          "Error",
          "No se pudo generar el archivo en el dispositivo.",
        );
      }
    }
  };

  const exportarPDFTablaGeneral = async () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

    // Generamos el contenido HTML que ya tenías diseñado
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
        ? formatearFechaLocal(item.fecha_prestamo)
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

    if (Platform.OS === "web") {
      // --- COMPORTAMIENTO PARA WEB ---
      let ventanaImpresion = window.open("", "_blank");
      if (!ventanaImpresion) {
        Alert.alert(
          "Error",
          "Permite las ventanas emergentes para generar el PDF.",
        );
        return;
      }
      ventanaImpresion.document.write(html);
      ventanaImpresion.document.close();
      ventanaImpresion.focus();
      setTimeout(() => {
        ventanaImpresion.print();
      }, 500);
    } else {
      // --- COMPORTAMIENTO PARA APK MÓVIL (Android / iOS) ---
      try {
        // 1. Imprime el HTML en un archivo PDF temporal en el dispositivo
        const { uri } = await Print.printToFileAsync({ html });

        // 2. Abre el menú nativo del teléfono para compartir, guardar en archivos o imprimir
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Reporte General de Préstamos",
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("Éxito", `PDF generado en: ${uri}`);
        }
      } catch (error: any) {
        console.log("Error al generar PDF en móvil:", error);
        Alert.alert("Error", "No se pudo generar el PDF en el dispositivo.");
      }
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
            placeholder="🔍 Buscar por nombres, apellidos o monto del préstamo..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      {/* Se quitó el bloqueo de pantalla completa por 'loading', la estructura carga de inmediato */}
      <View style={styles.tableFullContainer}>
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View style={{ width: "100%" }}>
            {/* Cabecera de la tabla (permanece fija arriba) */}
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

            {/* FlatList */}
            <FlatList
              data={prestamosFiltrados}
              keyExtractor={(item, index) => item.id || index.toString()}
              ListEmptyComponent={
                loading ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                    <Text style={{ marginTop: 8, color: "#64748b" }}>
                      Cargando préstamos...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    No se encontraron préstamos registrados.
                  </Text>
                )
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => cargarPrestamos(true)}
                  colors={["#4f46e5"]}
                  tintColor="#4f46e5"
                />
              }
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              renderItem={({ item, index }) => {
                const nombreCliente = `${item.clientes?.nombres || ""} ${item.clientes?.apellidos || ""}`;
                const fechaFormateada = formatearFechaLocal(
                  item.fecha_prestamo,
                );
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
                      <Text style={styles.cellText}>{item.tasa_interes}%</Text>
                    </View>
                    <View style={[styles.gridCell, styles.colTotal]}>
                      <Text style={styles.cellTextBold}>
                        {Number(item.monto_total || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.gridCell, styles.colTotal]}>
                      <Text style={[styles.cellTextBold, { color: "#dc2626" }]}>
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
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          style={styles.btnVerAccion}
                          onPress={() => abrirDetalles(item)}
                        >
                          <Text style={styles.btnAccionText}>Detalles</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnEditarAccion}
                          onPress={() => abrirModalEdicion(item)}
                        >
                          <Text style={styles.btnAccionText}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.btnEditarAccion,
                            { backgroundColor: "#dc2626" },
                          ]}
                          onPress={() => confirmarEliminarPrestamo(item)}
                        >
                          <Text style={styles.btnAccionText}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            <View style={{ height: 60 }} />
          </View>
        </ScrollView>
      </View>

      {/* MODAL DE DETALLES E HISTORIAL DE PAGOS */}
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
                style={{ maxHeight: 500 }}
                showsVerticalScrollIndicator={false}
              >
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
                    {formatearFechaLocal(prestamoSeleccionado.fecha_prestamo)}
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
                    {(
                      Number(prestamoSeleccionado.monto_total || 0) -
                      pagosPrestamo.reduce(
                        (sum, p) => sum + Number(p.monto_pagado || 0),
                        0,
                      )
                    ).toFixed(2)}
                  </Text>
                </View>

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

                {/* SECCIÓN DEL HISTORIAL DE PAGOS */}
                <Text style={styles.historySectionTitle}>
                  Historial de Pagos
                </Text>

                {cargandoPagos ? (
                  <ActivityIndicator
                    size="small"
                    color="#4f46e5"
                    style={{ marginVertical: 10 }}
                  />
                ) : pagosPrestamo.length === 0 ? (
                  <Text style={styles.emptyHistoryText}>
                    No hay pagos registrados para este préstamo.
                  </Text>
                ) : (
                  <View style={styles.historyTable}>
                    <View style={styles.historyHeaderRow}>
                      <Text style={styles.historyHeaderText}>Fecha</Text>
                      <Text style={styles.historyHeaderText}>Monto</Text>
                      <Text style={styles.historyHeaderText}>
                        Tipo / Moneda
                      </Text>
                    </View>
                    {pagosPrestamo.map((pago, pIndex) => (
                      <View
                        key={pago.id || pIndex}
                        style={styles.historyItemRow}
                      >
                        <Text style={styles.historyCellText}>
                          {formatearFechaLocal(pago.fecha_pago)}
                        </Text>
                        <Text
                          style={[
                            styles.historyCellText,
                            { fontWeight: "bold", color: "#16a34a" },
                          ]}
                        >
                          {Number(pago.monto_pagado || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.historyCellText}>
                          {pago.moneda_pago || pago.moneda || "Efectivo"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    padding: 12,
    width: "100%",
    height: "100%",
  },
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
  searchRow: { marginBottom: 15 },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
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
    flexDirection: "column",
    width: "100%",
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
    minHeight: 56,
  },
  gridHeader: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    minHeight: 48,
  },
  rowAlternate: {
    backgroundColor: "#fafbfc",
  },
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
  cellText: { color: "#14181f", fontSize: 14 },
  cellTextBold: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  colFecha: { width: 110 },
  colCliente: { flex: 1, minWidth: 180 },
  colMonto: { width: 140 },
  colMoneda: { width: 90 },
  colPorcentaje: { width: 130 },
  colTotal: { width: 130 },
  colEmpleado: { width: 140 },
  colAccion: { width: 290, flexDirection: "row", alignItems: "center", gap: 6 },
  badgeMoneda: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeMonedaText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0369a1",
  },
  badgeEstado: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTextEstado: {
    fontSize: 10,
    fontWeight: "bold",
  },
  btnVerAccion: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  btnEditarAccion: {
    backgroundColor: "#269c4b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  btnAccionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
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
    maxWidth: 550,
    padding: 20,
    maxHeight: "85%",
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
  modalLabel: { fontSize: 14, color: "#000000" },
  modalValue: { fontSize: 14, color: "#000000" },
  modalValueBold: { fontSize: 13, fontWeight: "bold", color: "#0f172a" },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 18,
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: "#060a10",
    fontStyle: "italic",
    marginVertical: 6,
  },
  historyTable: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  historyHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  historyHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "bold",
    color: "#0b0e11",
    textTransform: "uppercase",
  },
  historyItemRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyCellText: { flex: 1, fontSize: 12, color: "#000000" },
  btnCloseModal: {
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 15,
  },
  btnCloseModalText: { color: "#fff", fontWeight: "600" },
  inputContainer: { marginBottom: 12 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  inputModal: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f8fafc",
    fontSize: 13,
    color: "#1e293b",
  },
  frecuenciaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  frecuenciaBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    backgroundColor: "#f8fafc",
  },
  frecuenciaBtnActive: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  frecuenciaBtnText: { fontSize: 12, color: "#334155" },
  frecuenciaBtnTextActive: { color: "#fff", fontWeight: "bold" },
  modalFooterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
  },
  btnCancelarModal: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnCancelarText: { color: "#334155", fontWeight: "600" },
  btnGuardarModal: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 130,
    alignItems: "center",
  },
  btnGuardarText: { color: "#fff", fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  modalTexto: {
    fontSize: 14,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  btnModalAceptar: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  btnModalAceptarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
