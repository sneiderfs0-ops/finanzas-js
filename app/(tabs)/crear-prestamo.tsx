import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
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
  const [modalExitoVisible, setModalExitoVisible] = useState(false);

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

      let usuarioInfo: any = null;

      if (userId || emailLogueado) {
        // Consulta directa a la tabla empleados según la estructura de tu base de datos
        let queryEmp = supabase
          .from("empleados")
          .select("id, cedula, nombres, apellidos");

        if (userId) queryEmp = queryEmp.eq("id", userId);
        else if (emailLogueado) queryEmp = queryEmp.eq("correo", emailLogueado);

        const { data: empleadoData, error: empError } =
          await queryEmp.maybeSingle();

        if (empleadoData && !empError) {
          usuarioInfo = {
            id: empleadoData.id,
            cedula: empleadoData.cedula,
            nombreCompleto: `${empleadoData.nombres} ${empleadoData.apellidos}`,
            tipo: "Administrador / Empleado",
          };
        }
      }

      if (usuarioInfo) {
        setUsuarioActual(usuarioInfo);
      }

      await cargarCajas();
      await cargarClientes(usuarioInfo);
    } catch (err) {
      console.log("Error obteniendo usuario actual:", err);
      await cargarCajas();
      await cargarClientes(null);
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

  const cargarClientes = async (usuario: any) => {
    let query = supabase
      .from("clientes")
      .select("cedula, nombres, apellidos, registrado_por_cedula");

    // Si deseas filtrar por el empleado logueado, descomenta la siguiente línea:
    // if (usuario && usuario.cedula) { query = query.eq("registrado_por_cedula", usuario.cedula); }

    const { data, error } = await query.order("nombres");
    if (error) {
      console.log("Error cargando clientes:", error.message);
    } else if (data) {
      setClientes(data);
    }
  };

  const handleCambiarFrecuencia = (
    nuevaFrecuencia: "diario" | "semanal" | "quincenal" | "mensual",
  ) => {
    setFrecuencia(nuevaFrecuencia);

    if (nuevaFrecuencia === "diario") {
      setPorcentaje("20");
      setCuotas("24");
    } else if (nuevaFrecuencia === "semanal") {
      setPorcentaje("25");
      setCuotas("4");
    } else if (nuevaFrecuencia === "quincenal") {
      setPorcentaje("25");
      setCuotas("2");
    } else if (nuevaFrecuencia === "mensual") {
      setPorcentaje("25");
      setCuotas("1");
    }
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

  const montoNum = parseFloat(monto) || 0;
  const porcentajeNum = parseFloat(porcentaje) || 0;
  const cuotasNum = parseInt(cuotas) || 1;

  const totalInteres = (montoNum * porcentajeNum) / 100;
  const montoTotal = montoNum + totalInteres;
  const valorCuota = cuotasNum > 0 ? montoTotal / cuotasNum : 0;

  const guardarPrestamo = async () => {
    if (!clienteSeleccionado) {
      Alert.alert("Atención", "Por favor seleccione un cliente.");
      return;
    }
    if (montoNum <= 0) {
      Alert.alert("Atención", "Ingrese un monto válido mayor a 0.");
      return;
    }
    if (!usuarioActual) {
      Alert.alert(
        "Atención",
        "No se pudo identificar qué usuario está realizando el registro.",
      );
      return;
    }

    const cajaSeleccionada = obtenerCajaIdAutomatica();
    if (!cajaSeleccionada) {
      Alert.alert(
        "Atención",
        `No se encontró una caja configurada para ${tipoPago} en moneda ${moneda}.`,
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Insertar el préstamo
      const { error: errorPrestamo } = await supabase.from("prestamos").insert([
        {
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
          registrado_por_cedula: usuarioActual.cedula,
        },
      ]);

      if (errorPrestamo) throw errorPrestamo;

      // 2. Registrar la transacción de egreso en caja
      const { error: errorTransaccion } = await supabase
        .from("transacciones")
        .insert([
          {
            caja_id: cajaSeleccionada.id,
            tipo: "egreso",
            moneda: moneda,
            monto: montoNum,
            descripcion: `Desembolso de préstamo a cliente Cédula: ${clienteSeleccionado}`,
            registrado_por_cedula: usuarioActual.cedula,
          },
        ]);

      if (errorTransaccion) throw errorTransaccion;

      // 3. Actualizar el saldo actual de la caja o banco restando el desembolso
      const { data: cajaActualData } = await supabase
        .from("cajas_bancos")
        .select("saldo_actual")
        .eq("id", cajaSeleccionada.id)
        .single();

      if (cajaActualData) {
        const nuevoSaldo = Number(cajaActualData.saldo_actual) - montoNum;
        const { error: errorUpdateCaja } = await supabase
          .from("cajas_bancos")
          .update({ saldo_actual: nuevoSaldo })
          .eq("id", cajaSeleccionada.id);

        if (errorUpdateCaja) throw errorUpdateCaja;
      }

      // Limpiar campos y mostrar modal de éxito
      setMonto("");
      setClienteSeleccionado(null);
      setNombreBusqueda("");
      setModalExitoVisible(true);
    } catch (err: any) {
      console.log("Error al guardar préstamo:", err.message);
      Alert.alert(
        "Error de Base de Datos",
        err.message || "No se pudo registrar el préstamo.",
      );
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        isWebOrTablet && styles.contentContainerWeb,
      ]}
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

        {/* 1. SELECTOR DE MONEDA */}
        <Text style={styles.label}>1. Seleccionar Moneda</Text>
        <View style={styles.rowSelector}>
          {(["USD", "COP"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.selectChip,
                moneda === m && styles.selectChipActive,
              ]}
              onPress={() => setMoneda(m)}
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

        {/* 2. SELECTOR DE TIPO DE PAGO */}
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

        {/* 3. CAMPO TRIGGER PARA SELECCIONAR CLIENTE */}
        <Text style={styles.label}>3. Cliente</Text>
        <TouchableOpacity
          style={styles.dropdownTrigger}
          activeOpacity={0.7}
          onPress={() => setModalVisible(true)}
        >
          {clienteObjetoSeleccionado ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.dropdownTriggerTitle}>
                {clienteObjetoSeleccionado.nombres}{" "}
                {clienteObjetoSeleccionado.apellidos}
              </Text>
              <Text style={styles.dropdownTriggerSubtitle}>
                Cédula: {clienteObjetoSeleccionado.cedula}
              </Text>
            </View>
          ) : (
            <Text style={styles.dropdownTriggerPlaceholder}>
              Seleccionar cliente...
            </Text>
          )}
          <Text style={styles.dropdownTriggerIcon}>▼</Text>
        </TouchableOpacity>

        {/* 4. FRECUENCIA DE PAGO */}
        <Text style={styles.label}>4. Modalidad / Frecuencia de Pago</Text>
        <View style={styles.frecuenciaContainer}>
          {[
            { id: "diario", label: "Diario", desc: "24 cuotas (20%)" },
            { id: "semanal", label: "Semanal", desc: "4 cuotas (25%)" },
            { id: "quincenal", label: "Quincenal", desc: "2 cuotas (25%)" },
            { id: "mensual", label: "Mensual", desc: "1 cuota (25%)" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.frecuenciaBtn,
                frecuencia === item.id && styles.frecuenciaBtnActive,
              ]}
              onPress={() => handleCambiarFrecuencia(item.id as any)}
            >
              <Text
                style={[
                  styles.frecuenciaTxt,
                  frecuencia === item.id && styles.frecuenciaTxtActive,
                ]}
              >
                {item.label}
              </Text>
              <Text
                style={[
                  styles.frecuenciaSubTxt,
                  frecuencia === item.id && styles.frecuenciaSubTxtActive,
                ]}
              >
                {item.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 5. MONTOS */}
        <Text style={styles.label}>5. Monto del Préstamo</Text>
        <TextInput
          style={styles.input}
          placeholder={`Monto a prestar en ${moneda}`}
          value={monto}
          onChangeText={setMonto}
          keyboardType="numeric"
          placeholderTextColor="#a4b0be"
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
              $ {montoTotal.toFixed(2)} {moneda}
            </Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcText}>
              Valor por Cuota ({cuotas} cuotas):
            </Text>
            <Text style={styles.boldPrimary}>
              $ {valorCuota.toFixed(2)} {moneda}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={guardarPrestamo}
          disabled={loading}
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
        visible={modalVisible}
        animationType="fade"
        transparent={true}
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
                value={nombreBusqueda}
                onChangeText={setNombreBusqueda}
                placeholderTextColor="#94a3b8"
                autoFocus={true}
              />
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={true}
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
                      <Text
                        style={[
                          styles.modalClientCedula,
                          isSelected && styles.textWhiteSub,
                        ]}
                      >
                        Cédula: {item.cedula}
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
                    No se encontraron clientes coincidentes.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO */}
      <Modal
        visible={modalExitoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalExitoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalExitoContainer}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.modalExitoTitle}>¡Préstamo Registrado!</Text>
            <Text style={styles.modalExitoMessage}>
              El préstamo se ha guardado correctamente y la transacción en caja
              fue actualizada.
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
    </ScrollView>
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
    color: "#0284c7",
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
  frecuenciaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  frecuenciaBtn: {
    width: "48%",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    marginBottom: 10,
  },
  frecuenciaBtnActive: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  frecuenciaTxt: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "bold",
  },
  frecuenciaSubTxt: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  frecuenciaTxtActive: {
    color: "#fff",
  },
  frecuenciaSubTxtActive: {
    color: "#e2e8f0",
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
  calcText: { fontSize: 14, color: "#475569" },
  bold: { fontWeight: "bold", color: "#1e293b" },
  boldPrimary: { fontWeight: "bold", color: "#0284c7", fontSize: 15 },
  button: {
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#10b981",
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
    justifyContent: "space-between",
  },
  modalClientCardSelected: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  modalClientName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1e293b",
  },
  modalClientCedula: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 3,
  },
  textWhite: {
    color: "#ffffff",
  },
  textWhiteSub: {
    color: "#e2e8f0",
  },
  badgeSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeSelectedText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontStyle: "italic",
    fontSize: 15,
  },
  modalExitoContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successIconText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
  },
  modalExitoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalExitoMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  successButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  successButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
