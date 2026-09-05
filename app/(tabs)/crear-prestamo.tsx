import React, { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
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

export default function CrearPrestamoScreen({ route }: any) {
  const clienteCedulaParam = route?.params?.clienteCedula || null;
  const { width } = useWindowDimensions();

  const isWebOrTablet = width >= 768;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(
    clienteCedulaParam,
  );

  const [modalVisible, setModalVisible] = useState(false);
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

  // NUEVOS ESTADOS PARA FECHA MANUAL DE ADMINISTRADOR
  const [usarFechaManual, setUsarFechaManual] = useState(false);
  const [fechaManual, setFechaManual] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [usuarioActual, setUsuarioActual] = useState<{
    id: string;
    cedula: string;
    nombreCompleto: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    obtenerUsuarioLogueadoYCargarDatos();
  }, []);

  const obtenerUsuarioLogueadoYCargarDatos = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const emailLogueado = authData.user?.email?.trim().toLowerCase();

      if (!userId && !emailLogueado) {
        mostrarMensaje("error", "No hay una sesión activa en el sistema.");
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
          .select("cedula, nombres, apellidos, registrado_por_cedula, ruta_id")
          .eq("ruta_id", rutaRelacion.ruta_id)
          .order("nombres", { ascending: true });

        if (error) throw error;
        if (data) setClientes(data);
      } else {
        const { data, error } = await supabase
          .from("clientes")
          .select("cedula, nombres, apellidos, registrado_por_cedula, ruta_id")
          .order("nombres", { ascending: true });

        if (error) throw error;
        if (data) setClientes(data);
      }
    } catch (error: any) {
      console.log("Error cargando clientes:", error.message);
    }
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
    let numStr = val.replace(/\./g, "");
    return parseInt(numStr, 10) || 0;
  };

  const montoNum = limpiarMontoParaCalculo(monto);
  const porcentajeNum = parseFloat(porcentaje) || 0;
  const cuotasNum = parseInt(cuotas, 10) || 1;

  const totalInteres = Math.round((montoNum * porcentajeNum) / 100);
  const montoTotal = montoNum + totalInteres;
  const valorCuota = cuotasNum > 0 ? Math.round(montoTotal / cuotasNum) : 0;

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

      const saldoDisponible = Number(cajaInfo?.saldo_actual || 0);

      if (montoNum > saldoDisponible) {
        mostrarMensaje(
          "error",
          `⚠️ Saldo insuficiente en la caja seleccionada (${cajaSeleccionada.nombre}).\n\nDisponible: $ ${formatearSinDecimales(saldoDisponible)} ${moneda}\nIntento de préstamo: $ ${formatearSinDecimales(montoNum)} ${moneda}`,
        );
        setLoading(false);
        return;
      }

      // Estructura de datos a insertar
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
      };

      // Si es admin y activó la fecha manual, se la agregamos a la consulta
      if (
        usuarioActual.tipo === "Administrador" &&
        usarFechaManual &&
        fechaManual
      ) {
        // Añadimos la hora actual para conservar el formato timestamptz correctamente
        objetoPrestamo.fecha_prestamo = `${fechaManual}T${new Date().toTimeString().split(" ")[0]}`;
      }

      const { error: errorPrestamo } = await supabase
        .from("prestamos")
        .insert([objetoPrestamo]);

      if (errorPrestamo) throw errorPrestamo;

      // Reiniciar formulario y ocultar / resetear el checkbox de fecha manual
      setMonto("");
      setClienteSeleccionado(null);
      setNombreBusqueda("");
      setUsarFechaManual(false);
      setFechaManual(new Date().toISOString().split("T")[0]);

      mostrarMensaje(
        "exito",
        "El préstamo se ha registrado satisfactoriamente y la caja ha sido actualizada.",
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

  const clientesFiltrados = clientes.filter((c) =>
    `${c.nombres} ${c.apellidos} ${c.cedula}`
      .toLowerCase()
      .includes(nombreBusqueda.toLowerCase()),
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
        <View style={[styles.mainCard, isWebOrTablet && styles.mainCardWeb]}>
          <Text style={styles.title}>Nuevo Préstamo</Text>

          {usuarioActual && (
            <View style={styles.userCard}>
              <Text style={styles.userCardTitle}>
                Registrado por ({usuarioActual.tipo}):
              </Text>
              <Text style={styles.userCardText}>
                {usuarioActual.nombreCompleto}
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

          <Text style={styles.label}>3. Cliente</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            {clienteObjetoSeleccionado ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownTriggerTitle}>
                  {clienteObjetoSeleccionado.nombres}{" "}
                  {clienteObjetoSeleccionado.apellidos}
                </Text>
              </View>
            ) : (
              <Text style={styles.dropdownTriggerPlaceholder}>
                Seleccionar cliente...
              </Text>
            )}
            <Text style={styles.dropdownTriggerIcon}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>4. Frecuencia de Pago</Text>
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

          <Text style={styles.label}>5. Tasa de Interés (%)</Text>
          <View style={styles.rowSelector}>
            {["0.00", "10.00", "15.00", "20.00", "25.00"].map((tasa) => (
              <TouchableOpacity
                key={tasa}
                style={[
                  styles.selectChip,
                  porcentaje === tasa && styles.selectChipActive,
                ]}
                onPress={() => setPorcentaje(tasa)}
              >
                <Text
                  style={[
                    styles.selectChipTxt,
                    porcentaje === tasa && styles.selectChipTxtActive,
                  ]}
                >
                  {tasa}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>6. Número de Cuotas</Text>
          <TextInput
            style={styles.input}
            placeholder="Número de cuotas"
            placeholderTextColor="#a4b0be"
            keyboardType="numeric"
            value={cuotas}
            onChangeText={(text) => {
              const soloDigitos = text.replace(/\D/g, "");
              setCuotas(soloDigitos);
            }}
            maxLength={3}
          />

          <Text style={styles.label}>7. Monto del Préstamo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresa monto del prestamo"
            placeholderTextColor="#a4b0be"
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
            <View style={styles.calcRow}>
              <Text style={styles.calcText}>Total con Interés:</Text>
              <Text style={styles.bold}>
                $ {formatearSinDecimales(montoTotal)} {moneda}
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcText}>
                Valor por Cuota ({cuotas} cuotas):
              </Text>
              <Text style={styles.boldPrimary}>
                $ {formatearSinDecimales(valorCuota)} {moneda}
              </Text>
            </View>
          </View>

          {/* ======================================================== */}
          {/* BLOQUE EXCLUSIVO PARA ADMINISTRADOR: FECHA MANUAL        */}
          {/* ======================================================== */}
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
          {/* ======================================================== */}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={guardarPrestamo}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Registrar Préstamo</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MODAL DE SELECCIÓN DE CLIENTE */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Buscar y Seleccionar Cliente
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchBoxContainer}>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="🔍 Escribe nombre, apellido o cédula..."
                  placeholderTextColor="#94a3b8"
                  value={nombreBusqueda}
                  onChangeText={setNombreBusqueda}
                  autoFocus={true}
                />
              </View>

              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {clientesFiltrados.map((item) => {
                  const isSelected = clienteSeleccionado === item.cedula;
                  return (
                    <TouchableOpacity
                      key={item.cedula}
                      style={[
                        styles.modalClientCard,
                        isSelected && styles.modalClientCardSelected,
                      ]}
                      onPress={() => {
                        setClienteSeleccionado(item.cedula);
                        setModalVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalClientName,
                            isSelected && styles.textWhite,
                          ]}
                        >
                          {item.nombres} {item.apellidos}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.badgeSelected}>
                          <Text style={styles.badgeSelectedText}>
                            ✓ Seleccionado
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {clientesFiltrados.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No se encontraron clientes coincidentes en esta ruta.
                    </Text>
                  </View>
                )}
              </ScrollView>
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
                <Text style={styles.successIconText}>
                  {tipoResultado === "exito" ? "✓" : "✕"}
                </Text>
              </View>
              <Text style={styles.modalExitoTitle}>
                {tipoResultado === "exito"
                  ? "¡Préstamo Registrado!"
                  : "Atención"}
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
    backgroundColor: "#f0f2f5",
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  contentContainerWeb: {
    alignItems: "center",
    padding: 24,
  },
  mainCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  mainCardWeb: {
    maxWidth: 750,
    padding: 32,
    borderWidth: 1,
    borderColor: "#e4e7eb",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1e293b",
  },
  userCard: {
    backgroundColor: "#e0f2fe",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  userCardTitle: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "600",
    marginBottom: 2,
  },
  userCardText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0c4a6e",
  },
  label: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 8,
    marginTop: 10,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
  },
  selectChipActive: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  selectChipTxt: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },
  selectChipTxtActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  dropdownTrigger: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dropdownTriggerTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
  },
  dropdownTriggerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  dropdownTriggerPlaceholder: {
    fontSize: 15,
    color: "#94a3b8",
  },
  dropdownTriggerIcon: {
    fontSize: 12,
    color: "#0c4eab",
    marginLeft: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    fontSize: 16,
    color: "#1e293b",
  },
  calcBox: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 20,
  },
  calcTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 6,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calcText: {
    fontSize: 14,
    color: "#0e356d",
  },
  bold: { fontWeight: "bold", color: "#1e293b" },
  boldPrimary: { fontWeight: "bold", color: "#0284c7", fontSize: 15 },

  // ESTILOS NUEVOS PARA EL CHECKBOX Y FECHA MANUAL
  adminDateContainer: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d97706",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxBoxActive: {
    backgroundColor: "#d97706",
  },
  checkboxCheck: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#92400e",
    flex: 1,
  },
  datePickerWrapper: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#fef3c7",
  },
  helperText: {
    fontSize: 12,
    color: "#b45309",
    fontStyle: "italic",
    marginTop: -6,
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#0284c7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 680,
    height: "80%",
    maxHeight: 650,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748b",
  },
  searchBoxContainer: {
    marginBottom: 16,
  },
  modalSearchInput: {
    backgroundColor: "#f8fafc",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    fontSize: 16,
    color: "#0f172a",
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    paddingBottom: 16,
  },
  modalClientCard: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyModel: "space-between",
  },
  modalClientCardSelected: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  modalClientName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
  },
  modalClientCedula: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  textWhite: {
    color: "#ffffff",
  },
  textWhiteSub: {
    color: "#e0f2fe",
  },
  badgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeSelectedText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  modalExitoContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 380,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIconContainer: {
    backgroundColor: "#fee2e2",
  },
  successIconText: {
    fontSize: 28,
    color: "#10b981",
    fontWeight: "bold",
  },
  modalExitoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalExitoMessage: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  successButton: {
    backgroundColor: "#0284c7",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  errorButton: {
    backgroundColor: "#ef4444",
  },
  successButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
