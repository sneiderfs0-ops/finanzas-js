import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  Alert,
  TextInput,
  FlatList,
} from "react-native";
import { supabase } from "../../supabase";
import { useRouter, useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { formatearFechaLocal } from "../../utils/fechass";

interface PagoItem {
  id: string;
  fecha_pago: string;
  fecha_prestamo?: string;
  cedula: string;
  monto_prestado: number;
  monto_total: number;
  moneda_prestamo: string;
  moneda_pago: string;
  tasa_interes: number;
  saldo_pendiente: number;
  monto_pagado: number;
  total_pagado_acumulado: number;
  registrado_por_cedula: string;
  metodo_pago?: string;
  estadoTexto?: string;
  clientes?: {
    nombres: string;
    apellidos: string;
    telefono?: string;
  };
}

export default function PagosHabilesScreen() {
  const [loading, setLoading] = useState(false);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [tienePermiso, setTienePermiso] = useState(false);
  const [pagosHabilesFiltrados, setPagosHabilesFiltrados] = useState<
    PagoItem[]
  >([]);

  const [busqueda, setBusqueda] = useState("");
  const [todosLosPagos, setTodosLosPagos] = useState<PagoItem[]>([]);

  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoItem | null>(
    null,
  );

  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [pagoAEditar, setPagoAEditar] = useState<PagoItem | null>(null);
  const [montoEditado, setMontoEditado] = useState("");
  const [fechaEditada, setFechaEditada] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [modalExitoVisible, setModalExitoVisible] = useState(false);
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [mensajeErrorValidacion, setMensajeErrorValidacion] = useState({
    montoIngresado: 0,
    saldoPendiente: 0,
    montoPagadoActual: 0,
    maximoPermitido: 0,
  });

  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const cargarPagosYFiltrarSemana = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("pagos")
        .select(
          `
        id,
        fecha_pago,
        moneda,
        monto_pagado,
        registrado_por_cedula,
        metodo_pago,
        tasa_cambio,
        prestamo_id,
        prestamos (
          id,
          cedula,
          monto_prestado,
          monto_total,
          tasa_interes,
          saldo_pendiente,
          estado,
          moneda,
          fecha_prestamo,
          clientes (
            nombres,
            apellidos,
            telefono
          )
        )
      `,
        )
        .order("fecha_pago", { ascending: false })
        .order("id", { ascending: false });

      if (error) {
        console.log("Error al cargar pagos:", error.message);
        setPagosHabilesFiltrados([]);
        setTodosLosPagos([]);
        return;
      }

      if (data) {
        const [adminsRes, empleadosRes, secretariasRes] = await Promise.all([
          supabase.from("administradores").select("cedula, nombres, apellidos"),
          supabase.from("empleados").select("cedula, nombres, apellidos"),
          supabase.from("secretaria").select("cedula, nombres, apellidos"),
        ]);

        const mapaNombres: { [cedula: string]: string } = {};

        const registrarEnMapa = (personalList: any[]) => {
          if (personalList) {
            personalList.forEach((p) => {
              if (p.cedula) {
                mapaNombres[p.cedula] =
                  `${p.nombres || ""} ${p.apellidos || ""}`.trim();
              }
            });
          }
        };

        registrarEnMapa(adminsRes.data || []);
        registrarEnMapa(empleadosRes.data || []);
        registrarEnMapa(secretariasRes.data || []);

        const acumuladoPagosPorPrestamo: { [prestamoId: string]: number } = {};
        data.forEach((p: any) => {
          if (p.prestamo_id) {
            const montoAbonado = Number(p.monto_pagado) || 0;
            acumuladoPagosPorPrestamo[p.prestamo_id] =
              (acumuladoPagosPorPrestamo[p.prestamo_id] || 0) + montoAbonado;
          }
        });

        const hoy = new Date();

        const pagosFormateados: PagoItem[] = data.map((p: any) => {
          const prestamo = p.prestamos || {};
          const cliente = prestamo.clientes || {};

          const montoTotal = Number(prestamo.monto_total) || 0;
          const totalPagadoAcumulado =
            acumuladoPagosPorPrestamo[prestamo.id] ||
            Number(p.monto_pagado) ||
            0;

          const saldoCalculado = Math.max(0, montoTotal - totalPagadoAcumulado);

          let estadoFinal = "activo";

          if (saldoCalculado <= 0) {
            estadoFinal = "pagado";
          } else if (p.fecha_pago) {
            const fechaPagoRegistro = new Date(p.fecha_pago.replace("Z", ""));
            const diferenciaDias = Math.floor(
              (hoy.getTime() - fechaPagoRegistro.getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (diferenciaDias > 10) {
              estadoFinal = "atrasado";
            }
          }

          const cedulaRegistro = p.registrado_por_cedula;
          const nombreEncontrado =
            cedulaRegistro && mapaNombres[cedulaRegistro]
              ? mapaNombres[cedulaRegistro]
              : cedulaRegistro || "Sistema";

          return {
            id: p.id,
            fecha_pago: p.fecha_pago,
            fecha_prestamo: prestamo.fecha_prestamo || null,
            cedula: prestamo.cedula || "N/A",
            monto_prestado: prestamo.monto_prestado || 0,
            monto_total: montoTotal,
            moneda_prestamo: prestamo.moneda || "COP",
            moneda_pago: p.moneda || "COP",
            tasa_interes: prestamo.tasa_interes || 0,
            saldo_pendiente: saldoCalculado,
            monto_pagado: Number(p.monto_pagado) || 0,
            total_pagado_acumulado: totalPagadoAcumulado,
            registrado_por_cedula: nombreEncontrado,
            metodo_pago: p.metodo_pago || "Efectivo",
            estadoTexto: estadoFinal,
            clientes: {
              nombres: cliente.nombres || "Sin nombre",
              apellidos: cliente.apellidos || "",
              telefono: cliente.telefono || "",
            },
          };
        });

        setTodosLosPagos(pagosFormateados);
        setPagosHabilesFiltrados(pagosFormateados);
      }
    } catch (err) {
      console.log("Error inesperado:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!busqueda.trim()) {
      setPagosHabilesFiltrados(todosLosPagos);
    } else {
      const texto = busqueda.toLowerCase();
      const resultado = todosLosPagos.filter((item) => {
        const nombres = item.clientes?.nombres?.toLowerCase() || "";
        const apellidos = item.clientes?.apellidos?.toLowerCase() || "";
        const totalPrestamo = item.monto_total?.toString() || "";
        const registradoPor = item.registrado_por_cedula?.toLowerCase() || "";

        return (
          nombres.includes(texto) ||
          apellidos.includes(texto) ||
          totalPrestamo.includes(texto) ||
          registradoPor.includes(texto)
        );
      });
      setPagosHabilesFiltrados(resultado);
    }
  }, [busqueda, todosLosPagos]);

  const verificarRolPermitido = async () => {
    try {
      setVerificandoAcceso(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || !user.email) {
        alert("No se encontró una sesión activa.");
        router.replace("/index");
        return;
      }

      const { data: adminData } = await supabase
        .from("administradores")
        .select("rol, correo")
        .eq("correo", user.email)
        .single();

      if (adminData) {
        setTienePermiso(true);
        cargarPagosYFiltrarSemana();
        return;
      }

      const { data: secretariaData } = await supabase
        .from("secretaria")
        .select("rol, correo, aprobado")
        .eq("correo", user.email)
        .single();

      if (secretariaData) {
        if (secretariaData.aprobado !== "aprobado") {
          alert("Tu cuenta de secretaria aún está pendiente de aprobación.");
          router.replace("/index");
          return;
        }
        setTienePermiso(true);
        cargarPagosYFiltrarSemana();
        return;
      }

      alert("Acceso exclusivo para administradores y secretarias.");
      router.replace("/index");
    } catch (err) {
      console.log("Error verificando permisos:", err);
      router.replace("/index");
    } finally {
      setVerificandoAcceso(false);
    }
  };

  useEffect(() => {
    verificarRolPermitido();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (tienePermiso) {
        cargarPagosYFiltrarSemana();
      }
      return undefined;
    }, [tienePermiso]),
  );

  const onRefresh = useCallback(async () => {
    await cargarPagosYFiltrarSemana(true);
  }, []);

  const abrirDetalles = (item: PagoItem) => {
    setPagoSeleccionado(item);
    setModalDetalleVisible(true);
  };

  const abrirEdicion = (item: PagoItem) => {
    setPagoAEditar(item);
    setMontoEditado(item.monto_pagado.toString());
    const fechaLimpia = item.fecha_pago ? item.fecha_pago.split("T")[0] : "";
    setFechaEditada(fechaLimpia);
    setModalEditarVisible(true);
  };

  const guardarEdicionPago = async () => {
    if (!pagoAEditar) return;

    const nuevoMonto = parseFloat(montoEditado);
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) {
      alert("Por favor ingrese un monto válido.");
      return;
    }

    const saldoPendienteActual = Number(pagoAEditar.saldo_pendiente);
    const montoPagadoActual = Number(pagoAEditar.monto_pagado);
    const maximoPermitido = saldoPendienteActual + montoPagadoActual;

    if (nuevoMonto > maximoPermitido) {
      setMensajeErrorValidacion({
        montoIngresado: nuevoMonto,
        saldoPendiente: saldoPendienteActual,
        montoPagadoActual: montoPagadoActual,
        maximoPermitido: maximoPermitido,
      });
      setModalErrorVisible(true);
      return;
    }

    try {
      setGuardandoEdicion(true);
      const { error } = await supabase
        .from("pagos")
        .update({
          monto_pagado: nuevoMonto,
          fecha_pago: fechaEditada
            ? `${fechaEditada}T00:00:00.000Z`
            : pagoAEditar.fecha_pago,
        })
        .eq("id", pagoAEditar.id);

      if (error) {
        alert("Error al actualizar el pago: " + error.message);
        return;
      }

      setModalEditarVisible(false);
      await cargarPagosYFiltrarSemana();
      setModalExitoVisible(true);
    } catch (err) {
      console.log("Error inesperado al editar:", err);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const descargarPDF = async () => {
    try {
      const htmlContent = `
        <html>
          <head>
          <title>Reporte General de cobros</title>
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
          <h2>Gestión de Préstamos</h2>
            <p class="subtitle">Control de cobros activos</p>
            <table>
              <thead>
                <tr>
                  <th>FECHA PAGO</th>
                  <th>CLIENTE</th>
                  <th>MONTO PRESTADO</th>
                  <th>MONEDA</th>
                  <th>INTERÉS</th>
                  <th>TOTAL PRÉSTAMO</th>
                  <th>SALDO PENDIENTE</th>
                  <th>PAGO ABONADO</th>
                  <th>MÉTODO</th>
                  <th>REGISTRADO POR</th>
                  <th>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                ${pagosHabilesFiltrados
                  .map(
                    (item) => `
                  <tr>
                    <td>${
                      item.fecha_pago
                        ? new Date(
                            item.fecha_pago.replace("Z", ""),
                          ).toLocaleDateString()
                        : "N/A"
                    }</td>
                    <td>${item.clientes ? `${item.clientes.nombres} ${item.clientes.apellidos}` : "Desconocido"} (${item.cedula})</td>
                    <td>${Number(item.monto_prestado || 0).toFixed(2)}</td>
                    <td>${item.moneda_pago || ""}</td>
                    <td>${item.tasa_interes || 0}%</td>
                    <td>${Number(item.monto_total || 0).toFixed(2)}</td>
                    <td>${Number(item.saldo_pendiente || 0).toFixed(2)}</td>
                    <td>${Number(item.monto_pagado || 0).toFixed(2)}</td>
                    <td>${item.metodo_pago || ""}</td>
                    <td>${item.registrado_por_cedula || ""}</td>
                    <td>${(item.estadoTexto || "activo").toUpperCase()}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        let ventanaImpresion = window.open("", "_blank");
        if (!ventanaImpresion) {
          alert("Permite las ventanas emergentes para generar el PDF.");
          return;
        }
        ventanaImpresion.document.write(htmlContent);
        ventanaImpresion.document.close();
        ventanaImpresion.focus();
        setTimeout(() => {
          ventanaImpresion.print();
        }, 500);
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, {
          UTI: ".pdf",
          mimeType: "application/pdf",
        });
      }
    } catch (error) {
      console.log("Error al exportar PDF:", error);
    }
  };

  const descargarExcel = async () => {
    if (!pagosHabilesFiltrados || pagosHabilesFiltrados.length === 0) {
      Alert.alert("Aviso", "No hay datos disponibles para exportar.");
      return;
    }

    try {
      const dataMapeada = pagosHabilesFiltrados.map((item) => ({
        "Fecha Pago": item.fecha_pago
          ? new Date(item.fecha_pago.replace("Z", "")).toLocaleDateString()
          : "N/A",
        Cliente: item.clientes
          ? `${item.clientes.nombres} ${item.clientes.apellidos}`
          : "Desconocido",
        "Monto Prestado": Number(item.monto_prestado || 0),
        "Moneda Pago": item.moneda_pago || "N/A",
        "Interés (%)": Number(item.tasa_interes || 0),
        "Total a Pagar": Number(item.monto_total || 0),
        "Saldo Pendiente": Number(item.saldo_pendiente || 0),
        "Monto Abonado (Pago)": Number(item.monto_pagado || 0),
        "Método Pago": item.metodo_pago || "N/A",
        "Registrado Por": item.registrado_por_cedula || "N/A",
        Estado: (item.estadoTexto || "activo").toUpperCase(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataMapeada);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");

      const nombreArchivo = `Reporte_Pagos_Activos_${new Date().toISOString().slice(0, 10)}.xlsx`;

      if (Platform.OS === "web") {
        XLSX.writeFile(workbook, nombreArchivo);
      } else {
        const excelBuffer = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "base64",
        });

        const fileUri = `${FileSystem.cacheDirectory}${nombreArchivo}`;

        await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Exportar Reporte de Pagos",
            UTI: "com.microsoft.excel.xlsx",
          });
        } else {
          Alert.alert("Éxito", `Archivo guardado en: ${fileUri}`);
        }
      }
    } catch (error: any) {
      console.log("Error al exportar Excel en móvil:", error);
      Alert.alert("Error", "No se pudo generar el archivo en el dispositivo.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.titleWrapper}>
          <Text style={styles.mainTitle}>Pagos - General</Text>
          <Text style={styles.subtitle}>
            Control de cobros registrados en el sistema
          </Text>
        </View>
        <View style={styles.exportButtonsContainer}>
          <TouchableOpacity style={styles.btnExcel} onPress={descargarExcel}>
            <Text style={styles.btnExcelText}>📥 Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPdf} onPress={descargarPDF}>
            <Text style={styles.btnPdfText}>📥 PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar por nombres, apellido, total préstamo o registrado por"
          placeholderTextColor="#94a3b8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
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
                <Text style={styles.headerText}>FECHA</Text>
              </View>
              <View style={[styles.gridCell, styles.colCliente]}>
                <Text style={styles.headerText}>CLIENTE</Text>
              </View>
              <View style={[styles.gridCell, styles.colMonto]}>
                <Text style={styles.headerText}>MONTO PRESTADO</Text>
              </View>
              <View style={[styles.gridCell, styles.colMoneda]}>
                <Text style={styles.headerText}>MONEDA</Text>
              </View>
              <View style={[styles.gridCell, styles.colPorcentaje]}>
                <Text style={styles.headerText}>INTERÉS</Text>
              </View>
              <View style={[styles.gridCell, styles.colTotal]}>
                <Text style={styles.headerText}>TOTAL PRÉSTAMO</Text>
              </View>
              <View style={[styles.gridCell, styles.colTotal]}>
                <Text style={styles.headerText}>SALDO PENDIENTE</Text>
              </View>
              <View style={[styles.gridCell, styles.colTotal]}>
                <Text style={styles.headerText}>PAGO ABONADO</Text>
              </View>
              <View style={[styles.gridCell, styles.colEmpleado]}>
                <Text style={styles.headerText}>REGISTRADO POR</Text>
              </View>
              <View style={[styles.gridCell, styles.colAccion]}>
                <Text style={styles.headerText}>ESTADO / ACCIÓN</Text>
              </View>
            </View>

            <FlatList
              data={pagosHabilesFiltrados}
              keyExtractor={(item, index) =>
                item.id?.toString() || index.toString()
              }
              ListEmptyComponent={
                loading ? (
                  <View style={{ padding: 30, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#0f172a" />
                    <Text style={{ marginTop: 8, color: "#64748b" }}>
                      Cargando pagos...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No se encontraron pagos con los criterios de búsqueda.
                    </Text>
                  </View>
                )
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#0f172a"]}
                />
              }
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              renderItem={({ item, index }) => {
                const nombreCliente = item.clientes
                  ? `${item.clientes.nombres} ${item.clientes.apellidos}`
                  : "Cliente desconocido";

                const fechaFormateada = formatearFechaLocal(item.fecha_pago);
                const estado = item.estadoTexto || "activo";

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
                        {Number(item.monto_prestado).toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.gridCell, styles.colMoneda]}>
                      <View style={styles.badgeMoneda}>
                        <Text style={styles.badgeMonedaText}>
                          {item.moneda_pago}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.gridCell, styles.colPorcentaje]}>
                      <Text style={styles.cellText}>{item.tasa_interes}%</Text>
                    </View>
                    <View style={[styles.gridCell, styles.colTotal]}>
                      <Text style={styles.cellTextBold}>
                        {Number(item.monto_total).toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.gridCell, styles.colTotal]}>
                      <Text style={[styles.cellTextBold, { color: "#dc2626" }]}>
                        {Number(item.saldo_pendiente).toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.gridCell, styles.colTotal]}>
                      <Text style={[styles.cellTextBold, { color: "#16a34a" }]}>
                        {Number(item.monto_pagado).toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.gridCell, styles.colEmpleado]}>
                      <Text style={styles.cellText} numberOfLines={1}>
                        {item.registrado_por_cedula || "Sistema"}
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
                        <Text style={styles.btnVerAccionText}>Detalles</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.btnVerAccion,
                          { backgroundColor: "#16a34a" },
                        ]}
                        onPress={() => abrirEdicion(item)}
                      >
                        <Text
                          style={[
                            styles.btnVerAccionText,
                            { color: "#ffffff" },
                          ]}
                        >
                          Editar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </ScrollView>
      </View>

      {/* MODAL DE DETALLES MODERNO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalDetalleVisible}
        onRequestClose={() => setModalDetalleVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentModern}>
            <View style={styles.modalHeaderModern}>
              <View>
                <Text style={styles.modalTitleModern}>Detalles del Pago</Text>
                <Text style={styles.modalSubtitleModern}>
                  Información completa de la transacción
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalDetalleVisible(false)}
                style={styles.closeIconBtnModern}
              >
                <Text style={styles.closeIconTextModern}>✕</Text>
              </TouchableOpacity>
            </View>

            {pagoSeleccionado && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 380 }}
              >
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Cliente:</Text>
                  <Text style={styles.modalValueBoldModern}>
                    {pagoSeleccionado.clientes?.nombres}{" "}
                    {pagoSeleccionado.clientes?.apellidos}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Cédula:</Text>
                  <Text style={styles.modalValueModern}>
                    {pagoSeleccionado.cedula}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Fecha de Pago:</Text>
                  <Text style={styles.modalValueModern}>
                    {formatearFechaLocal(pagoSeleccionado.fecha_pago)}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Monto Abonado:</Text>
                  <Text
                    style={[styles.modalValueBoldModern, { color: "#16a34a" }]}
                  >
                    {Number(pagoSeleccionado.monto_pagado || 0).toFixed(2)}{" "}
                    {pagoSeleccionado.moneda_pago}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Saldo Pendiente:</Text>
                  <Text
                    style={[styles.modalValueBoldModern, { color: "#dc2626" }]}
                  >
                    {Number(pagoSeleccionado.saldo_pendiente || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Total Préstamo:</Text>
                  <Text style={styles.modalValueModern}>
                    {Number(pagoSeleccionado.monto_total || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Método de Pago:</Text>
                  <Text style={styles.modalValueModern}>
                    {pagoSeleccionado.metodo_pago}
                  </Text>
                </View>
                <View style={styles.modalRowModern}>
                  <Text style={styles.modalLabelModern}>Registrado por:</Text>
                  <Text style={styles.modalValueModern}>
                    {pagoSeleccionado.registrado_por_cedula}
                  </Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.btnEntendidoError}
              onPress={() => setModalDetalleVisible(false)}
            >
              <Text style={styles.btnEntendidoTextError}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EDICIÓN DE PAGO MODERNO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalEditarVisible}
        onRequestClose={() => setModalEditarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentModern}>
            <View style={styles.modalHeaderModern}>
              <View>
                <Text style={styles.modalTitleModern}>Editar Pago</Text>
                <Text style={styles.modalSubtitleModern}>
                  Modifica los datos del abono
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalEditarVisible(false)}
                style={styles.closeIconBtnModern}
              >
                <Text style={styles.closeIconTextModern}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroupModern}>
                <Text style={styles.inputLabelModern}>💵 Monto Abonado</Text>
                <TextInput
                  style={styles.inputModalModern}
                  value={montoEditado}
                  onChangeText={setMontoEditado}
                  keyboardType="numeric"
                  placeholder="Ej: 50000"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroupModern}>
                <Text style={styles.inputLabelModern}>
                  📅 Fecha del Pago (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.inputModalModern}
                  value={fechaEditada}
                  onChangeText={setFechaEditada}
                  placeholder="Ej: 2026-09-27"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooterModern}>
              <TouchableOpacity
                style={styles.btnCancelarModern}
                onPress={() => setModalEditarVisible(false)}
              >
                <Text style={styles.btnCancelarTextModern}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGuardarModern}
                onPress={guardarEdicionPago}
                disabled={guardandoEdicion}
              >
                <Text style={styles.btnGuardarTextModern}>
                  {guardandoEdicion ? "Guardando..." : "Guardar Cambios"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ERROR DE VALIDACIÓN */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalErrorVisible}
        onRequestClose={() => setModalErrorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentError}>
            <View style={styles.errorIconContainer}>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
            </View>
            <Text style={styles.modalTitleError}>Monto Excedido</Text>
            <Text style={styles.modalTextError}>
              El monto ingresado supera el saldo pendiente máximo permitido (
              {mensajeErrorValidacion.maximoPermitido.toFixed(2)}).
            </Text>
            <TouchableOpacity
              style={styles.btnEntendidoError}
              onPress={() => setModalErrorVisible(false)}
            >
              <Text style={styles.btnEntendidoTextError}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalExitoVisible}
        onRequestClose={() => setModalExitoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSuccess}>
            <View style={styles.successIconContainer}>
              <Text style={{ fontSize: 28 }}>✅</Text>
            </View>
            <Text style={styles.modalTitleSuccess}>
              ¡Actualizado con Éxito!
            </Text>
            <Text style={styles.modalTextSuccess}>
              El pago ha sido modificado correctamente en el sistema.
            </Text>
            <TouchableOpacity
              style={styles.btnAceptarSuccess}
              onPress={() => setModalExitoVisible(false)}
            >
              <Text style={styles.btnAceptarTextSuccess}>Aceptar</Text>
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
  headerContainer: {
    marginBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  titleWrapper: {
    flex: 1,
    minWidth: 250,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  exportButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  btnExcel: {
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnExcelText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  btnPdf: {
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnPdfText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    color: "#0f172a",
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  horizontalScrollContent: {
    minWidth: 1300,
    flexGrow: 1,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
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
    fontSize: 12,
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
  colFecha: { width: 110 },
  colCliente: { flex: 1, minWidth: 180 },
  colMonto: { width: 140 },
  colMoneda: { width: 90 },
  colPorcentaje: { width: 100 },
  colTotal: { width: 130 },
  colEmpleado: { width: 140 },
  colAccion: { width: 220, flexDirection: "row", alignItems: "center", gap: 6 },
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
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnVerAccionText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
  },
  // ESTILOS MODERNOS PARA MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContentModern: {
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
  modalHeaderModern: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  modalTitleModern: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitleModern: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeIconBtnModern: {
    backgroundColor: "#f1f5f9",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconTextModern: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748b",
  },
  modalRowModern: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  modalLabelModern: {
    fontSize: 14,
    color: "#64748b",
  },
  modalValueModern: {
    fontSize: 14,
    color: "#1e293b",
  },
  modalValueBoldModern: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  inputGroupModern: {
    marginBottom: 16,
  },
  inputLabelModern: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  inputModalModern: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    fontSize: 15,
  },
  modalFooterModern: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  btnCancelarModern: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelarTextModern: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 15,
  },
  btnGuardarModern: {
    flex: 1.2,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGuardarTextModern: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  modalContentError: {
    width: "90%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
  },
  errorIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff1f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleError: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalTextError: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnEntendidoError: {
    width: "100%",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnEntendidoTextError: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  modalContentSuccess: {
    width: "90%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
  },
  successIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleSuccess: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalTextSuccess: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnAceptarSuccess: {
    width: "100%",
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnAceptarTextSuccess: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
