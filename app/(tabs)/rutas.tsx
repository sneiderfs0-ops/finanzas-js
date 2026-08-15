import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "../../supabase";
import { colors, globalStyles } from "@/constants/globalStyles";

export default function RutasScreen() {
  const [rutas, setRutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);

  // Estados para el modal de crear ruta (Solo Administrador)
  const [modalVisible, setModalVisible] = useState(false);
  const [descripcionRuta, setDescripcionRuta] = useState("");
  const [creando, setCreando] = useState(false);

  // Estado para el modal de éxito
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [rutaCreadaNombre, setRutaCreadaNombre] = useState("");

  // Estados para el modal de asignar empleados (Solo Administrador)
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<any>(null);
  const [listaEmpleados, setListaEmpleados] = useState<any[]>([]);
  const [empleadosAsignados, setEmpleadosAsignados] = useState<string[]>([]);

  useEffect(() => {
    verificarRolYCargarRutas();
  }, []);

  const verificarRolYCargarRutas = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !session.user?.email) return;

      const email = session.user.email.trim().toLowerCase();
      const userId = session.user.id;

      // 1. Consultar si es Administrador
      const { data: adminData } = await supabase
        .from("administradores")
        .select("*")
        .eq("correo", email)
        .maybeSingle();

      if (adminData) {
        setRolUsuario("administrador");
        cargarTodasLasRutas();
        return;
      }

      // 2. Si no es admin, verificar si es Empleado
      const { data: empleadoData } = await supabase
        .from("empleados")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (empleadoData) {
        setRolUsuario("empleado");
        cargarRutasDeEmpleado(empleadoData.id);
      }
    } catch (error) {
      console.error("Error al verificar rol:", error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTodasLasRutas = async () => {
    const { data, error } = await supabase
      .from("rutas")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRutas(data);
  };

  const cargarRutasDeEmpleado = async (empleadoId: string) => {
    const { data, error } = await supabase
      .from("empleado_rutas")
      .select("rutas (*)")
      .eq("empleado_id", empleadoId);

    if (!error && data) {
      const rutasAsignadas = data
        .map((item: any) => item.rutas)
        .filter(Boolean);
      setRutas(rutasAsignadas);
    }
  };

  const crearRuta = async () => {
    if (!descripcionRuta.trim()) {
      Alert.alert(
        "Error",
        "Por favor ingresa los municipios o sectores que abarca la ruta.",
      );
      return;
    }

    try {
      setCreando(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Obtener el número total de rutas de forma segura
      const { data: rutasExistentes, error: countError } = await supabase
        .from("rutas")
        .select("id");

      if (countError) throw countError;

      const siguienteNumero =
        (rutasExistentes ? rutasExistentes.length : 0) + 1;
      const nombreAutoGenerado = `Ruta ${siguienteNumero}`;

      // 2. Insertar la nueva ruta
      const { error: insertError } = await supabase.from("rutas").insert([
        {
          nombre_ruta: nombreAutoGenerado,
          descripcion: descripcionRuta,
          creado_por: session.user.id,
        },
      ]);

      if (insertError) throw insertError;

      // Limpiar campos y cerrar modal de formulario
      setDescripcionRuta("");
      setModalVisible(false);

      // Mostrar modal de éxito personalizado
      setRutaCreadaNombre(nombreAutoGenerado);
      setSuccessModalVisible(true);

      cargarTodasLasRutas();
    } catch (error: any) {
      Alert.alert(
        "Error de Base de Datos",
        error.message || "No se pudo registrar la ruta.",
      );
    } finally {
      setCreando(false);
    }
  };

  // Funciones para Asignar Empleados
  const abrirModalAsignacion = async (ruta: any) => {
    setRutaSeleccionada(ruta);
    setModalAsignarVisible(true);

    try {
      const { data: empleadosData, error: empError } = await supabase
        .from("empleados")
        .select("*");

      if (empError) throw empError;
      setListaEmpleados(empleadosData || []);

      const { data: asignacionesData, error: asigError } = await supabase
        .from("empleado_rutas")
        .select("empleado_id")
        .eq("ruta_id", ruta.id);

      if (asigError) throw asigError;

      const idsAsignados = asignacionesData
        ? asignacionesData.map((item: any) => item.empleado_id)
        : [];
      setEmpleadosAsignados(idsAsignados);
    } catch (error: any) {
      Alert.alert(
        "Error",
        "No se pudieron cargar los datos para la asignación.",
      );
    }
  };

  const toggleAsignarEmpleado = async (empleadoId: string) => {
    try {
      const yaAsignado = empleadosAsignados.includes(empleadoId);

      if (yaAsignado) {
        const { error } = await supabase
          .from("empleado_rutas")
          .delete()
          .eq("ruta_id", rutaSeleccionada.id)
          .eq("empleado_id", empleadoId);

        if (error) throw error;
        setEmpleadosAsignados(
          empleadosAsignados.filter((id) => id !== empleadoId),
        );
      } else {
        const { error } = await supabase
          .from("empleado_rutas")
          .insert([{ ruta_id: rutaSeleccionada.id, empleado_id: empleadoId }]);

        if (error) throw error;
        setEmpleadosAsignados([...empleadosAsignados, empleadoId]);
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        "No se pudo actualizar la asignación: " + error.message,
      );
    }
  };

  if (loading) {
    return (
      <View
        style={[
          globalStyles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={localStyles.screenContainer}>
      <View style={globalStyles.mainWrapper}>
        <Text style={globalStyles.title}>
          {rolUsuario === "administrador"
            ? "🗺️ Gestión de Rutas"
            : "🗺️ Mis Rutas Asignadas"}
        </Text>
        <Text style={globalStyles.subtitle}>
          {rolUsuario === "administrador"
            ? "Crea y administra las rutas de cobro para los empleados"
            : "Rutas de cobro asignadas a tu cuenta"}
        </Text>

        {/* Botón exclusivo para Administrador */}
        {rolUsuario === "administrador" && (
          <TouchableOpacity
            style={[globalStyles.primaryButton, { marginBottom: 20 }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={globalStyles.primaryButtonText}>
              + Crear Nueva Ruta
            </Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={rutas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[globalStyles.dashboardCard, localStyles.cardSpacing]}>
              <Text style={localStyles.routeName}>{item.nombre_ruta}</Text>
              <Text style={localStyles.routeDesc}>
                {item.descripcion || "Sin descripción detallada"}
              </Text>

              {/* Botón exclusivo de Administrador para asignar personal */}
              {rolUsuario === "administrador" && (
                <TouchableOpacity
                  style={[
                    globalStyles.secondaryButton,
                    { marginTop: 12, paddingVertical: 8 },
                  ]}
                  onPress={() => abrirModalAsignacion(item)}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    👥 Asignar Empleados
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={localStyles.emptyText}>
              No hay rutas disponibles actualmente.
            </Text>
          }
        />
      </View>

      {/* Modal para Crear Ruta (Solo Admin) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={globalStyles.modalTitle}>Crear Nueva Ruta</Text>
            <Text
              style={[
                globalStyles.subtitle,
                { marginBottom: 15, fontSize: 13 },
              ]}
            >
              Se numerará automáticamente. Indica los sectores o municipios:
            </Text>

            <TextInput
              style={[
                globalStyles.input,
                { height: 100, textAlignVertical: "top" },
              ]}
              placeholder="Ej. Municipio Junín, Sector Altos de Santa Rosa..."
              placeholderTextColor={colors.textSecondary}
              value={descripcionRuta}
              onChangeText={setDescripcionRuta}
              multiline
            />

            <TouchableOpacity
              style={[
                globalStyles.primaryButton,
                { width: "100%", marginBottom: 10 },
              ]}
              onPress={crearRuta}
              disabled={creando}
            >
              {creando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={globalStyles.primaryButtonText}>Guardar Ruta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO PERSONALIZADO */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
            <Text style={globalStyles.modalTitle}>¡Operación Exitosa!</Text>
            <Text style={globalStyles.modalMessage}>
              La{" "}
              <Text style={{ color: colors.accentGreen, fontWeight: "bold" }}>
                {rutaCreadaNombre}
              </Text>{" "}
              se ha registrado y guardado correctamente en el sistema.
            </Text>

            <TouchableOpacity
              style={[
                globalStyles.primaryButton,
                { width: "100%", backgroundColor: colors.accentGreen },
              ]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={globalStyles.primaryButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA ASIGNAR EMPLEADOS A LA RUTA l*/}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalAsignarVisible}
        onRequestClose={() => setModalAsignarVisible(false)}
      >
        <View style={globalStyles.modalOverlay}>
          <View
            style={[
              globalStyles.modalContent,
              { width: "90%", maxHeight: "80%" },
            ]}
          >
            <Text style={globalStyles.modalTitle}>Asignar Empleados</Text>
            <Text
              style={[
                globalStyles.subtitle,
                { marginBottom: 15, fontSize: 13 },
              ]}
            >
              Selecciona los empleados que cubrirán la{" "}
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                {rutaSeleccionada?.nombre_ruta}
              </Text>
              :
            </Text>

            <FlatList
              data={listaEmpleados}
              keyExtractor={(emp) => emp.id}
              style={{ width: "100%", marginBottom: 15 }}
              renderItem={({ item: emp }) => {
                const asignado = empleadosAsignados.includes(emp.id);
                return (
                  <TouchableOpacity
                    style={[
                      localStyles.empleadoItem,
                      asignado && {
                        backgroundColor: colors.primary + "20",
                        borderColor: colors.primary,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggleAsignarEmpleado(emp.id)}
                  >
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "600" }}
                    >
                      {emp.nombre || emp.correo}
                    </Text>
                    <View style={{ pointerEvents: "none" }}>
                      <Text style={{ fontSize: 16 }}>
                        {asignado ? "✅" : "➕"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: "center",
                    color: colors.textSecondary,
                    padding: 20,
                  }}
                >
                  No hay empleados registrados.
                </Text>
              }
            />

            <TouchableOpacity
              style={[globalStyles.primaryButton, { width: "100%" }]}
              onPress={() => setModalAsignarVisible(false)}
            >
              <Text style={globalStyles.primaryButtonText}>
                Terminar / Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  cardSpacing: {
    width: "100%",
    marginBottom: 14,
  },
  routeName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  routeDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 15,
  },
  empleadoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginVertical: 4,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || "#333",
    // @ts-ignore
    cursor: "pointer",
  },
});
