import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";
import { obtenerFechaHoraExactaVenezuela } from "../../utils/fechas";

interface CajaOption {
  id: string;
  nombre: string;
  moneda: string;
}

interface Cliente {
  cedula: string;
  nombres: string;
  apellidos: string;
  registrado_por_cedula?: string;
  ruta_id?: string;
}

interface Prestamo {
  id: string;
  cedula: string;
  moneda: "USD" | "COP";
  monto_total: number;
  saldo_pendiente: number;
  valor_cuota: number;
  frecuencia: string;
  cuotas: number;
  estado: string;
  fecha_inicio: string;
  monto_prestado?: number;
  fecha_prestamo?: string;
  proxima_cuota?: string;
}

interface PagoHoyInfo {
  prestamo_id: string;
  monto_pagado: number;
  moneda?: "USD" | "COP";
  moneda_pago?: "USD" | "COP";
}

export default function CrearPagoScreen({ route }: any) {
  const clienteCedulaParam = route?.params?.clienteCedula || null;
  const { width } = useWindowDimensions();
  const isWebOrTablet = width >= 768;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosLosPrestamos, setTodosLosPrestamos] = useState<Prestamo[]>([]);
  const [pagosHoy, setPagosHoy] = useState<PagoHoyInfo[]>([]);
  const [cajas, setCajas] = useState<CajaOption[]>([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(
    clienteCedulaParam,
  );
  const [prestamoSeleccionado, setPrestamoSeleccionado] =
    useState<Prestamo | null>(null);

  // Filtros de la vista principal
  const [nombreBusqueda, setNombreBusqueda] = useState("");
  const [filtroFrecuencia, setFiltroFrecuencia] = useState<
    "Todas" | "diario" | "semanal" | "mensual"
  >("Todas");

  // Modales
  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [modalTasaVisible, setModalTasaVisible] = useState(false);
  const [modalResultadoVisible, setModalResultadoVisible] = useState(false);
  const [tipoResultado, setTipoResultado] = useState<"exito" | "error">(
    "exito",
  );
  const [mensajeResultado, setMensajeResultado] = useState("");

  // Estados del formulario de pago
  const [montoFisico, setMontoFisico] = useState("");
  const [monedaPrestamo, setMonedaPrestamo] = useState<"USD" | "COP">("COP");
  const [monedaPago, setMonedaPago] = useState<"USD" | "COP">("COP");
  const [tasaCambioCopPorUsd, setTasaCambioCopPorUsd] = useState("4100");
  const [tasaInputTemp, setTasaInputTemp] = useState("");

  // ESTADOS PARA FECHA MANUAL (Solo Administrador)
  const [usarFechaManual, setUsarFechaManual] = useState(false);
  const [fechaManual, setFechaManual] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [loading, setLoading] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  const guardandoRef = useRef(false);

  const [usuarioActual, setUsuarioActual] = useState<{
    id: string;
    cedula: string;
    nombreCompleto: string;
    tipo: string;
  } | null>(null);

  const fechaHoyStr = obtenerFechaHoraExactaVenezuela().split("T")[0];

  useEffect(() => {
    obtenerUsuarioLogueadoYCargarDatos();
  }, []);

  const obtenerUsuarioLogueadoYCargarDatos = async () => {
    setCargandoLista(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const emailLogueado = authData.user?.email?.trim().toLowerCase();

      if (!userId && !emailLogueado) {
        mostrarMensaje("error", "No hay una sesión activa en el sistema.");
        setCargandoLista(false);
        return;
      }

      let usuarioInfo: any = null;

      let queryAdmin = supabase
        .from("administradores")
        .select("id, cedula, nombres, apellidos");
      if (userId) queryAdmin = queryAdmin.eq("id", userId);
      else if (emailLogueado)
        queryAdmin = queryAdmin.eq("correo", emailLogueado);
      const { data: adminData } = await queryAdmin.maybeSingle();

      if (adminData) {
        usuarioInfo = {
          id: adminData.id,
          cedula: adminData.cedula,
          nombreCompleto: `${adminData.nombres} ${adminData.apellidos}`,
          tipo: "Administrador",
        };
      }

      if (!usuarioInfo) {
        let querySec = supabase
          .from("secretaria")
          .select("id, cedula, nombres, apellidos");
        if (userId) querySec = querySec.eq("id", userId);
        else if (emailLogueado) querySec = querySec.eq("correo", emailLogueado);
        const { data: secData } = await querySec.maybeSingle();
        if (secData) {
          usuarioInfo = {
            id: secData.id,
            cedula: secData.cedula,
            nombreCompleto: `${secData.nombres} ${secData.apellidos}`,
            tipo: "Secretaria",
          };
        }
      }

      if (!usuarioInfo) {
        let queryEmp = supabase
          .from("empleados")
          .select("id, cedula, nombres, apellidos");
        if (userId) queryEmp = queryEmp.eq("id", userId);
        else if (emailLogueado) queryEmp = queryEmp.eq("correo", emailLogueado);
        const { data: empData } = await queryEmp.maybeSingle();
        if (empData) {
          usuarioInfo = {
            id: empData.id,
            cedula: empData.cedula,
            nombreCompleto: `${empData.nombres} ${empData.apellidos}`,
            tipo: "Empleado",
          };
        }
      }

      if (!usuarioInfo || !usuarioInfo.cedula) {
        mostrarMensaje(
          "error",
          "No se pudo identificar qué usuario está realizando el registro.",
        );
        setCargandoLista(false);
        return;
      }

      setUsuarioActual(usuarioInfo);
      await cargarCajas();
      const listaClientes = await cargarClientes(usuarioInfo);
      await cargarPrestamosActivosYPagosHoy(listaClientes);
    } catch (err) {
      console.log("Error obteniendo usuario actual:", err);
      mostrarMensaje(
        "error",
        "Error de conexión al verificar los datos del usuario.",
      );
    } finally {
      setCargandoLista(false);
    }
  };

  const cargarCajas = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda");
    if (data) setCajas(data);
  };

  const cargarClientes = async (infoUsuario: {
    id: string;
    cedula: string;
    tipo: string;
  }): Promise<Cliente[]> => {
    let query = supabase
      .from("clientes")
      .select("cedula, nombres, apellidos, registrado_por_cedula, ruta_id")
      .order("nombres");

    if (infoUsuario.tipo === "Empleado") {
      const { data: rutasAsignadas, error: errorRutas } = await supabase
        .from("empleado_rutas")
        .select("ruta_id")
        .eq("empleado_id", infoUsuario.id);

      if (errorRutas || !rutasAsignadas || rutasAsignadas.length === 0) {
        setClientes([]);
        return [];
      }

      const idsRutas = rutasAsignadas.map((r) => r.ruta_id);
      query = query.in("ruta_id", idsRutas);
    }

    const { data, error } = await query;
    if (!error && data) {
      setClientes(data);
      if (clienteCedulaParam) {
        const cliParam = data.find((c) => c.cedula === clienteCedulaParam);
        if (cliParam) {
          setNombreBusqueda(`${cliParam.nombres} ${cliParam.apellidos}`);
        }
      }
      return data;
    } else {
      setClientes([]);
      return [];
    }
  };

  const cargarPrestamosActivosYPagosHoy = async (listaClientes: Cliente[]) => {
    if (listaClientes.length === 0) {
      setTodosLosPrestamos([]);
      setPagosHoy([]);
      return;
    }

    const cedulas = listaClientes.map((c) => c.cedula);

    const { data: prestamosData, error } = await supabase
      .from("prestamos")
      .select("*")
      .in("cedula", cedulas)
      .eq("estado", "activo")
      .order("fecha_prestamo", { ascending: true });

    if (!error && prestamosData) {
      setTodosLosPrestamos(prestamosData);
    } else {
      setTodosLosPrestamos([]);
    }

    const { data: pagosData } = await supabase
      .from("pagos")
      .select("prestamo_id, monto_pagado, moneda, moneda_pago, fecha_pago")
      .gte("fecha_pago", `${fechaHoyStr}T00:00:00`)
      .lte("fecha_pago", `${fechaHoyStr}T23:59:59`);

    if (pagosData) {
      setPagosHoy(pagosData);
    }
  };

  const abrirModalPago = async (prestamo: Prestamo) => {
    setClienteSeleccionado(prestamo.cedula);
    setPrestamoSeleccionado(prestamo);
    setMonedaPrestamo(prestamo.moneda);
    setMonedaPago(prestamo.moneda);
    setMontoFisico("");
    setModalPagoVisible(true);

    if (usuarioActual?.id) {
      try {
        await supabase.rpc("guardar_ultima_preferencia_cliente", {
          p_usuario_id: usuarioActual.id,
          p_cedula: prestamo.cedula,
        });
      } catch (e) {
        console.log("Error al guardar preferencia en Supabase:", e);
      }
    }
  };

  const cambiarMonedaPago = (nuevaMoneda: "USD" | "COP") => {
    setMonedaPago(nuevaMoneda);
    if (nuevaMoneda !== monedaPrestamo) {
      setTasaInputTemp(tasaCambioCopPorUsd);
      setModalTasaVisible(true);
    }
  };

  const formatearSinDecimales = (valor: string | number) => {
    if (valor === "" || valor === null || valor === undefined) return "";
    const numeroStr =
      typeof valor === "number"
        ? Math.round(valor).toString()
        : valor.toString();
    const limpio = numeroStr.replace(/[^\d]/g, "");
    return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleMontoChange = (text: string) => {
    const soloDigitos = text.replace(/\D/g, "").slice(0, 9);
    setMontoFisico(
      soloDigitos === ""
        ? ""
        : soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    );
  };

  const limpiarMontoParaCalculo = (val: string) => {
    if (!val) return 0;
    return parseInt(val.replace(/\./g, ""), 10) || 0;
  };

  const montoFisicoNum = limpiarMontoParaCalculo(montoFisico);
  const tasaNum = parseFloat(tasaCambioCopPorUsd) || 1;

  let montoAplicadoPrestamo = 0;
  if (monedaPrestamo === monedaPago) {
    montoAplicadoPrestamo = montoFisicoNum;
  } else if (monedaPrestamo === "USD" && monedaPago === "COP") {
    montoAplicadoPrestamo =
      tasaNum > 0 ? Math.round(montoFisicoNum / tasaNum) : 0;
  } else if (monedaPrestamo === "COP" && monedaPago === "USD") {
    montoAplicadoPrestamo = Math.round(montoFisicoNum * tasaNum);
  }

  const mostrarMensaje = (tipo: "exito" | "error", mensaje: string) => {
    setTipoResultado(tipo);
    setMensajeResultado(mensaje);
    setModalResultadoVisible(true);
  };

  const guardarPago = async () => {
    if (guardandoRef.current || loading) return;
    guardandoRef.current = true;

    if (!clienteSeleccionado) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Por favor seleccione un cliente.");
      return;
    }
    if (!prestamoSeleccionado) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Por favor seleccione el préstamo a abonar.");
      return;
    }
    if (montoFisicoNum <= 0) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Ingrese un monto de pago válido mayor a 0.");
      return;
    }
    if (
      Math.round(montoAplicadoPrestamo) >
      Math.round(prestamoSeleccionado.saldo_pendiente)
    ) {
      guardandoRef.current = false;
      mostrarMensaje(
        "error",
        `El monto convertido ($ ${formatearSinDecimales(montoAplicadoPrestamo)} ${monedaPrestamo}) supera el saldo pendiente del préstamo.`,
      );
      return;
    }
    if (!usuarioActual) {
      guardandoRef.current = false;
      mostrarMensaje("error", "No se pudo identificar el usuario logueado.");
      return;
    }

    if (usarFechaManual && usuarioActual.tipo === "Administrador") {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
      if (!regexFecha.test(fechaManual)) {
        guardandoRef.current = false;
        mostrarMensaje(
          "error",
          "El formato de la fecha manual debe ser AAAA-MM-DD.",
        );
        return;
      }
    }

    setLoading(true);

    const prestamoIdActual = prestamoSeleccionado.id;
    const monedaPActual = monedaPrestamo;
    const montoPActual = montoAplicadoPrestamo;
    const monedaPagoActual = monedaPago;
    const tasaActual = tasaNum;
    const cedulaUsuarioActual = usuarioActual.cedula;

    const datosPago: any = {
      prestamo_id: prestamoIdActual,
      moneda: monedaPActual,
      monto_pagado: montoPActual,
      moneda_pago: monedaPagoActual,
      tasa_cambio: tasaActual,
      registrado_por_cedula: cedulaUsuarioActual,
      fecha_pago:
        usarFechaManual && usuarioActual.tipo === "Administrador"
          ? `${fechaManual}T00:00:00`
          : obtenerFechaHoraExactaVenezuela(),
    };

    try {
      const { error: errorPago } = await supabase
        .from("pagos")
        .insert([datosPago]);

      if (errorPago) throw errorPago;

      setMontoFisico("");
      setModalPagoVisible(false);
      setPrestamoSeleccionado(null);

      await cargarPrestamosActivosYPagosHoy(clientes);

      mostrarMensaje("exito", "Pago realizado satisfactoriamente.");
    } catch (err: any) {
      mostrarMensaje(
        "error",
        err.message ||
          "Ocurrió un error inesperado al intentar registrar el pago.",
      );
    } finally {
      setLoading(false);
      guardandoRef.current = false;
    }
  };

  const mapaClientes = new Map<string, Cliente>();
  clientes.forEach((c) => mapaClientes.set(c.cedula, c));

  // Ordenar alfabéticamente de la A a la Z por nombre del cliente,
  // y si tiene varios préstamos, mantenerlos juntos en fila por fecha.
  const prestamosOrdenadosAZ = [...todosLosPrestamos].sort((a, b) => {
    const cliA = mapaClientes.get(a.cedula);
    const cliB = mapaClientes.get(b.cedula);

    const nombreA = cliA
      ? `${cliA.nombres || ""} ${cliA.apellidos || ""}`.trim()
      : a.cedula;
    const nombreB = cliB
      ? `${cliB.nombres || ""} ${cliB.apellidos || ""}`.trim()
      : b.cedula;

    const comparacionNombre = nombreA.localeCompare(nombreB, "es", {
      sensitivity: "base",
    });
    if (comparacionNombre !== 0) return comparacionNombre;

    if (a.cedula !== b.cedula) return a.cedula.localeCompare(b.cedula);

    const fechaA = (a.fecha_prestamo || a.fecha_inicio || "").localeCompare(
      b.fecha_prestamo || b.fecha_inicio || "",
    );
    if (fechaA !== 0) return fechaA;

    return String(a.id).localeCompare(String(b.id));
  });

  const contadorPorCliente: Record<string, number> = {};
  const prestamosConIndice = prestamosOrdenadosAZ.map((p) => {
    contadorPorCliente[p.cedula] = (contadorPorCliente[p.cedula] || 0) + 1;
    return {
      ...p,
      indiceCliente: contadorPorCliente[p.cedula],
    };
  });

  const prestamosFiltrados = prestamosConIndice.filter((p) => {
    const cli = mapaClientes.get(p.cedula);
    const nombreCompleto = cli
      ? `${cli.nombres} ${cli.apellidos} ${cli.cedula}`.toLowerCase()
      : p.cedula.toLowerCase();

    const coincideNombre = nombreCompleto.includes(
      nombreBusqueda.trim().toLowerCase(),
    );

    const freq = (p.frecuencia || "").toLowerCase();
    const coincideFrecuencia =
      filtroFrecuencia === "Todas" || freq.includes(filtroFrecuencia);

    return coincideNombre && coincideFrecuencia;
  });

  const idsVisibles = new Set(prestamosFiltrados.map((p) => p.id));
  const pagosVisiblesHoy = pagosHoy.filter((pago) =>
    idsVisibles.has(pago.prestamo_id),
  );

  const totalPagadoHoyCop = pagosVisiblesHoy
    .filter((pago) => (pago.moneda_pago || pago.moneda || "COP") === "COP")
    .reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);

  const totalPagadoHoyUsd = pagosVisiblesHoy
    .filter((pago) => (pago.moneda_pago || pago.moneda) === "USD")
    .reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);

  const calcularDiasMora = (fechaStr?: string) => {
    if (!fechaStr) return 0;
    const fechaCuota = new Date(fechaStr.split("T")[0] + "T00:00:00");
    const hoy = new Date(fechaHoyStr + "T00:00:00");
    const diffMs = hoy.getTime() - fechaCuota.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDias > 0 ? diffDias : 0;
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isWebOrTablet && styles.contentContainerWeb,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* BUSCADOR POR NOMBRE */}
        <Text style={styles.sectionLabel}>Buscar cliente por nombre</Text>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Escribe el nombre o cédula del cliente..."
            value={nombreBusqueda}
            onChangeText={setNombreBusqueda}
            placeholderTextColor="#94a3b8"
          />
          {nombreBusqueda.length > 0 && (
            <TouchableOpacity
              onPress={() => setNombreBusqueda("")}
              style={styles.clearSearchBtn}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FILTROS POR CUOTA */}
        <Text style={styles.sectionLabel}>Filtrar por cuota</Text>
        <View style={styles.filterRow}>
          {[
            { label: "Todas", value: "Todas" as const },
            { label: "Diarias", value: "diario" as const },
            { label: "Semanal", value: "semanal" as const },
            { label: "Mensual", value: "mensual" as const },
          ].map((item) => {
            const activo = filtroFrecuencia === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.filterPill, activo && styles.filterPillActive]}
                onPress={() => setFiltroFrecuencia(item.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activo && styles.filterPillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* RESUMEN DE PRÉSTAMOS ACTIVOS Y TOTALES POR MONEDA */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryDot} />
          <Text style={styles.summaryHeader}>
            Préstamos activos ({prestamosFiltrados.length}) • Total pagado hoy (
            {fechaHoyStr}): $ {formatearSinDecimales(totalPagadoHoyCop) || "0"}{" "}
            COP
            {totalPagadoHoyUsd > 0
              ? ` • $ ${formatearSinDecimales(totalPagadoHoyUsd)} USD`
              : ""}
          </Text>
        </View>

        {/* LISTADO DE TARJETAS DE PRÉSTAMOS (A - Z, MÚLTIPLES EN FILA) */}
        {cargandoLista ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Cargando préstamos...</Text>
          </View>
        ) : prestamosFiltrados.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No se encontraron préstamos activos con esos filtros.
            </Text>
          </View>
        ) : (
          prestamosFiltrados.map((item) => {
            const cli = mapaClientes.get(item.cedula);
            const nombreCliente = cli
              ? `${cli.nombres} ${cli.apellidos}`
              : item.cedula;

            const pagadoHoyItem = pagosHoy.some(
              (p) => p.prestamo_id === item.id,
            );
            const montoAbonadoTotal = Math.max(
              0,
              (item.monto_total || 0) - (item.saldo_pendiente || 0),
            );
            const cuotasFaltantes =
              item.valor_cuota > 0
                ? Math.ceil((item.saldo_pendiente || 0) / item.valor_cuota)
                : item.cuotas || 0;

            const fechaReferenciaCuota =
              item.proxima_cuota || item.fecha_inicio || "";
            const diasAtraso = calcularDiasMora(fechaReferenciaCuota);
            const enMora = !pagadoHoyItem && diasAtraso > 0;

            return (
              <View
                key={item.id}
                style={[
                  styles.loanCard,
                  pagadoHoyItem && styles.loanCardPaid,
                  enMora && styles.loanCardOverdue,
                ]}
              >
                <View style={styles.loanCardBody}>
                  {/* Encabezado de tarjeta */}
                  <View style={styles.loanCardHeaderRow}>
                    <Text style={styles.loanCardClientName}>
                      {nombreCliente} (#{item.indiceCliente})
                    </Text>

                    <TouchableOpacity
                      style={styles.payButton}
                      activeOpacity={0.85}
                      onPress={() => abrirModalPago(item)}
                    >
                      <Text style={styles.payButtonText}>Pagar</Text>
                    </TouchableOpacity>

                    {pagadoHoyItem && (
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>Pagado hoy</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.loanCardHeaderRow}>
                    <Text style={styles.loanCardPrincipal}>
                      Monto prestado: ${" "}
                      {formatearSinDecimales(item.monto_prestado || 0)}{" "}
                      {item.moneda !== "COP" ? item.moneda : ""}
                    </Text>
                  </View>

                  {/* Fecha del préstamo */}
                  <Text style={styles.loanDateText}>
                    Fecha del préstamo:{" "}
                    {(item.fecha_prestamo || item.fecha_inicio || "").split(
                      "T",
                    )[0] || "N/A"}
                  </Text>

                  {/* Saldo y cuota */}
                  <Text style={styles.loanDetailText}>
                    Saldo pendiente:{" "}
                    <Text style={styles.highlightBalance}>
                      $ {formatearSinDecimales(item.saldo_pendiente || 0)}
                    </Text>{" "}
                    | Cuota ({item.frecuencia}):{" "}
                    <Text style={styles.highlightInstallment}>
                      $ {formatearSinDecimales(item.valor_cuota || 0)}
                    </Text>
                  </Text>

                  {/* Cuotas faltantes y montos */}
                  <Text style={styles.loanDetailText}>
                    Cuotas faltantes: {cuotasFaltantes} | Monto pagado: ${" "}
                    {formatearSinDecimales(montoAbonadoTotal)} | Pendiente: ${" "}
                    {formatearSinDecimales(item.saldo_pendiente || 0)}
                  </Text>

                  {/* Próxima cuota */}
                  {fechaReferenciaCuota ? (
                    <Text style={styles.nextInstallmentText}>
                      Próxima cuota programada:{" "}
                      {fechaReferenciaCuota.split("T")[0]}
                    </Text>
                  ) : null}

                  {/* Alerta de mora */}
                  {enMora && (
                    <Text style={styles.overdueText}>
                      EN MORA: SE PASÓ LA FECHA DE CUOTA (
                      {fechaReferenciaCuota.split("T")[0]} • {diasAtraso}{" "}
                      {diasAtraso === 1 ? "DÍA" : "DÍAS"} DE ATRASO)
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL DE FORMULARIO DE PAGO AL PRESIONAR "PAGAR" */}
      <Modal
        visible={modalPagoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalPagoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago</Text>
              <TouchableOpacity
                onPress={() => setModalPagoVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.paymentModalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {usuarioActual && (
                <View style={styles.userCard}>
                  <Text style={styles.userCardTitle}>
                    Registrado por ({usuarioActual.tipo}):{" "}
                    <Text style={styles.boldViolet}>
                      {usuarioActual.nombreCompleto}
                    </Text>
                  </Text>
                </View>
              )}

              {prestamoSeleccionado && (
                <View style={styles.selectedLoanBanner}>
                  <Text style={styles.selectedLoanTitle}>
                    {mapaClientes.get(prestamoSeleccionado.cedula)?.nombres}{" "}
                    {mapaClientes.get(prestamoSeleccionado.cedula)?.apellidos}
                  </Text>
                  <Text style={styles.selectedLoanSub}>
                    Saldo: ${" "}
                    {formatearSinDecimales(
                      prestamoSeleccionado.saldo_pendiente,
                    )}{" "}
                    {prestamoSeleccionado.moneda} • Cuota: ${" "}
                    {formatearSinDecimales(prestamoSeleccionado.valor_cuota)}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>
                1. ¿En qué moneda realiza el pago el cliente?
              </Text>
              <View style={styles.rowSelector}>
                {(["COP", "USD"] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.selectChip,
                      monedaPago === m && styles.selectChipActive,
                    ]}
                    onPress={() => cambiarMonedaPago(m)}
                  >
                    <Text
                      style={[
                        styles.selectChipTxt,
                        monedaPago === m && styles.selectChipTxtActive,
                      ]}
                    >
                      {m === "COP" ? "🇨🇴 Pesos (COP)" : "💵 Dólares (USD)"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {monedaPago !== monedaPrestamo && (
                <TouchableOpacity
                  style={styles.tasaBanner}
                  onPress={() => setModalTasaVisible(true)}
                >
                  <Text style={styles.tasaBannerText}>
                    💱 Tasa aplicada:{" "}
                    <Text style={styles.bold}>
                      1 USD = $ {tasaCambioCopPorUsd} COP
                    </Text>{" "}
                    (Click para editar)
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>
                2. Monto Entregado Físicamente ({monedaPago})
              </Text>
              <TextInput
                style={styles.input}
                placeholder={`Monto en ${monedaPago}`}
                value={montoFisico}
                onChangeText={handleMontoChange}
                keyboardType="numeric"
                maxLength={15}
                placeholderTextColor="#94a3b8"
              />

              {usuarioActual?.tipo === "Administrador" && (
                <View style={styles.manualDateBox}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    activeOpacity={0.8}
                    onPress={() => setUsarFechaManual(!usarFechaManual)}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        usarFechaManual && styles.checkboxBoxChecked,
                      ]}
                    >
                      {usarFechaManual && (
                        <Text style={styles.checkboxTick}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      📅 Registrar fecha de pago (Manual)
                    </Text>
                  </TouchableOpacity>

                  {usarFechaManual && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.subLabel}>
                        Seleccione la fecha del pago:
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="2026-09-01"
                        value={fechaManual}
                        onChangeText={setFechaManual}
                        placeholderTextColor="#94a3b8"
                      />
                      <Text style={styles.helperText}>
                        Formato requerido: AAAA-MM-DD (Ej: 2026-05-15)
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.calcBox}>
                <Text style={styles.calcTitle}>
                  Resumen de Conversión y Cobro
                </Text>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>Saldo Actual:</Text>
                  <Text style={styles.bold}>
                    ${" "}
                    {prestamoSeleccionado
                      ? formatearSinDecimales(
                          prestamoSeleccionado.saldo_pendiente,
                        )
                      : "0"}{" "}
                    {monedaPrestamo}
                  </Text>
                </View>

                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>
                    Monto Recibido ({monedaPago}):
                  </Text>
                  <Text style={styles.bold}>
                    $ {formatearSinDecimales(montoFisicoNum)} {monedaPago}
                  </Text>
                </View>

                {monedaPago !== monedaPrestamo && (
                  <View style={styles.calcRow}>
                    <Text style={styles.calcText}>Equivalente Abonado:</Text>
                    <Text style={styles.boldViolet}>
                      $ {formatearSinDecimales(montoAplicadoPrestamo)}{" "}
                      {monedaPrestamo}
                    </Text>
                  </View>
                )}

                <View style={[styles.calcRow, styles.calcRowLast]}>
                  <Text style={styles.calcText}>Nuevo Saldo Resultante:</Text>
                  <Text style={styles.boldEmerald}>
                    ${" "}
                    {prestamoSeleccionado
                      ? formatearSinDecimales(
                          Math.max(
                            0,
                            prestamoSeleccionado.saldo_pendiente -
                              montoAplicadoPrestamo,
                          ),
                        )
                      : "0"}{" "}
                    {monedaPrestamo}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmPayButton, loading && { opacity: 0.7 }]}
                onPress={guardarPago}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Confirmar Pago</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL TASA DE CAMBIO */}
      <Modal
        visible={modalTasaVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalTasaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalExitoContainer, { maxWidth: 380 }]}>
            <Text style={styles.modalExitoTitle}>Tasa de Cambio</Text>
            <Text style={styles.modalExitoMessage}>
              Ingrese la tasa de cambio actual (COP por 1 USD):
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  width: "100%",
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: "bold",
                },
              ]}
              placeholder="Ej: 4100"
              keyboardType="numeric"
              value={tasaInputTemp}
              onChangeText={setTasaInputTemp}
              autoFocus={true}
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                if (tasaInputTemp && parseFloat(tasaInputTemp) > 0) {
                  setTasaCambioCopPorUsd(tasaInputTemp);
                  setModalTasaVisible(false);
                } else {
                  mostrarMensaje("error", "Ingrese una tasa válida.");
                }
              }}
            >
              <Text style={styles.successButtonText}>Guardar Tasa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE RESULTADO (PAGO REALIZADO / ERROR) */}
      <Modal
        visible={modalResultadoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalResultadoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalExitoContainer}>
            <View
              style={[
                styles.successIconContainer,
                tipoResultado === "error" && styles.errorIconContainer,
              ]}
            >
              <Text
                style={[
                  styles.successIconText,
                  tipoResultado === "error" && styles.errorIconText,
                ]}
              >
                {tipoResultado === "exito" ? "✓" : "✕"}
              </Text>
            </View>
            <Text style={styles.modalExitoTitle}>
              {tipoResultado === "exito" ? "¡Pago Realizado!" : "Atención"}
            </Text>
            <Text style={styles.modalExitoMessage}>{mensajeResultado}</Text>
            <TouchableOpacity
              style={[
                styles.successButton,
                tipoResultado === "error" && styles.errorButton,
              ]}
              onPress={() => setModalResultadoVisible(false)}
            >
              <Text style={styles.successButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 44,
  },
  contentContainerWeb: {
    maxWidth: 1120,
    width: "100%",
    alignSelf: "center",
    paddingTop: 20,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 48,
  },
  searchIcon: {
    fontSize: 18,
    color: "#7c3aed",
    marginRight: 10,
    fontWeight: "bold",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    height: "100%",
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "bold",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  filterPillActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16a34a",
  },
  summaryHeader: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    flex: 1,
  },

  /* TARJETAS DE PRÉSTAMOS */
  loanCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    borderLeftColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  loanCardPaid: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
    borderLeftWidth: 5,
    borderLeftColor: "#16a34a",
  },
  loanCardOverdue: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderLeftWidth: 5,
    borderLeftColor: "#e11d48",
  },
  loanCardBody: {
    flex: 1,
  },
  loanCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 5,
  },
  loanCardClientName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  loanCardPrincipal: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#5b21b6",
  },
  paidBadge: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  paidBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  loanDateText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 3,
  },
  loanDetailText: {
    fontSize: 12.5,
    color: "#475569",
    marginBottom: 2.5,
  },
  highlightBalance: {
    color: "#047857",
    fontWeight: "800",
  },
  highlightInstallment: {
    color: "#0f172a",
    fontWeight: "700",
  },
  nextInstallmentText: {
    fontSize: 12.5,
    color: "#7c3aed",
    fontWeight: "700",
    marginTop: 3,
  },
  overdueText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "800",
    marginTop: 5,
  },
  payButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  payButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13.5,
  },
  loadingBox: {
    padding: 44,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },

  /* MODAL DE PAGO CLARO MODERNO */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  paymentModalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: "700",
  },
  paymentModalScroll: {
    padding: 20,
  },
  userCard: {
    backgroundColor: "#f5f3ff",
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  userCardTitle: {
    fontSize: 13,
    color: "#5b21b6",
  },
  boldViolet: {
    fontWeight: "800",
    color: "#7c3aed",
  },
  selectedLoanBanner: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    borderLeftColor: "#16a34a",
  },
  selectedLoanTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  selectedLoanSub: {
    fontSize: 13,
    color: "#475569",
    marginTop: 3,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginTop: 6,
  },
  subLabel: {
    fontSize: 12.5,
    color: "#475569",
    marginBottom: 6,
  },
  rowSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  selectChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  selectChipActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  selectChipTxt: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#334155",
  },
  selectChipTxtActive: {
    color: "#ffffff",
  },
  tasaBanner: {
    backgroundColor: "#fef3c7",
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fcd34d",
    marginBottom: 12,
  },
  tasaBannerText: {
    fontSize: 13,
    color: "#92400e",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  manualDateBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#64748b",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  checkboxBoxChecked: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  checkboxTick: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#334155",
  },
  helperText: {
    fontSize: 11.5,
    color: "#64748b",
  },
  calcBox: {
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 18,
  },
  calcTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calcRowLast: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  calcText: {
    fontSize: 13,
    color: "#475569",
  },
  bold: {
    fontWeight: "700",
    color: "#0f172a",
  },
  boldEmerald: {
    fontWeight: "800",
    color: "#16a34a",
    fontSize: 19,
    fontWeight: "bold",
  },
  confirmPayButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "800",
  },

  /* MODALES DE TASA Y RESULTADO */
  modalExitoContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  successIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  errorIconContainer: {
    backgroundColor: "#fee2e2",
  },
  successIconText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#16a34a",
  },
  errorIconText: {
    color: "#dc2626",
  },
  modalExitoTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalExitoMessage: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 20,
  },
  successButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  errorButton: {
    backgroundColor: "#dc2626",
  },
  successButtonText: {
    color: "#ffffff",
    fontWeight: "100",
    fontSize: 15,
  },
});
