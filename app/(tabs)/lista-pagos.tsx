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
  TextInput, // NUEVO: Importado para el input de edición
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
  const [loading, setLoading] = useState(true);
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [tienePermiso, setTienePermiso] = useState(false);
  const [pagosHabilesFiltrados, setPagosHabilesFiltrados] = useState<
    PagoItem[]
  >([]);

  // NUEVO ESTADO PARA EL FILTRO DE BÚSQUEDA
  const [busqueda, setBusqueda] = useState("");
  const [todosLosPagos, setTodosLosPagos] = useState<PagoItem[]>([]);

  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoItem | null>(
    null,
  );

  // NUEVOS ESTADOS PARA LA EDICIÓN
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [pagoAEditar, setPagoAEditar] = useState<PagoItem | null>(null);
  const [montoEditado, setMontoEditado] = useState("");
  const [fechaEditada, setFechaEditada] = useState("");

  const [modalExitoVisible, setModalExitoVisible] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const cargarPagosYFiltrarSemana = async () => {
    try {
      setLoading(true);

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
        // ORDENAMIENTO CLAVE: Ordena por fecha descendente y luego por ID descendente para asegurar el último registro exacto del día
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

        const filtrados = pagosFormateados.filter(
          (item) => item.saldo_pendiente > 0,
        );
        setTodosLosPagos(filtrados);
        setPagosHabilesFiltrados(filtrados);
      }
    } catch (err) {
      console.log("Error inesperado:", err);
    } finally {
      setLoading(false);
    }
  };

  // EFECTO PARA FILTRAR EN TIEMPO REAL SEGÚN EL INPUT DE BÚSQUEDA
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
        router.replace("/home");
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
          router.replace("/home");
          return;
        }
        setTienePermiso(true);
        cargarPagosYFiltrarSemana();
        return;
      }

      alert("Acceso exclusivo para administradores y secretarias.");
      router.replace("/home");
    } catch (err) {
      console.log("Error verificando permisos:", err);
      router.replace("/home");
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
    setRefreshing(true);
    await cargarPagosYFiltrarSemana();
    setRefreshing(false);
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

  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [mensajeErrorValidacion, setMensajeErrorValidacion] = useState({
    montoIngresado: 0,
    saldoPendiente: 0,
    montoPagadoActual: 0,
    maximoPermitido: 0,
  });

  // Reemplaza el alert dentro de guardarEdicionPago por esto:
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
      setLoading(true);
      const { error } = await supabase
        .from("pagos")
        .update({
          monto_pagado: nuevoMonto,
          fecha_pago: fechaEditada
            ? new Date(fechaEditada).toISOString()
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
      setLoading(false);
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
                    <td>{formatearFechaLocal(item.fecha_pago)}</td>
                    <td>${item.clientes ? `${item.clientes.nombres} ${item.clientes.apellidos}` : "Desconocido"} (${item.cedula})</td>
                    <td>${Number(item.monto_prestado).toFixed(2)}</td>
                    <td>${item.moneda_pago}</td>
                    <td>${item.tasa_interes}%</td>
                    <td>${Number(item.monto_total).toFixed(2)}</td>
                    <td>${Number(item.saldo_pendiente).toFixed(2)}</td>
                    <td>${Number(item.monto_pagado).toFixed(2)}</td>
                    <td>${item.metodo_pago}</td>
                    <td>${item.registrado_por_cedula}</td>
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
    try {
      const dataMapeada = pagosHabilesFiltrados.map((item) => ({
        "Fecha Pago": item.fecha_pago
          ? new Date(item.fecha_pago.replace("Z", "")).toLocaleDateString()
          : "N/A",
        Cliente: item.clientes
          ? `${item.clientes.nombres} ${item.clientes.apellidos}`
          : "Desconocido",
        "Monto Prestado": Number(item.monto_prestado),
        "Moneda Pago": item.moneda_pago,
        "Interés (%)": item.tasa_interes,
        "Total a Pagar": Number(item.monto_total),
        "Saldo Pendiente": Number(item.saldo_pendiente),
        "Monto Abonado (Pago)": Number(item.monto_pagado),
        "Método Pago": item.metodo_pago,
        "Registrado Por": item.registrado_por_cedula,
        Estado: (item.estadoTexto || "activo").toUpperCase(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataMapeada);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "base64",
      });

      if (Platform.OS === "web") {
        XLSX.writeFile(workbook, "Reporte_Pagos_Activos.xlsx");
      } else {
        const fileUri = `${FileSystem.documentDirectory}Reporte_Pagos_Activos.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, excelBuffer, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
    } catch (error) {
      console.log("Error al exportar Excel:", error);
    }
  };

  if (verificandoAcceso || !tienePermiso) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={{ marginTop: 10, color: "#64748b" }}>
          Verificando permisos de acceso...
        </Text>
      </View>
    );
  }

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
            <Text style={styles.btnExcelText}>📥 Descargar Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPdf} onPress={descargarPDF}>
            <Text style={styles.btnPdfText}>📥 Descargar PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* NUEVO INPUT DE BÚSQUEDA */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar por nombres, apellido, total préstamo o registrado por"
          placeholderTextColor="#94a3b8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
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
              contentContainerStyle={{ flexGrow: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#0f172a"]}
                />
              }
            >
              <View style={styles.tableInnerWrapper}>
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

                {pagosHabilesFiltrados.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No se encontraron pagos con los criterios de búsqueda.
                    </Text>
                  </View>
                ) : (
                  pagosHabilesFiltrados.map((item, index) => {
                    const nombreCliente = item.clientes
                      ? `${item.clientes.nombres} ${item.clientes.apellidos}`
                      : "Cliente desconocido";

                    const fechaFormateada = formatearFechaLocal(
                      item.fecha_pago,
                    );
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
                        <View style={[styles.gridCell, styles.colTotal]}>
                          <Text
                            style={[styles.cellTextBold, { color: "#16a34a" }]}
                          >
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
                            <Text style={styles.btnVerAccionText}>
                              Detalles
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.btnVerAccion,
                              { backgroundColor: "#269c4b" },
                            ]}
                            onPress={() => abrirEdicion(item)}
                          >
                            <Text
                              style={[
                                styles.btnVerAccionText,
                                { color: "#0e1c12" },
                              ]}
                            >
                              Editar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      )}

      {/* MODAL DE DETALLES */}
      <Modal
        visible={modalDetalleVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalDetalleVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Detalles del Cobro Registrado
              </Text>
              <TouchableOpacity
                onPress={() => setModalDetalleVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {pagoSeleccionado && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cliente:</Text>
                  <Text style={styles.modalVal}>
                    {pagoSeleccionado.clientes?.nombres}{" "}
                    {pagoSeleccionado.clientes?.apellidos}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Fecha del Préstamo:</Text>
                  <Text style={styles.modalVal}>
                    {formatearFechaLocal(pagoSeleccionado.fecha_prestamo)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Fecha de Pago:</Text>
                  <Text style={styles.modalVal}>
                    {formatearFechaLocal(pagoSeleccionado.fecha_pago)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Monto Prestado:</Text>
                  <Text style={styles.modalVal}>
                    {Number(pagoSeleccionado.monto_prestado).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Moneda de Pago:</Text>
                  <Text style={styles.modalVal}>
                    {pagoSeleccionado.moneda_pago}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Tasa de Interés:</Text>
                  <Text style={styles.modalVal}>
                    {pagoSeleccionado.tasa_interes}%
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Total del Préstamo:</Text>
                  <Text style={styles.modalVal}>
                    {Number(pagoSeleccionado.monto_total).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Saldo Pendiente:</Text>
                  <Text style={[styles.modalVal, { color: "#dc2626" }]}>
                    {Number(pagoSeleccionado.saldo_pendiente).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>
                    Monto Abonado (Esta Cuota):
                  </Text>
                  <Text style={[styles.modalVal, { color: "#2563eb" }]}>
                    {Number(pagoSeleccionado.monto_pagado).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Total Acumulado Pagado:</Text>
                  <Text
                    style={[
                      styles.modalVal,
                      { color: "#16a34a", fontWeight: "bold" },
                    ]}
                  >
                    {Number(pagoSeleccionado.total_pagado_acumulado).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Método de Pago:</Text>
                  <Text style={styles.modalVal}>
                    {pagoSeleccionado.metodo_pago}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Registrado Por:</Text>
                  <Text style={styles.modalVal}>
                    {pagoSeleccionado.registrado_por_cedula}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Estado del Préstamo:</Text>
                  <Text style={styles.modalVal}>
                    {(pagoSeleccionado.estadoTexto || "activo").toUpperCase()}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnCloseModal}
                onPress={() => setModalDetalleVisible(false)}
              >
                <Text style={styles.btnCloseModalText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EDICIÓN */}
      <Modal
        visible={modalEditarVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalEditarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Pago / Abono</Text>
              <TouchableOpacity
                onPress={() => setModalEditarVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.modalLabel}>Editar Monto Abonado:</Text>
                <TextInput
                  style={styles.inputEdit}
                  keyboardType="numeric"
                  value={montoEditado}
                  onChangeText={setMontoEditado}
                  placeholder="Ej: 50000"
                />
              </View>

              <View style={{ marginBottom: 15 }}>
                <Text style={styles.modalLabel}>Nueva Fecha (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.inputEdit}
                  value={fechaEditada}
                  onChangeText={setFechaEditada}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <TouchableOpacity
                style={styles.btnGuardarEdicion}
                onPress={guardarEdicionPago}
              >
                <Text style={styles.btnGuardarEdicionText}>
                  Guardar Cambios
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO PERSONALIZADO */}
      <Modal
        visible={modalExitoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalExitoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.successModalContainer]}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>¡Éxito!</Text>
            <Text style={styles.successMessage}>
              Pago actualizado correctamente.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setModalExitoVisible(false)}
            >
              <Text style={styles.successButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Error de Monto Personalizado */}
      <Modal
        visible={modalErrorVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalErrorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Monto Excedido</Text>
              <TouchableOpacity onPress={() => setModalErrorVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={48} color="#e74c3c" />
              </View>

              <Text style={styles.errorTextDescription}>
                El monto ingresado{" "}
                <Text style={styles.boldText}>
                  ({mensajeErrorValidacion.montoIngresado.toLocaleString()})
                </Text>{" "}
                supera el límite permitido para este préstamo.
              </Text>

              <View style={styles.detalleContainer}>
                <View style={styles.detalleRow}>
                  <Text style={styles.detalleLabel}>Monto pagado del día:</Text>
                  <Text style={styles.detalleValue}>
                    {mensajeErrorValidacion.montoPagadoActual.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detalleRow}>
                  <Text style={styles.detalleLabel}>
                    Saldo pendiente actual:
                  </Text>
                  <Text style={styles.detalleValue}>
                    {mensajeErrorValidacion.saldoPendiente.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.detalleRow, styles.detalleRowTotal]}>
                  <Text style={styles.detalleLabelTotal}>
                    Monto completo a pagar del prestamo:
                  </Text>
                  <Text style={styles.detalleValueTotal}>
                    {mensajeErrorValidacion.maximoPermitido.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.botonEntendido}
                onPress={() => setModalErrorVisible(false)}
              >
                <Text style={styles.botonEntendidoText}>Entendido</Text>
              </TouchableOpacity>
            </View>
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
    ...(Platform.OS === "web"
      ? { width: "100%", display: "flex", flex: 1 }
      : {}),
  },
  horizontalScrollContent: {
    minWidth: 1300,
    flexGrow: 1,
  },
  tableInnerWrapper: {
    flexDirection: "column",
    width: "100%",
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
    fontWeight: "600",
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
  colPorcentaje: { width: 130 },
  colTotal: { width: 130 },
  colEmpleado: { width: 140 },
  colAccion: { width: 200, flexDirection: "row", alignItems: "center", gap: 6 }, // Ampliado ligeramente para acomodar ambos botones
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 450,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#64748b",
  },
  modalBody: {
    maxHeight: 400,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  modalLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  modalVal: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  btnCloseModal: {
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnCloseModalText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  inputEdit: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 15,
  },
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
  btnGuardarEdicion: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnGuardarEdicionText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  // ESTILOS ESPECÍFICOS PARA EL MODAL DE ÉXITO
  successModalContainer: {
    width: 320,
    padding: 24,
    alignItems: "center",
  },
  successIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
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
    colPorcentaje: { width: 130 },
    colTotal: { width: 130 },
    colEmpleado: { width: 140 },
    colAccion: {
      width: 250,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    }, // Ampliado ligeramente para acomodar ambos botones
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
    emptyContainer: {
      padding: 24,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      color: "#64748b",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#f1f5f9",
      paddingBottom: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#0f172a",
    },
    closeBtn: {
      padding: 4,
    },
    closeBtnText: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#64748b",
    },
    modalBody: {
      maxHeight: 400,
    },
    modalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#f8fafc",
    },
    modalLabel: {
      fontSize: 14,
      color: "#64748b",
      fontWeight: "500",
    },
    modalVal: {
      fontSize: 14,
      color: "#0f172a",
      fontWeight: "600",
    },
    modalFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 15,
      borderTopWidth: 1,
      borderTopColor: "#f1f5f9",
      paddingTop: 10,
    },
    btnCloseModal: {
      backgroundColor: "#0f172a",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    btnCloseModalText: {
      color: "#ffffff",
      fontWeight: "bold",
      fontSize: 14,
    },
    inputEdit: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: "#0f172a",
      backgroundColor: "#f8fafc",
      marginTop: 4,
    },
    marginBottom: 15,
  },
  successIconText: {
    color: "#16a34a",
    fontSize: 24,
    fontWeight: "bold",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 5,
  },
  successMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  successButton: {
    backgroundColor: "#16a34a",
    width: "100%",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  successButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  // modal
  errorIconContainer: {
    marginBottom: 12,
    alignItems: "center",
  },
  errorTextDescription: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 16,
  },
  boldText: {
    fontWeight: "bold",
    color: "#e74c3c",
  },
  detalleContainer: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  detalleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detalleLabel: {
    fontSize: 13,
    color: "#666",
  },
  detalleValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#151c44",
  },
  detalleRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 8,
    marginBottom: 0,
  },
  detalleLabelTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000000",
  },
  detalleValueTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#e74c3c",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "flex-end",
  },
  botonEntendido: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    width: "100%",
    alignItems: "center",
  },
  botonEntendidoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
