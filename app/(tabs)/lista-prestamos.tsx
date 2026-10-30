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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState(""); // 🔹 Filtro por fecha (AAAA-MM-DD)

  // Modal de Detalles e Historial
  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  // 🔹 Estados para el Modal de Edición (¡Añadidos!)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [prestamoAEditar, setPrestamoAEditar] = useState<any>(null);
  const [editFecha, setEditFecha] = useState("");
  const [editFrecuencia, setEditFrecuencia] = useState("Diario");
  const [editPorcentaje, setEditPorcentaje] = useState("");
  const [editMonto, setEditMonto] = useState("");
  const [editCuotas, setEditCuotas] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // 🔹 Estados para los Modales de Eliminación (¡Añadidos!)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [prestamoAEliminar, setPrestamoAEliminar] = useState<any>(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const cargarPrestamos = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // 1. Obtener tablas de usuarios para mapear cédula -> Nombre y Apellido completo
      const [adminsRes, empleRes, secRes] = await Promise.all([
        supabase.from("administradores").select("cedula, nombres, apellidos"),
        supabase.from("empleados").select("cedula, nombres, apellidos"),
        supabase.from("secretaria").select("cedula, nombres, apellidos"),
      ]);

      const mapaUsuarios: { [cedula: string]: string } = {};
      const registrarEnMapa = (data: any[]) => {
        if (data) {
          data.forEach((u) => {
            if (u.cedula) {
              const cedulaLimpia = String(u.cedula).trim();
              const nombreCompleto =
                `${u.nombres || ""} ${u.apellidos || ""}`.trim();
              if (nombreCompleto) {
                mapaUsuarios[cedulaLimpia] = nombreCompleto;
              }
            }
          });
        }
      };

      registrarEnMapa(adminsRes.data || []);
      registrarEnMapa(empleRes.data || []);
      registrarEnMapa(secRes.data || []);

      // 2. Cargar préstamos
      const { data: prestamosData, error: prestamoError } = await supabase
        .from("prestamos")
        .select("*")
        .neq("estado", "renovado")
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

            const montoPrestadoNum = Number(p.monto_prestado) || 0;
            const tasaInteresNum = Number(p.tasa_interes) || 0;
            const interesCalculado = (montoPrestadoNum * tasaInteresNum) / 100;
            const montoTotalCalculado =
              Number(p.monto_total) || montoPrestadoNum + interesCalculado;

            const saldoPendienteCalculado = montoTotalCalculado - monto_pagado;

            const cedulaReg = p.registrado_por_cedula
              ? String(p.registrado_por_cedula).trim()
              : "";
            const empleadoNombre =
              mapaUsuarios[cedulaReg] ||
              (cedulaReg ? `Cédula: ${cedulaReg}` : "Sin asignar");

            let estadoCalculado = "activo";
            if (saldoPendienteCalculado <= 0) {
              estadoCalculado = "pagado";
            } else if (p.estado === "atrasado") {
              estadoCalculado = "atrasado";
            }

            return {
              ...p,
              clientes: clienteInfo,
              monto_prestado: montoPrestadoNum,
              monto_total: montoTotalCalculado,
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

  // 🔹 Función para abrir el modal de edición con los datos del préstamo seleccionado
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

  // 🔹 Función para guardar los cambios de la edición en Supabase
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

  // 🔹 Función para verificar si tiene pagos antes de eliminar
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

  // 🔹 Función para ejecutar la eliminación del préstamo en Supabase
  const ejecutarEliminacion = async () => {
    if (!prestamoAEliminar) return;
    try {
      const { error } = await supabase
        .from("prestamos")
        .delete()
        .eq("id", prestamoAEliminar.id);

      if (error) throw error;

      setPrestamos((prevPrestamos: any[]) =>
        prevPrestamos.filter((p) => p.id !== prestamoAEliminar.id),
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
    }
  };

  // 🔹 Filtro combinado por fecha exacta (AAAA-MM-DD) y texto de búsqueda
  const prestamosFiltrados = prestamos.filter((item) => {
    const textoBusqueda = busqueda.toLowerCase().trim();

    if (fechaFiltro.trim() !== "") {
      if (item.fecha_prestamo) {
        const fechaBD = String(item.fecha_prestamo).substring(0, 10);
        if (!fechaBD.includes(fechaFiltro.trim())) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (!textoBusqueda) return true;
    const nombres = (item.clientes?.nombres || "").toLowerCase();
    const apellidos = (item.clientes?.apellidos || "").toLowerCase();
    const nombreCompleto = `${nombres} ${apellidos}`;
    const registrador = (item.empleadoNombre || "").toLowerCase();
    const montoPrestado = String(item.monto_prestado || "").toLowerCase();
    const montoTotal = String(item.monto_total || "").toLowerCase();

    return (
      nombres.includes(textoBusqueda) ||
      apellidos.includes(textoBusqueda) ||
      nombreCompleto.includes(textoBusqueda) ||
      registrador.includes(textoBusqueda) ||
      montoPrestado.includes(textoBusqueda) ||
      montoTotal.includes(textoBusqueda)
    );
  });

  // 🔹 Totales superiores separados por moneda (COP y USD)
  const totalesCalculados = prestamosFiltrados.reduce(
    (acc, curr) => {
      const moneda = (curr.moneda || "COP").toUpperCase();
      const mPrestado = Number(curr.monto_prestado || 0);
      const mTotal = Number(curr.monto_total || 0);
      const mPagado = Number(curr.monto_pagado || 0);

      if (moneda === "USD") {
        acc.usd.prestado += mPrestado;
        acc.usd.total += mTotal;
        acc.usd.pagado += mPagado;
      } else {
        acc.cop.prestado += mPrestado;
        acc.cop.total += mTotal;
        acc.cop.pagado += mPagado;
      }
      return acc;
    },
    {
      cop: { prestado: 0, total: 0, pagado: 0 },
      usd: { prestado: 0, total: 0, pagado: 0 },
    },
  );

  const formatearDinero = (val: number) => {
    return val.toLocaleString("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportarExcelTablaGeneral = async () => {
    if (prestamosFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos en la tabla para exportar.");
      return;
    }

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
      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      try {
        const fileUri = `${FileSystem.cacheDirectory}${nombreArchivo}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

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
      try {
        const { uri } = await Print.printToFileAsync({ html });
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
            <Text style={styles.btnExportText}>📥 Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGlobalPdf}
            onPress={exportarPDFTablaGeneral}
          >
            <Text style={styles.btnExportText}>📥 PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔹 CONTENEDOR DE TOTALES SUPERIOR (COP / USD) */}
      <View style={styles.totalesContainer}>
        <Text style={styles.totalesHeaderTitle}>
          📊 Totales{" "}
          {fechaFiltro ? `(Fecha: ${fechaFiltro})` : "(General / Filtrados)"}:
        </Text>
        <View style={styles.totalesGrid}>
          {/* COP */}
          <View style={styles.totalCard}>
            <Text style={styles.totalCardCurrency}>COP ($)</Text>
            <Text style={styles.totalRowText}>
              Total Prestado:{" "}
              <Text style={styles.totalValue}>
                {formatearDinero(totalesCalculados.cop.prestado)}
              </Text>
            </Text>
            <Text style={styles.totalRowText}>
              Total Prestado + Intereses (+%):{" "}
              <Text style={styles.totalValue}>
                {formatearDinero(totalesCalculados.cop.total)}
              </Text>
            </Text>
            <Text style={styles.totalRowText}>
              Total Pagado:{" "}
              <Text style={[styles.totalValue, { color: "#16a34a" }]}>
                {formatearDinero(totalesCalculados.cop.pagado)}
              </Text>
            </Text>
          </View>
          {/* USD */}
          <View style={styles.totalCard}>
            <Text style={styles.totalCardCurrency}>USD ($)</Text>
            <Text style={styles.totalRowText}>
              Total Prestado:{" "}
              <Text style={styles.totalValue}>
                {formatearDinero(totalesCalculados.usd.prestado)}
              </Text>
            </Text>
            <Text style={styles.totalRowText}>
              Total Prestado + Intereses (+%):{" "}
              <Text style={styles.totalValue}>
                {formatearDinero(totalesCalculados.usd.total)}
              </Text>
            </Text>
            <Text style={styles.totalRowText}>
              Total Pagado:{" "}
              <Text style={[styles.totalValue, { color: "#16a34a" }]}>
                {formatearDinero(totalesCalculados.usd.pagado)}
              </Text>
            </Text>
          </View>
        </View>
      </View>

      {/* 🔹 FILTROS DE BÚSQUEDA Y FECHA */}
      <View style={styles.filtersWrapper}>
        <View
          style={[
            styles.searchRow,
            { flexDirection: esPantallaPequena ? "column" : "row", gap: 10 },
          ]}
        >
          <TextInput
            style={[styles.searchInput, { flex: 2 }]}
            placeholder="🔍 Buscar por nombres, apellidos, registrador o monto..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={[styles.searchInput, { flex: 1, minWidth: 150 }]}
            placeholder="📅 Fecha (AAAA-MM-DD)"
            value={fechaFiltro}
            onChangeText={setFechaFiltro}
            placeholderTextColor="#94a3b8"
          />
          {fechaFiltro !== "" && (
            <TouchableOpacity
              style={styles.btnClearDate}
              onPress={() => setFechaFiltro("")}
            >
              <Text style={styles.btnClearDateText}>Limpiar Fecha</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tableFullContainer}>
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View style={{ width: "100%" }}>
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

            <FlatList
              data={prestamosFiltrados}
              keyExtractor={(item, index) => item.id || index.toString()}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
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
                      <Text style={styles.cellTextBold} numberOfLines={1}>
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

                        {/* 🔹 Botón Editar conectado correctamente */}
                        <TouchableOpacity
                          style={styles.btnEditarAccion}
                          onPress={() => abrirModalEdicion(item)}
                        >
                          <Text style={styles.btnAccionText}>Editar</Text>
                        </TouchableOpacity>

                        {/* 🔹 Botón Eliminar conectado correctamente */}
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

      {/* MODAL DE DETALLES */}
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

                {prestamoSeleccionado.prestamo_padre_id && (
                  <View style={styles.modalRowItem}>
                    <Text style={styles.modalLabel}>Tipo de Registro:</Text>
                    <Text
                      style={[
                        styles.modalValue,
                        { fontWeight: "bold", color: "#16a34a" },
                      ]}
                    >
                      🔄 Renovación de Préstamo
                    </Text>
                  </View>
                )}

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
          </View>
        </View>
      </Modal>

      {/* 🔹 MODAL DE EDICIÓN */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Editar Préstamo</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeIconBtn}
              >
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Monto Prestado:</Text>
              <TextInput
                style={styles.modalInput}
                value={editMonto}
                onChangeText={setEditMonto}
                keyboardType="numeric"
                placeholder="Ej. 100000"
              />

              <Text style={styles.modalLabel}>Porcentaje de Interés (%):</Text>
              <TextInput
                style={styles.modalInput}
                value={editPorcentaje}
                onChangeText={setEditPorcentaje}
                keyboardType="numeric"
                placeholder="Ej. 20"
              />

              <Text style={styles.modalLabel}>Frecuencia:</Text>
              <TextInput
                style={styles.modalInput}
                value={editFrecuencia}
                onChangeText={setEditFrecuencia}
                placeholder="Ej. Diario"
              />

              <Text style={styles.modalLabel}>Cuotas:</Text>
              <TextInput
                style={styles.modalInput}
                value={editCuotas}
                onChangeText={setEditCuotas}
                keyboardType="numeric"
                placeholder="Ej. 30"
              />

              <Text style={styles.modalLabel}>Fecha (AAAA-MM-DD):</Text>
              <TextInput
                style={styles.modalInput}
                value={editFecha}
                onChangeText={setEditFecha}
                placeholder="2026-09-10"
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 15,
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.btnModalAction,
                    { backgroundColor: "#64748b" },
                  ]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.btnModalActionText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnModalAction,
                    { backgroundColor: "#16a34a" },
                  ]}
                  onPress={guardarEdicionPrestamo}
                  disabled={guardandoEdicion}
                >
                  {guardandoEdicion ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnModalActionText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🔹 MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 350 }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: "#dc2626", marginBottom: 10 },
              ]}
            >
              ⚠️ Confirmar Eliminación
            </Text>
            <Text style={{ fontSize: 13, color: "#334155", marginBottom: 20 }}>
              ¿Estás seguro de que deseas eliminar este préstamo? Esta acción no
              se puede deshacer.
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <TouchableOpacity
                style={[styles.btnModalAction, { backgroundColor: "#64748b" }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.btnModalActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalAction, { backgroundColor: "#dc2626" }]}
                onPress={ejecutarEliminacion}
              >
                <Text style={styles.btnModalActionText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔹 MODAL DE ERROR (SI TIENE PAGOS) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 350 }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: "#dc2626", marginBottom: 10 },
              ]}
            >
              ❌ No se puede eliminar
            </Text>
            <Text style={{ fontSize: 13, color: "#334155", marginBottom: 20 }}>
              Este préstamo ya cuenta con pagos registrados en su historial. No
              es posible eliminarlo.
            </Text>
            <TouchableOpacity
              style={[
                styles.btnModalAction,
                { backgroundColor: "#2563eb", alignSelf: "flex-end" },
              ]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.btnModalActionText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔹 MODAL DE ÉXITO AL ELIMINAR */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 350 }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: "#16a34a", marginBottom: 10 },
              ]}
            >
              ✅ Eliminado
            </Text>
            <Text style={{ fontSize: 13, color: "#334155", marginBottom: 20 }}>
              El préstamo ha sido eliminado correctamente de la base de datos.
            </Text>
            <TouchableOpacity
              style={[
                styles.btnModalAction,
                { backgroundColor: "#16a34a", alignSelf: "flex-end" },
              ]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.btnModalActionText}>Aceptar</Text>
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
  headerTitleRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#0f172a" },
  globalExportRow: { flexDirection: "row", gap: 8 },
  btnGlobalExcel: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnGlobalPdf: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnExportText: { color: "#ffffff", fontWeight: "bold", fontSize: 12 },

  totalesContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  totalesHeaderTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 8,
  },
  totalesGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  totalCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  totalCardCurrency: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 2,
  },
  totalRowText: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  totalValue: {
    fontWeight: "bold",
    color: "#0f172a",
  },

  filtersWrapper: { marginBottom: 12 },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    height: 42,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
  },
  btnClearDate: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 8,
    height: 40,
  },
  btnClearDateText: { fontSize: 12, fontWeight: "bold", color: "#334155" },

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
    maxHeight: 450,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? {
          overflowY: "auto",
        }
      : {}),
  },
  horizontalScrollContent: { paddingBottom: 20, minWidth: 1300, flexGrow: 1 },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    minHeight: 40,
  },
  gridHeader: {
    backgroundColor: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    minHeight: 50,
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
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  cellText: {
    fontSize: 14,
    color: "#334155",
  },
  cellTextBold: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  colFecha: { width: 180 },
  colCliente: { width: 170 },
  colMonto: { width: 160 },
  colMoneda: { width: 90 },
  colPorcentaje: { width: 120 },
  colTotal: { width: 180 },
  colEmpleado: { width: 160 },
  colAccion: { width: 250, flexDirection: "row", alignItems: "center", gap: 6 },
  badgeMoneda: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeMonedaText: { color: "#0369a1", fontSize: 10, fontWeight: "bold" },
  badgeEstado: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTextEstado: { fontSize: 10, fontWeight: "bold" },
  btnVerAccion: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnEditarAccion: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnAccionText: { color: "#ffffff", fontSize: 10, fontWeight: "bold" },
  emptyText: {
    textAlign: "center",
    padding: 20,
    color: "#64748b",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "90%",
    maxWidth: 440,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#0f172a" },
  closeIconBtn: { padding: 4 },
  closeIconText: { fontSize: 16, fontWeight: "bold", color: "#64748b" },
  modalInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    marginBottom: 10,
  },
  btnModalAction: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  btnModalActionText: { color: "#ffffff", fontWeight: "bold", fontSize: 13 },
  modalRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 6,
  },
  modalLabel: { fontSize: 13, color: "#64748b" },
  modalValue: { fontSize: 13, color: "#0f172a" },
  modalValueBold: { fontSize: 13, fontWeight: "bold", color: "#0f172a" },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 15,
    marginBottom: 8,
  },
  emptyHistoryText: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  historyTable: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6 },
  historyHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 6,
  },
  historyHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    textAlign: "center",
  },
  historyItemRow: {
    flexDirection: "row",
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    alignItems: "center",
  },
  historyCellText: {
    flex: 1,
    fontSize: 11,
    color: "#334155",
    textAlign: "center",
  },
});
