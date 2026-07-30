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
} from "react-native";
import { supabase } from "../../supabase";

export default function CrearPrestamoScreen({ route }: any) {
  const clienteCedulaParam = route?.params?.clienteCedula || null;

  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState(clienteCedulaParam);
  const [nombreBusqueda, setNombreBusqueda] = useState("");
  const [monto, setMonto] = useState("");

  const [frecuencia, setFrecuencia] = useState<
    "diario" | "semanal" | "quincenal" | "mensual"
  >("diario");

  const [porcentaje, setPorcentaje] = useState("20");
  const [cuotas, setCuotas] = useState("20");
  const [loading, setLoading] = useState(false);

  const [usuarioActual, setUsuarioActual] = useState<{
    id: string;
    nombreCompleto: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    cargarClientes();
    obtenerUsuarioLogueado();
  }, []);

  const handleCambiarFrecuencia = (
    nuevaFrecuencia: "diario" | "semanal" | "quincenal" | "mensual",
  ) => {
    setFrecuencia(nuevaFrecuencia);

    if (nuevaFrecuencia === "diario") {
      setPorcentaje("20");
      setCuotas("20");
    } else if (nuevaFrecuencia === "semanal") {
      setPorcentaje("25");
      setCuotas("4");
    } else if (nuevaFrecuencia === "quincenal") {
      setPorcentaje("25");
      setCuotas("2");
    } else if (nuevaFrecuencia === "mensual") {
      setPorcentaje("30");
      setCuotas("1");
    }
  };

  const cargarClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("cedula, nombres, apellidos")
      .order("nombres");
    if (error) {
      console.log("Error cargando clientes:", error.message);
    } else if (data) {
      setClientes(data);
    }
  };

  const obtenerUsuarioLogueado = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) return;

      // Intentar buscar en administradores
      const { data: adminData } = await supabase
        .from("administradores")
        .select("id, nombres, apellidos")
        .eq("id", userId)
        .single();

      if (adminData) {
        setUsuarioActual({
          id: adminData.id,
          nombreCompleto: `${adminData.nombres} ${adminData.apellidos}`,
          tipo: "Administrador",
        });
        return;
      }

      // Si no es admin, buscar en empleados
      const { data: empleadoData } = await supabase
        .from("empleados")
        .select("id, nombres, apellidos")
        .eq("id", userId)
        .single();

      if (empleadoData) {
        setUsuarioActual({
          id: empleadoData.id,
          nombreCompleto: `${empleadoData.nombres} ${empleadoData.apellidos}`,
          tipo: "Empleado",
        });
      }
    } catch (err) {
      console.log("Error obteniendo usuario actual:", err);
    }
  };

  const montoNum = parseFloat(monto) || 0;
  const porcentajeNum = parseFloat(porcentaje) || 0;
  const cuotasNum = parseInt(cuotas) || 1;

  const totalInteres = (montoNum * porcentajeNum) / 100;
  const montoTotal = montoNum + totalInteres;
  const valorCuota = cuotasNum > 0 ? montoTotal / cuotasNum : 0;

  const guardarPrestamo = async () => {
    if (!clienteSeleccionado) {
      Alert.alert("Atención", "Por favor seleccione un cliente de la lista.");
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

    setLoading(true);

    try {
      const { error } = await supabase.from("prestamos").insert([
        {
          cliente_cedula: clienteSeleccionado,
          monto_prestado: montoNum,
          tasa_interes: porcentajeNum,
          monto_total: montoTotal,
          saldo_pendiente: montoTotal,
          estado: "activo",
          frecuencia: frecuencia,
          cuotas: cuotasNum,
          valor_cuota: valorCuota,
          registrado_por_id: usuarioActual.id, // <--- Vinculación exacta por UUID
        },
      ]);

      if (error) throw error;

      Alert.alert("¡Éxito!", "Préstamo creado y guardado correctamente.");

      setMonto("");
      setClienteSeleccionado(null);
      setNombreBusqueda("");
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
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

      <Text style={styles.label}>1. Seleccionar Cliente</Text>
      <TextInput
        style={styles.input}
        placeholder="Buscar cliente por nombre o cédula..."
        value={nombreBusqueda}
        onChangeText={setNombreBusqueda}
        placeholderTextColor="#aaa"
      />

      <View style={styles.listaClientesBox}>
        {clientesFiltrados.slice(0, 4).map((item) => (
          <TouchableOpacity
            key={item.cedula}
            style={[
              styles.clienteItem,
              clienteSeleccionado === item.cedula && styles.clienteSeleccionado,
            ]}
            onPress={() => setClienteSeleccionado(item.cedula)}
          >
            <Text
              style={[
                styles.clienteTexto,
                clienteSeleccionado === item.cedula &&
                  styles.clienteTextoSeleccionado,
              ]}
            >
              {item.nombres} {item.apellidos} (Cédula: {item.cedula})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>2. Modalidad / Frecuencia de Pago</Text>
      <View style={styles.frecuenciaContainer}>
        <TouchableOpacity
          style={[
            styles.frecuenciaBtn,
            frecuencia === "diario" && styles.frecuenciaBtnActive,
          ]}
          onPress={() => handleCambiarFrecuencia("diario")}
        >
          <Text
            style={[
              styles.frecuenciaTxt,
              frecuencia === "diario" && styles.frecuenciaTxtActive,
            ]}
          >
            Diario (20%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.frecuenciaBtn,
            frecuencia === "semanal" && styles.frecuenciaBtnActive,
          ]}
          onPress={() => handleCambiarFrecuencia("semanal")}
        >
          <Text
            style={[
              styles.frecuenciaTxt,
              frecuencia === "semanal" && styles.frecuenciaTxtActive,
            ]}
          >
            Semanal (25%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.frecuenciaBtn,
            frecuencia === "quincenal" && styles.frecuenciaBtnActive,
          ]}
          onPress={() => handleCambiarFrecuencia("quincenal")}
        >
          <Text
            style={[
              styles.frecuenciaTxt,
              frecuencia === "quincenal" && styles.frecuenciaTxtActive,
            ]}
          >
            Quincenal (25%)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.frecuenciaBtn,
            frecuencia === "mensual" && styles.frecuenciaBtnActive,
          ]}
          onPress={() => handleCambiarFrecuencia("mensual")}
        >
          <Text
            style={[
              styles.frecuenciaTxt,
              frecuencia === "mensual" && styles.frecuenciaTxtActive,
            ]}
          >
            Mensual (30%)
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>3. Detalle de Montos y Cuotas</Text>
      <TextInput
        style={styles.input}
        placeholder="Monto a prestar ($)"
        value={monto}
        onChangeText={setMonto}
        keyboardType="numeric"
        placeholderTextColor="#aaa"
      />

      <View style={styles.calcBox}>
        <Text style={styles.calcText}>
          Frecuencia Seleccionada:{" "}
          <Text style={styles.bold}>{frecuencia.toUpperCase()}</Text>
        </Text>
        <Text style={styles.calcText}>
          Total con Interés:{" "}
          <Text style={styles.bold}>${montoTotal.toFixed(2)}</Text>
        </Text>
        <Text style={styles.calcText}>
          Valor por Cuota ({cuotas} cuotas):{" "}
          <Text style={styles.bold}>${valorCuota.toFixed(2)}</Text>
        </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f6fa" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#2f3640",
  },
  userCard: {
    backgroundColor: "#e8f4fd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbe1fa",
  },
  userCardTitle: {
    fontSize: 12,
    color: "#0077b6",
    fontWeight: "600",
    marginBottom: 2,
  },
  userCardText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#03045e",
  },
  label: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 16,
  },
  listaClientesBox: { marginBottom: 12 },
  clienteItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e1e1e1",
  },
  clienteSeleccionado: {
    backgroundColor: "#0984e3",
    borderColor: "#0984e3",
  },
  clienteTexto: { fontSize: 15, color: "#2f3640" },
  clienteTextoSeleccionado: { color: "#fff", fontWeight: "bold" },
  frecuenciaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  frecuenciaBtn: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dcdde1",
    alignItems: "center",
    marginBottom: 8,
  },
  frecuenciaBtnActive: {
    backgroundColor: "#0984e3",
    borderColor: "#0984e3",
  },
  frecuenciaTxt: {
    fontSize: 14,
    color: "#2f3640",
    fontWeight: "600",
  },
  frecuenciaTxtActive: {
    color: "#fff",
  },
  calcBox: {
    backgroundColor: "#eaf2f8",
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  calcText: { fontSize: 16, color: "#2f3640", marginBottom: 6 },
  bold: { fontWeight: "bold", color: "#2980b9" },
  button: {
    backgroundColor: "#2ed573",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
