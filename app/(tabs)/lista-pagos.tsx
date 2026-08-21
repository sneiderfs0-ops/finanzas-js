import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system";

interface PagoItem {
  id: string;
  fecha_pago: string;
  cedula: string;
  monto_prestado: number;
  monto_total: number;
  moneda_prestamo: string;
  moneda_pago: string;
  tasa_interes: number;
  saldo_pendiente: number;
  monto_pagado: number;
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

  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoItem | null>(
    null,
  );
  const router = useRouter();

  useEffect(() => {
    verificarRolPermitido();
  }, []);

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

      // 1. Verificar administradores
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

      // 2. Verificar secretarias
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

  const cargarPagosYFiltrarSemana = async () => {
    try {
      setLoading(true);

      // 1. Cargar pagos junto con los datos del préstamo y el cliente
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
            clientes (
              nombres,
              apellidos,
              telefono
            )
          )
        `,
        )
        .order("fecha_pago", { ascending: false });

      if (error) {
        console.log("Error al cargar pagos:", error.message);
        setPagosHabilesFiltrados([]);
        return;
      }

      if (data) {
        // 2. Consultar listas de personal para mapear nombres por cédula de forma rápida
        const [adminsRes, empleadosRes, secretariasRes] = await Promise.all([
          supabase.from("administradores").select("cedula, nombres, apellidos"),
          supabase.from("empleados").select("cedula, nombres, apellidos"),
          supabase.from("secretaria").select("cedula, nombres, apellidos"),
        ]);

        // Crear un diccionario rápido de cédula -> Nombre Completo
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

        const hoy = new Date();

        const pagosFormateados: PagoItem[] = data.map((p: any) => {
          const prestamo = p.prestamos || {};
          const cliente = prestamo.clientes || {};

          const montoTotal = prestamo.monto_total || 0;
          const montoPagado = p.monto_pagado || 0;

          // Cálculo correcto del saldo pendiente
          const saldoCalculado = Math.max(0, montoTotal - montoPagado);

          // Determinación dinámica del estado (activo, pagado, atrasado > 10 días)
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

          // Buscar el nombre del empleado/personal usando la cédula registrada
          const cedulaRegistro = p.registrado_por_cedula;
          const nombreEncontrado =
            cedulaRegistro && mapaNombres[cedulaRegistro]
              ? mapaNombres[cedulaRegistro]
              : cedulaRegistro || "Sistema";

          return {
            id: p.id,
            fecha_pago: p.fecha_pago,
            cedula: prestamo.cedula || "N/A",
            monto_prestado: prestamo.monto_prestado || 0,
            monto_total: montoTotal,
            moneda_prestamo: prestamo.moneda || "COP",
            moneda_pago: p.moneda || "COP",
            tasa_interes: prestamo.tasa_interes || 0,
            saldo_pendiente: saldoCalculado,
            monto_pagado: montoPagado,
            registrado_por_cedula: nombreEncontrado, // <--- Ahora muestra el nombre completo del empleado/admin/secretaria
            metodo_pago: p.metodo_pago || "Efectivo",
            estadoTexto: estadoFinal,
            clientes: {
              nombres: cliente.nombres || "Sin nombre",
              apellidos: cliente.apellidos || "",
              telefono: cliente.telefono || "",
            },
          };
        });

        filtrarLunesALunes(pagosFormateados);
      }
    } catch (err) {
      console.log("Error inesperado:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtrarLunesALunes = (listaPagos: PagoItem[]) => {
    const hoy = new Date();
    const fechaLimite = new Date();
    fechaLimite.setDate(hoy.getDate() - 7);
    fechaLimite.setHours(0, 0, 0, 0);

    const filtrados = listaPagos.filter((item) => {
      if (!item.fecha_pago) return false;
      const fechaItem = new Date(item.fecha_pago.replace("Z", ""));
      return fechaItem >= fechaLimite && fechaItem <= hoy;
    });

    setPagosHabilesFiltrados(filtrados);
  };

  const abrirDetalles = (item: PagoItem) => {
    setPagoSeleccionado(item);
    setModalDetalleVisible(true);
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
            <p class="subtitle">Control de cobros (Últimos 7 días)</p>
            <table>
              <thead>
                <tr>
                  <th>FECHA</th>
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
                    <td>${item.fecha_pago ? new Date(item.fecha_pago.replace("Z", "")).toLocaleDateString() : "N/A"}</td>
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
        Fecha: item.fecha_pago
          ? new Date(item.fecha_pago.replace("Z", "")).toLocaleDateString()
          : "N/A",
        Cliente: item.clientes
          ? `${item.clientes.nombres} ${item.clientes.apellidos}`
          : "Desconocido",
        Cédula: item.cedula,
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
        XLSX.writeFile(workbook, "Reporte_Pagos_Semana.xlsx");
      } else {
        const fileUri = `${FileSystem.documentDirectory}Reporte_Pagos_Semana.xlsx`;
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
      {/* CABECERA Y BOTONES DE EXPORTACIÓN */}
      <View style={styles.headerContainer}>
        <View style={styles.titleWrapper}>
          <Text style={styles.mainTitle}>Pagos - Últimos 7 Días</Text>
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
            >
              <View style={styles.tableInnerWrapper}>
                {/* CABECERA DE LA TABLA */}
                <View style={[styles.gridRow, styles.gridHeader]}>
                  <View style={[styles.gridCell, styles.colFecha]}>
                    <Text style={styles.headerText}>FECHA</Text>
                  </View>
                  <View style={[styles.gridCell, styles.colCliente]}>
                    <Text style={styles.headerText}>CLIENTE / CÉDULA</Text>
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

                {/* FILAS DE LA TABLA */}
                {pagosHabilesFiltrados.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No se encontraron pagos registrados en este periodo.
                    </Text>
                  </View>
                ) : (
                  pagosHabilesFiltrados.map((item, index) => {
                    const nombreCliente = item.clientes
                      ? `${item.clientes.nombres} ${item.clientes.apellidos}`
                      : "Cliente desconocido";
                    const fechaFormateada = item.fecha_pago
                      ? new Date(
                          item.fecha_pago.replace("Z", ""),
                        ).toLocaleDateString()
                      : "N/A";
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
                          {/*  <Text style={styles.subCedula}>{item.cedula}</Text>*/}
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
                {/*   <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Cédula:</Text>
                  <Text style={styles.modalVal}>{pagoSeleccionado.cedula}</Text>
                </View>*/}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Fecha de Pago:</Text>
                  <Text style={styles.modalVal}>
                    {new Date(
                      pagoSeleccionado.fecha_pago.replace("Z", ""),
                    ).toLocaleDateString()}
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
                  <Text style={styles.modalLabel}>Monto Abonado (Pago):</Text>
                  <Text style={[styles.modalVal, { color: "#16a34a" }]}>
                    {Number(pagoSeleccionado.monto_pagado).toFixed(2)}
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
  subCedula: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontStyle: "italic",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 450,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#64748b",
  },
  modalBody: {
    gap: 12,
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    paddingBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  modalVal: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  modalAcceptBtn: {
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalAcceptBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
