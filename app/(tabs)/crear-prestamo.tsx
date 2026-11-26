import React, { useState, useEffect } from "react";
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
  Platform,
  KeyboardAvoidingView,
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
  telefono?: string;
  registrado_por_cedula?: string;
  ruta_id?: string;
}

interface PrestamoActivo {
  id: string;
  cedula: string;
  monto_prestado?: number;
  monto_total: number;
  saldo_pendiente: number;
  moneda: string;
  frecuencia?: string;
  fecha_prestamo: string;
}

export default function CrearPrestamoScreen({ route }: any) {
  const clienteCedulaParam = route?.params?.clienteCedula || null;
  const { width } = useWindowDimensions();

  const isWebOrTablet = width >= 768;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(
    clienteCedulaParam,
  );

  // Modal principal de Crear Préstamo / Renovación al seleccionar un cliente
  const [modalPrestamoVisible, setModalPrestamoVisible] = useState(false);
  // Modal informativo de detalles de la renovación
  const [modalInfoRenovacionVisible, setModalInfoRenovacionVisible] =
    useState(false);

  const [nombreBusqueda, setNombreBusqueda] = useState("");

  const [modalResultadoVisible, setModalResultadoVisible] = useState(false);
  const [tipoResultado, setTipoResultado] = useState<"exito" | "error">(
    "exito",
  );
  const [mensajeResultado, setMensajeResultado] = useState("");

  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"USD" | "COP">("COP");
  const [tipoPago, setTipoPago] = useState<"efectivo" | "transferencia">(
    "efectivo",
  );

  const [frecuencia, setFrecuencia] = useState<
    "diario" | "semanal" | "quincenal" | "mensual"
  >("diario");

  const [porcentaje, setPorcentaje] = useState("20");
  const [cuotas, setCuotas] = useState("24");
  const [loading, setLoading] = useState(false);

  // ESTADOS PARA FECHA MANUAL DE ADMINISTRADOR
  const [usarFechaManual, setUsarFechaManual] = useState(false);
  const [fechaManual, setFechaManual] = useState(
    new Date().toISOString().split("T")[0],
  );

  // ESTADOS PARA LA RENOVACIÓN DE PRÉSTAMOS
  const [esRenovacion, setEsRenovacion] = useState(false);
  const [prestamosActivosCliente, setPrestamosActivosCliente] = useState<
    PrestamoActivo[]
  >([]);
  const [prestamoPadreSeleccionado, setPrestamoPadreSeleccionado] = useState<
    string | null
  >(null);

  const [usuarioActual, setUsuarioActual] = useState<{
    id: string;
    cedula: string;
    nombreCompleto: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    obtenerUsuarioLogueadoYCargarDatos();
  }, []);

  // Cargar préstamos activos cuando el usuario selecciona un cliente y marca renovación
  useEffect(() => {
    if (esRenovacion && clienteSeleccionado) {
      cargarPrestamosActivosCliente(clienteSeleccionado);
    } else {
      setPrestamosActivosCliente([]);
      setPrestamoPadreSeleccionado(null);
    }
  }, [esRenovacion, clienteSeleccionado]);

  const cargarPrestamosActivosCliente = async (cedulaCliente: string) => {
    try {
      const { data, error } = await supabase
        .from("prestamos")
        .select(
          "id, cedula, monto_prestado, monto_total, saldo_pendiente, moneda, frecuencia, fecha_prestamo",
        )
        .eq("cedula", cedulaCliente)
        .eq("estado", "activo")
        .gt("saldo_pendiente", 0);

      if (error) throw error;
      if (data) setPrestamosActivosCliente(data);
    } catch (err) {
      console.log("Error cargando préstamos activos para renovación:", err);
    }
  };

  const obtenerUsuarioLogueadoYCargarDatos = async () => {
    setCargandoClientes(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const emailLogueado = authData.user?.email?.trim().toLowerCase();

      if (!userId && !emailLogueado) {
        mostrarMensaje("error", "No hay una sesión activa en el sistema.");
        setCargandoClientes(false);
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
          "No se pudo identificar qué empleado, secretaria o administrador está realizando el registro.",
        );
        setCargandoClientes(false);
        return;
      }

      setUsuarioActual(usuarioInfo);

      await cargarCajas();
      await cargarClientes(usuarioInfo);
    } catch (err) {
      console.log("Error obteniendo usuario actual:", err);
      mostrarMensaje(
        "error",
        "Error de conexión al verificar los datos del usuario.",
      );
      await cargarCajas();
    } finally {
      setCargandoClientes(false);
    }
  };

  const cargarCajas = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda");
    if (data) {
      setCajas(data);
    }
  };

  const cargarClientes = async (infoUsuario: {
    id: string;
    cedula: string;
    tipo: string;
  }) => {
    try {
      if (infoUsuario.tipo === "Empleado") {
        const { data: rutaRelacion, error: rutaError } = await supabase
          .from("empleado_rutas")
          .select("ruta_id")
          .eq("empleado_id", infoUsuario.id)
          .maybeSingle();

        if (rutaError || !rutaRelacion?.ruta_id) {
          setClientes([]);
          return;
        }

        const { data, error } = await supabase
          .from("clientes")
          .select(
            "cedula, nombres, apellidos, telefono, registrado_por_cedula, ruta_id",
          )
          .eq("ruta_id", rutaRelacion.ruta_id)
          .order("nombres", { ascending: true });

        if (error) throw error;
        if (data) setClientes(data);
      } else {
        const { data, error } = await supabase
          .from("clientes")
          .select(
            "cedula, nombres, apellidos, telefono, registrado_por_cedula, ruta_id",
          )
          .order("nombres", { ascending: true });

        if (error) throw error;
        if (data) setClientes(data);
      }
    } catch (error: any) {
      console.log("Error cargando clientes:", error.message);
    }
  };

  const abrirModalCliente = (cedula: string) => {
    setClienteSeleccionado(cedula);
    setEsRenovacion(false);
    setPrestamoPadreSeleccionado(null);
    setMonto("");
    setModalPrestamoVisible(true);
  };

  const handleCambiarFrecuencia = (
    nuevaFrecuencia: "diario" | "semanal" | "quincenal" | "mensual",
  ) => {
    setFrecuencia(nuevaFrecuencia);

    if (nuevaFrecuencia === "diario") {
      setCuotas("24");
    } else if (nuevaFrecuencia === "semanal") {
      setCuotas("4");
    } else if (nuevaFrecuencia === "quincenal") {
      setCuotas("2");
    } else if (nuevaFrecuencia === "mensual") {
      setCuotas("1");
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
    if (text === "") {
      setMonto("");
      return;
    }

    const soloDigitos = text.replace(/\D/g, "");

    if (soloDigitos === "") {
      setMonto("");
      return;
    }

    const digitosLimitados = soloDigitos.slice(0, 9);
    const formateado = digitosLimitados.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setMonto(formateado);
  };

  const handleCambiarMoneda = (nuevaMoneda: "USD" | "COP") => {
    setMoneda(nuevaMoneda);
  };

  const obtenerCajaIdAutomatica = () => {
    const terminoBusqueda = tipoPago === "efectivo" ? "efectivo" : "banco";
    const cajaEncontrada = cajas.find(
      (c) =>
        c.nombre.toLowerCase().includes(terminoBusqueda) &&
        c.moneda.toLowerCase() === moneda.toLowerCase(),
    );
    return cajaEncontrada ? cajaEncontrada : null;
  };

  const limpiarMontoParaCalculo = (val: string) => {
    if (!val) return 0;
    const numStr = val.replace(/\./g, "");
    return parseInt(numStr, 10) || 0;
  };

  const montoNum = limpiarMontoParaCalculo(monto);
  const porcentajeNum = parseFloat(porcentaje) || 0;
  const cuotasNum = parseInt(cuotas, 10) || 1;

  const totalInteres = Math.round((montoNum * porcentajeNum) / 100);
  const montoTotal = montoNum + totalInteres;
  // Redondeo hacia arriba al múltiplo de 100 más cercano (ej: 20.833 -> 20.900):
  const valorCuota =
    cuotasNum > 0 ? Math.ceil(montoTotal / cuotasNum / 100) * 100 : 0;

  const prestamoPadreObj = prestamosActivosCliente.find(
    (p) => p.id === prestamoPadreSeleccionado,
  );
  const saldoPendientePadre = Number(prestamoPadreObj?.saldo_pendiente || 0);
  const efectivoAEntregarRenovacion = esRenovacion
    ? Math.max(0, montoNum - saldoPendientePadre)
    : montoNum;

  const mostrarMensaje = (tipo: "exito" | "error", mensaje: string) => {
    setTipoResultado(tipo);
    setMensajeResultado(mensaje);
    setModalResultadoVisible(true);
  };

  const guardarPrestamo = async () => {
    if (!clienteSeleccionado) {
      mostrarMensaje(
        "error",
        "Por favor seleccione un cliente antes de continuar.",
      );
      return;
    }
    if (montoNum <= 0) {
      mostrarMensaje("error", "Ingrese un monto de préstamo válido mayor a 0.");
      return;
    }
    if (!usuarioActual) {
      mostrarMensaje(
        "error",
        "No se pudo identificar qué empleado, secretaria o administrador está realizando el registro.",
      );
      return;
    }

    if (esRenovacion && !prestamoPadreSeleccionado) {
      mostrarMensaje(
        "error",
        "Has marcado renovación, por favor selecciona cuál préstamo activo deseas renovar.",
      );
      return;
    }

    const cajaSeleccionada = obtenerCajaIdAutomatica();
    if (!cajaSeleccionada) {
      mostrarMensaje(
        "error",
        `No se encontró una caja configurada para ${tipoPago} en moneda ${moneda}.`,
      );
      return;
    }

    setLoading(true);

    try {
      const { data: cajaInfo, error: cajaError } = await supabase
        .from("cajas_bancos")
        .select("saldo_actual")
        .eq("id", cajaSeleccionada.id)
        .single();

      if (cajaError) throw cajaError;

      const objetoPrestamo: any = {
        cedula: clienteSeleccionado,
        moneda: moneda,
        monto_prestado: montoNum,
        tasa_interes: porcentajeNum,
        monto_total: montoTotal,
        saldo_pendiente: montoTotal,
        estado: "activo",
        frecuencia: frecuencia,
        cuotas: cuotasNum,
        valor_cuota: valorCuota,
        caja_id: cajaSeleccionada.id,
        registrado_por_cedula: usuarioActual.cedula,
        fecha_prestamo:
          usarFechaManual &&
          usuarioActual.tipo === "Administrador" &&
          fechaManual
            ? `${fechaManual}T00:00:00`
            : obtenerFechaHoraExactaVenezuela(),
      };

      if (esRenovacion && prestamoPadreSeleccionado) {
        objetoPrestamo.prestamo_padre_id = prestamoPadreSeleccionado;
      }

      const { error: errorPrestamo } = await supabase
        .from("prestamos")
        .insert([objetoPrestamo]);

      if (errorPrestamo) throw errorPrestamo;

      setMonto("");
      setModalPrestamoVisible(false);
      setUsarFechaManual(false);
      setFechaManual(new Date().toISOString().split("T")[0]);
      setEsRenovacion(false);
      setPrestamoPadreSeleccionado(null);
      setPrestamosActivosCliente([]);

      mostrarMensaje(
        "exito",
        esRenovacion
          ? "¡Préstamo renovado exitosamente! El crédito anterior ha sido cerrado y la caja actualizada."
          : "El préstamo se ha registrado satisfactoriamente y la caja ha sido actualizada.",
      );
    } catch (err: any) {
      console.log("Error al guardar préstamo:", err.message);

      let mensajeErrorFinal =
        err.message ||
        "Ocurrió un error inesperado al intentar guardar el préstamo.";
      if (mensajeErrorFinal.toLowerCase().includes("numeric field overflow")) {
        mensajeErrorFinal = `⚠️ El monto ingresado ($ ${formatearSinDecimales(montoNum)} ${moneda}) es demasiado grande y excede el límite permitido por la base de datos.`;
      }

      mostrarMensaje("error", mensajeErrorFinal);
    } finally {
      setLoading(false);
    }
  };

  // Ordenar clientes alfabéticamente de la A a la Z y filtrar por búsqueda
  const clientesOrdenadosAZ = [...clientes].sort((a, b) => {
    const nombreA = `${a.nombres || ""} ${a.apellidos || ""}`.trim();
    const nombreB = `${b.nombres || ""} ${b.apellidos || ""}`.trim();
    return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
  });

  const clientesFiltrados = clientesOrdenadosAZ.filter((c) =>
    `${c.nombres} ${c.apellidos} ${c.cedula}`
      .toLowerCase()
      .includes(nombreBusqueda.trim().toLowerCase()),
  );

  const clienteObjetoSeleccionado = clientes.find(
    (c) => c.cedula === clienteSeleccionado,
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isWebOrTablet && styles.contentContainerWeb,
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={styles.innerWrapper}>
          {/* BUSCADOR DE CLIENTES */}
          <Text style={styles.sectionLabel}>Buscar cliente por nombre</Text>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Escribe el nombre o cédula del cliente..."
              placeholderTextColor="#94a3b8"
              value={nombreBusqueda}
              onChangeText={setNombreBusqueda}
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

          <View style={styles.summaryStrip}>
            <View style={styles.summaryDot} />
            <Text style={styles.summaryHeader}>
              Clientes disponibles (A - Z): {clientesFiltrados.length}
            </Text>
          </View>

          {/* LISTA DE CLIENTES DE LA A A LA Z */}
          {cargandoClientes ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={styles.loadingText}>Cargando clientes...</Text>
            </View>
          ) : clientesFiltrados.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No se encontraron clientes coincidentes en esta ruta.
              </Text>
            </View>
          ) : (
            clientesFiltrados.map((item) => {
              const isSelected = clienteSeleccionado === item.cedula;
              return (
                <TouchableOpacity
                  key={item.cedula}
                  style={[
                    styles.clientCard,
                    isSelected && styles.clientCardSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => abrirModalCliente(item.cedula)}
                >
                  <View style={styles.clientCardBody}>
                    <Text style={styles.clientCardName}>
                      {item.nombres} {item.apellidos}
                    </Text>
                    <Text style={styles.clientCardSub}>
                      Cédula: {item.cedula}
                      {item.telefono ? ` • Teléfono: ${item.telefono}` : ""}
                    </Text>
                  </View>

                  <View style={styles.clientActionBtn}>
                    <Text style={styles.clientActionBtnText}>Prestar</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* MODAL PRINCIPAL PARA CREAR PRÉSTAMO / RENOVACIÓN */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalPrestamoVisible}
          onRequestClose={() => setModalPrestamoVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {clienteObjetoSeleccionado
                    ? `Préstamo para: ${clienteObjetoSeleccionado.nombres} ${clienteObjetoSeleccionado.apellidos}`
                    : "Nuevo Préstamo"}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalPrestamoVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
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

                <Text style={styles.label}>1. Seleccionar Moneda</Text>
                <View style={styles.rowSelector}>
                  {(["USD", "COP"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.selectChip,
                        moneda === m && styles.selectChipActive,
                      ]}
                      onPress={() => handleCambiarMoneda(m)}
                    >
                      <Text
                        style={[
                          styles.selectChipTxt,
                          moneda === m && styles.selectChipTxtActive,
                        ]}
                      >
                        {m === "USD" ? "💵 Dólares (USD)" : "🇨🇴 Pesos (COP)"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>2. Método de Desembolso</Text>
                <View style={styles.rowSelector}>
                  {[
                    { id: "efectivo", label: `Efectivo (${moneda})` },
                    { id: "transferencia", label: `Transferencia (${moneda})` },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.selectChip,
                        tipoPago === t.id && styles.selectChipActive,
                      ]}
                      onPress={() => setTipoPago(t.id as any)}
                    >
                      <Text
                        style={[
                          styles.selectChipTxt,
                          tipoPago === t.id && styles.selectChipTxtActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* CHECKBOX DE RENOVACIÓN Y LISTA DE PRÉSTAMOS ACTIVOS DEL CLIENTE */}
                <View style={styles.adminDateContainer}>
                  <View style={styles.renewalTopRow}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setEsRenovacion(!esRenovacion)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          esRenovacion && styles.checkboxBoxActive,
                        ]}
                      >
                        {esRenovacion && (
                          <Text style={styles.checkboxCheck}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        🔄 ¿Renovación del préstamo?
                      </Text>
                    </TouchableOpacity>

                    {esRenovacion && prestamoPadreObj && (
                      <TouchableOpacity
                        style={styles.infoRenovBtn}
                        onPress={() => setModalInfoRenovacionVisible(true)}
                      >
                        <Text style={styles.infoRenovBtnText}>
                          Ver detalle renovación
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {esRenovacion && (
                    <View style={styles.datePickerWrapper}>
                      <Text style={styles.subLabel}>
                        Seleccione el préstamo activo a renovar:
                      </Text>
                      {clienteSeleccionado ? (
                        prestamosActivosCliente.length > 0 ? (
                          prestamosActivosCliente.map((p, idx) => {
                            const isSelected =
                              prestamoPadreSeleccionado === p.id;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={[
                                  styles.loanOptionCard,
                                  isSelected && styles.loanOptionCardActive,
                                ]}
                                onPress={() =>
                                  setPrestamoPadreSeleccionado(p.id)
                                }
                              >
                                <Text
                                  style={[
                                    styles.loanOptionTitle,
                                    isSelected && styles.selectChipTxtActive,
                                  ]}
                                >
                                  Préstamo #{idx + 1} • Total: ${" "}
                                  {formatearSinDecimales(p.monto_total)}{" "}
                                  {p.moneda}
                                </Text>
                                <Text
                                  style={[
                                    styles.loanOptionSub,
                                    isSelected && styles.selectChipTxtActive,
                                  ]}
                                >
                                  Saldo Pendiente: ${" "}
                                  {formatearSinDecimales(p.saldo_pendiente)}{" "}
                                  {p.moneda}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <Text style={styles.warningText}>
                            Este cliente no tiene préstamos activos pendientes
                            por cobrar.
                          </Text>
                        )
                      ) : (
                        <Text style={styles.warningText}>
                          Seleccione un cliente para ver sus créditos activos.
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <Text style={styles.label}>3. Frecuencia de Pago</Text>
                <View style={styles.rowSelector}>
                  {[
                    { id: "diario", label: "Diario" },
                    { id: "semanal", label: "Semanal" },
                    { id: "quincenal", label: "Quincenal" },
                    { id: "mensual", label: "Mensual" },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.selectChip,
                        frecuencia === item.id && styles.selectChipActive,
                      ]}
                      onPress={() => handleCambiarFrecuencia(item.id as any)}
                    >
                      <Text
                        style={[
                          styles.selectChipTxt,
                          frecuencia === item.id && styles.selectChipTxtActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>4. Tasa de Interés (%)</Text>
                <View style={styles.rowSelector}>
                  {["0.00", "10.00", "15.00", "20.00", "25.00"].map((tasa) => {
                    const isSelected =
                      parseFloat(porcentaje) === parseFloat(tasa);
                    return (
                      <TouchableOpacity
                        key={tasa}
                        style={[
                          styles.selectChip,
                          isSelected && styles.selectChipActive,
                        ]}
                        onPress={() => setPorcentaje(tasa)}
                      >
                        <Text
                          style={[
                            styles.selectChipTxt,
                            isSelected && styles.selectChipTxtActive,
                          ]}
                        >
                          {tasa}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>5. Número de Cuotas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Número de cuotas"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={cuotas}
                  onChangeText={(text) => {
                    const soloDigitos = text.replace(/\D/g, "");
                    setCuotas(soloDigitos);
                  }}
                  maxLength={3}
                />

                <Text style={styles.label}>6. Monto del Préstamo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa monto del prestamo"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={monto}
                  onChangeText={handleMontoChange}
                  maxLength={15}
                />

                <View style={styles.calcBox}>
                  <Text style={styles.calcTitle}>Resumen de Operación</Text>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcText}>Frecuencia:</Text>
                    <Text style={styles.bold}>{frecuencia.toUpperCase()}</Text>
                  </View>
                  {esRenovacion && prestamoPadreObj && (
                    <>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcText}>
                          Saldo Pendiente Anterior:
                        </Text>
                        <Text style={styles.bold}>
                          $ {formatearSinDecimales(saldoPendientePadre)}{" "}
                          {moneda}
                        </Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcText}>
                          Efectivo a Entregar (Caja):
                        </Text>
                        <Text style={styles.boldEmerald}>
                          $ {formatearSinDecimales(efectivoAEntregarRenovacion)}{" "}
                          {moneda}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.calcRow}>
                    <Text style={styles.calcText}>Total con Interés:</Text>
                    <Text style={styles.bold}>
                      $ {formatearSinDecimales(montoTotal)} {moneda}
                    </Text>
                  </View>
                  <View style={[styles.calcRow, styles.calcRowLast]}>
                    <Text style={styles.calcText}>
                      Valor por Cuota ({cuotas} cuotas):
                    </Text>
                    <Text style={styles.boldViolet}>
                      $ {formatearSinDecimales(valorCuota)} {moneda}
                    </Text>
                  </View>
                </View>

                {/* BLOQUE EXCLUSIVO PARA ADMINISTRADOR: FECHA MANUAL */}
                {usuarioActual?.tipo === "Administrador" && (
                  <View style={styles.adminDateContainer}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setUsarFechaManual(!usarFechaManual)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          usarFechaManual && styles.checkboxBoxActive,
                        ]}
                      >
                        {usarFechaManual && (
                          <Text style={styles.checkboxCheck}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        📅 Registrar fecha de préstamo (Manual)
                      </Text>
                    </TouchableOpacity>

                    {usarFechaManual && (
                      <View style={styles.datePickerWrapper}>
                        <Text style={styles.subLabel}>
                          Seleccione la fecha del préstamo:
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder="AAAA-MM-DD"
                          value={fechaManual}
                          onChangeText={setFechaManual}
                        />
                        <Text style={styles.helperText}>
                          Formato requerido: AAAA-MM-DD (Ej: 2026-05-15)
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.modalFooterActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => setModalPrestamoVisible(false)}
                    disabled={loading}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    onPress={guardarPrestamo}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {esRenovacion
                          ? "Registrar Renovación"
                          : "Registrar Préstamo"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE INFORMACIÓN DE RENOVACIÓN */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalInfoRenovacionVisible}
          onRequestClose={() => setModalInfoRenovacionVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalExitoContainer}>
              <Text style={styles.modalExitoTitle}>
                Información de Renovación
              </Text>
              <View style={styles.infoRenovBox}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>Cliente:</Text>
                  <Text style={styles.bold}>
                    {clienteObjetoSeleccionado
                      ? `${clienteObjetoSeleccionado.nombres} ${clienteObjetoSeleccionado.apellidos}`
                      : "-"}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>Saldo pendiente anterior:</Text>
                  <Text style={styles.bold}>
                    $ {formatearSinDecimales(saldoPendientePadre)} {moneda}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>Nuevo monto prestado:</Text>
                  <Text style={styles.bold}>
                    $ {formatearSinDecimales(montoNum)} {moneda}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>Efectivo a entregar caja:</Text>
                  <Text style={styles.boldEmerald}>
                    $ {formatearSinDecimales(efectivoAEntregarRenovacion)}{" "}
                    {moneda}
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcText}>
                    Interés ({porcentajeNum}%):
                  </Text>
                  <Text style={styles.bold}>
                    +$ {formatearSinDecimales(totalInteres)} {moneda}
                  </Text>
                </View>
                <View style={[styles.calcRow, styles.calcRowLast]}>
                  <Text style={styles.calcText}>Monto total nuevo:</Text>
                  <Text style={styles.boldViolet}>
                    $ {formatearSinDecimales(montoTotal)} {moneda}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => setModalInfoRenovacionVisible(false)}
              >
                <Text style={styles.successButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL PERSONALIZADO DE RESULTADO */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalResultadoVisible}
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
                {tipoResultado === "exito" ? "¡Operación Exitosa!" : "Atención"}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 44,
  },
  contentContainerWeb: {
    alignItems: "center",
    padding: 24,
  },
  innerWrapper: {
    width: "100%",
    maxWidth: 1120,
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
    backgroundColor: "#10b981",
  },
  summaryHeader: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  clientCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    borderLeftColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  clientCardSelected: {
    borderColor: "#7c3aed",
    backgroundColor: "#faf5ff",
  },
  clientCardBody: {
    flex: 1,
  },
  clientCardName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  clientCardSub: {
    fontSize: 12.5,
    color: "#64748b",
    marginTop: 3,
  },
  clientActionBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  clientActionBtnText: {
    color: "#ffffff",
    fontWeight: "500",
    fontSize: 13.5,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 14,
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
  boldEmerald: {
    fontWeight: "800",
    color: "#059669",
  },
  label: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  rowSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectChip: {
    flexGrow: 1,
    minWidth: "28%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  selectChipActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  selectChipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  selectChipTxtActive: {
    color: "#ffffff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  calcBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calcTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  calcRowLast: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 4,
  },
  calcText: {
    fontSize: 13.5,
    color: "#475569",
  },
  bold: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  adminDateContainer: {
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  renewalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
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
    borderColor: "#7c3aed",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    backgroundColor: "#7c3aed",
  },
  checkboxCheck: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#4c1d95",
  },
  infoRenovBtn: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c4b5fd",
  },
  infoRenovBtnText: {
    color: "#5b21b6",
    fontSize: 12,
    fontWeight: "700",
  },
  datePickerWrapper: {
    marginTop: 10,
  },
  loanOptionCard: {
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },
  loanOptionCardActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  loanOptionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  loanOptionSub: {
    fontSize: 12.5,
    color: "#475569",
    marginTop: 2,
  },
  warningText: {
    color: "#b45309",
    fontSize: 13,
    fontStyle: "italic",
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  modalFooterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalBtnText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "700",
  },
  button: {
    flex: 2,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "100",
    color: "#0f172a",
    flex: 1,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: "700",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    padding: 18,
    paddingBottom: 24,
  },
  emptyContainer: {
    backgroundColor: "#ffffff",
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13.5,
    textAlign: "center",
  },
  modalExitoContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoRenovBox: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 18,
  },
  successIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  errorIconContainer: {
    backgroundColor: "#fee2e2",
  },
  successIconText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#059669",
  },
  errorIconText: {
    color: "#dc2626",
  },
  modalExitoTitle: {
    fontSize: 18.5,
    fontWeight: "100",
    color: "#0f172a",
    marginBottom: 10,
    textAlign: "center",
  },
  modalExitoMessage: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 20,
  },
  successButton: {
    width: "100%",
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  errorButton: {
    backgroundColor: "#ef4444",
  },
  successButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "100",
  },
});
