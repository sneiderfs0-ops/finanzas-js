import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { supabase } from "../../supabase";
import { colors, globalStyles } from "../../constants/globalStyles";

interface Empleado {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  telefono?: string;
  estado: boolean;
}

export default function GestionEmpleadosScreen() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);

  // Modales generales
  const [modalVerVisible, setModalVerVisible] = useState(false);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] =
    useState<Empleado | null>(null);

  // Estados para los Modales de Confirmación Personalizados
  const [modalConfirmarEstadoVisible, setModalConfirmarEstadoVisible] =
    useState(false);
  const [modalConfirmarBorrarVisible, setModalConfirmarBorrarVisible] =
    useState(false);
  const [empleadoAccion, setEmpleadoAccion] = useState<Empleado | null>(null);

  // Campos para editar
  const [nombresEdit, setNombresEdit] = useState("");
  const [apellidosEdit, setApellidosEdit] = useState("");
  const [cedulaEdit, setCedulaEdit] = useState("");
  const [correoEdit, setCorreoEdit] = useState("");
  const [telefonoEdit, setTelefonoEdit] = useState("");
  const [passwordEdit, setPasswordEdit] = useState("");

  useEffect(() => {
    verificarRolYCargar();
  }, []);

  const verificarRolYCargar = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      Alert.alert("Acceso denegado", "No se encontró una sesión activa.");
      setLoading(false);
      return;
    }

    const correoUsuario = user.email.toLowerCase().trim();

    // 1. Verificar si es Administrador
    const { data: adminData } = await supabase
      .from("administradores")
      .select("correo")
      .eq("correo", correoUsuario)
      .single();

    if (adminData) {
      setRolUsuario("administrador");
      await cargarEmpleados();
      return;
    }

    // 2. Verificar si es Secretaria
    const { data: secretariaData } = await supabase
      .from("secretaria")
      .select("correo")
      .eq("correo", correoUsuario)
      .single();

    if (secretariaData) {
      setRolUsuario("secretaria");
      await cargarEmpleados();
      return;
    }

    // 3. Si no es ni admin ni secretaria, se bloquea el acceso
    setRolUsuario("empleado");
    setLoading(false);
  };

  const cargarEmpleados = async () => {
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombres, apellidos, cedula, correo, telefono, estado")
      .order("nombres", { ascending: true });

    if (error) {
      console.log("Error al cargar empleados:", error.message);
      Alert.alert("Error", "No se pudieron cargar los empleados.");
    } else {
      setEmpleados(data || []);
    }
    setLoading(false);
  };

  // Ejecutar Cambio de Estado (Activar / Desactivar)
  const confirmarCambioEstado = async () => {
    if (!empleadoAccion) return;

    const nuevoEstado = !empleadoAccion.estado;
    const { data, error } = await supabase
      .from("empleados")
      .update({ estado: nuevoEstado })
      .eq("id", empleadoAccion.id)
      .select();

    setModalConfirmarEstadoVisible(false);
    setEmpleadoAccion(null);

    if (error) {
      Alert.alert("Error", "No se pudo cambiar el estado: " + error.message);
    } else if (!data || data.length === 0) {
      Alert.alert(
        "Aviso",
        "No se aplicaron cambios. Verifica las políticas RLS en Supabase para la tabla empleados.",
      );
    } else {
      cargarEmpleados();
    }
  };

  // Ejecutar Borrado
  const confirmarBorrarEmpleado = async () => {
    if (!empleadoAccion) return;

    const { error } = await supabase
      .from("empleados")
      .delete()
      .eq("id", empleadoAccion.id);

    setModalConfirmarBorrarVisible(false);
    setEmpleadoAccion(null);

    if (error) {
      Alert.alert("Error", "No se pudo eliminar el empleado: " + error.message);
    } else {
      Alert.alert("Éxito", "Empleado eliminado correctamente.");
      cargarEmpleados();
    }
  };

  const abrirEditar = (emp: Empleado) => {
    setEmpleadoSeleccionado(emp);
    setNombresEdit(emp.nombres || "");
    setApellidosEdit(emp.apellidos || "");
    setCedulaEdit(emp.cedula || "");
    setCorreoEdit(emp.correo || "");
    setTelefonoEdit(emp.telefono || "");
    setPasswordEdit("");
    setModalEditarVisible(true);
  };

  const guardarEdicion = async () => {
    if (!empleadoSeleccionado) return;

    const updateData: any = {
      nombres: nombresEdit.trim(),
      apellidos: apellidosEdit.trim(),
      cedula: cedulaEdit.trim(),
      correo: correoEdit.trim().toLowerCase(),
      telefono: telefonoEdit.trim(),
    };

    const { error } = await supabase
      .from("empleados")
      .update(updateData)
      .eq("id", empleadoSeleccionado.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (passwordEdit.trim() !== "") {
      try {
        const response = await fetch(
          "https://[TU-PROYECTO].supabase.co/functions/v1/update-user-password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              userId: empleadoSeleccionado.id,
              newPassword: passwordEdit.trim(),
            }),
          },
        );

        const result = await response.json();
        if (!response.ok) {
          Alert.alert(
            "Aviso",
            "Datos actualizados, pero hubo un problema al actualizar la contraseña: " +
              (result.error || "Error desconocido"),
          );
          setModalEditarVisible(false);
          cargarEmpleados();
          return;
        }
      } catch (err: any) {
        console.log("Error actualizando contraseña en Auth:", err);
      }
    }

    Alert.alert("Éxito", "Datos del empleado actualizados.");
    setModalEditarVisible(false);
    cargarEmpleados();
  };

  const empleadosFiltrados = empleados.filter((emp) =>
    `${emp.nombres} ${emp.apellidos} ${emp.cedula}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={localStyles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Vista bloqueada para empleados comunes
  if (rolUsuario === "empleado") {
    return (
      <View style={localStyles.loaderContainer}>
        <Text
          style={[
            localStyles.headerTitle,
            { textAlign: "center", marginBottom: 10 },
          ]}
        >
          Acceso Restringido
        </Text>
        <Text
          style={[
            localStyles.subtitle,
            { textAlign: "center", paddingHorizontal: 30 },
          ]}
        >
          No tienes permisos para ver esta pantalla. Esta sección es exclusiva
          para administradores y secretarias.
        </Text>
      </View>
    );
  }

  return (
    <View style={localStyles.container}>
      <View style={localStyles.headerRow}>
        <View>
          <Text style={localStyles.headerTitle}>Gestión de Empleados</Text>
          <Text style={localStyles.subtitle}>
            Control de personal y accesos ({rolUsuario})
          </Text>
        </View>
      </View>

      <TextInput
        style={localStyles.searchBar}
        placeholder="🔍 Buscar por cédula, nombre o apellido..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor={colors.textSecondary}
      />

      <View style={localStyles.tableHeader}>
        <Text style={[localStyles.tableHeaderText, { flex: 1.5 }]}>
          Nombre y Cédula
        </Text>
        <Text
          style={[
            localStyles.tableHeaderText,
            { flex: 1.8, textAlign: "center" },
          ]}
        >
          Acciones de Control
        </Text>
      </View>

      <FlatList
        data={empleadosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={localStyles.tableRow}>
            <View style={{ flex: 1.5, justifyContent: "center" }}>
              <Text style={localStyles.rowName}>
                {item.nombres} {item.apellidos}
              </Text>
              <Text style={localStyles.rowSub}>Cédula: {item.cedula}</Text>
              <Text
                style={[
                  localStyles.rowSub,
                  {
                    color: item.estado ? colors.accentGreen : colors.accentRed,
                    fontWeight: "bold",
                  },
                ]}
              >
                {item.estado ? "● Activo" : "● Desactivado"}
              </Text>
            </View>

            <View style={localStyles.actionsContainer}>
              <TouchableOpacity
                style={[
                  localStyles.actionBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  setEmpleadoSeleccionado(item);
                  setModalVerVisible(true);
                }}
              >
                <Text style={localStyles.actionBtnText}>Ver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  localStyles.actionBtn,
                  {
                    backgroundColor: item.estado
                      ? colors.accentBlue
                      : colors.accentGreen,
                  },
                ]}
                onPress={() => {
                  setEmpleadoAccion(item);
                  setModalConfirmarEstadoVisible(true);
                }}
              >
                <Text style={localStyles.actionBtnText}>
                  {item.estado ? "Desactivar" : "Activar"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  localStyles.actionBtn,
                  { backgroundColor: colors.accentYellow },
                ]}
                onPress={() => abrirEditar(item)}
              >
                <Text style={localStyles.actionBtnText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  localStyles.actionBtn,
                  { backgroundColor: colors.accentRed },
                ]}
                onPress={() => {
                  setEmpleadoAccion(item);
                  setModalConfirmarBorrarVisible(true);
                }}
              >
                <Text style={localStyles.actionBtnText}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={localStyles.emptyText}>
            No se encontraron empleados registrados.
          </Text>
        }
      />

      {/* MODAL: CONFIRMAR CAMBIO DE ESTADO */}
      <Modal
        visible={modalConfirmarEstadoVisible}
        transparent
        animationType="fade"
      >
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={globalStyles.modalTitle}>Confirmar Acción</Text>
            <Text style={localStyles.modalMessageText}>
              ¿Estás seguro de{" "}
              {empleadoAccion?.estado ? "desactivar" : "activar"} al empleado{" "}
              <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                {empleadoAccion?.nombres} {empleadoAccion?.apellidos}
              </Text>
              ?
            </Text>
            <View style={localStyles.modalButtonsRow}>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.border },
                ]}
                onPress={() => {
                  setModalConfirmarEstadoVisible(false);
                  setEmpleadoAccion(null);
                }}
              >
                <Text style={localStyles.actionBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.accentGreen },
                ]}
                onPress={confirmarCambioEstado}
              >
                <Text style={localStyles.actionBtnText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: CONFIRMAR BORRADO */}
      <Modal
        visible={modalConfirmarBorrarVisible}
        transparent
        animationType="fade"
      >
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={globalStyles.modalTitle}>Confirmar Eliminación</Text>
            <Text style={localStyles.modalMessageText}>
              ¿Estás seguro de eliminar permanentemente a{" "}
              <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                {empleadoAccion?.nombres} {empleadoAccion?.apellidos}
              </Text>
              ? Esta acción no se puede deshacer.
            </Text>
            <View style={localStyles.modalButtonsRow}>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.border },
                ]}
                onPress={() => {
                  setModalConfirmarBorrarVisible(false);
                  setEmpleadoAccion(null);
                }}
              >
                <Text style={localStyles.actionBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.accentRed },
                ]}
                onPress={confirmarBorrarEmpleado}
              >
                <Text style={localStyles.actionBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL VER DETALLES */}
      <Modal visible={modalVerVisible} transparent animationType="fade">
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={globalStyles.modalTitle}>Detalles del Empleado</Text>
            {empleadoSeleccionado && (
              <View style={localStyles.modalBody}>
                <Text style={localStyles.modalLabel}>Nombres:</Text>
                <Text style={localStyles.modalValue}>
                  {empleadoSeleccionado.nombres}
                </Text>

                <Text style={localStyles.modalLabel}>Apellidos:</Text>
                <Text style={localStyles.modalValue}>
                  {empleadoSeleccionado.apellidos}
                </Text>

                <Text style={localStyles.modalLabel}>Cédula:</Text>
                <Text style={localStyles.modalValue}>
                  {empleadoSeleccionado.cedula}
                </Text>

                <Text style={localStyles.modalLabel}>Correo:</Text>
                <Text style={localStyles.modalValue}>
                  {empleadoSeleccionado.correo}
                </Text>

                <Text style={localStyles.modalLabel}>Teléfono:</Text>
                <Text style={localStyles.modalValue}>
                  {empleadoSeleccionado.telefono || "No registrado"}
                </Text>

                <Text style={localStyles.modalLabel}>Estado de Acceso:</Text>
                <Text
                  style={[
                    localStyles.modalValue,
                    {
                      color: empleadoSeleccionado.estado
                        ? colors.accentGreen
                        : colors.accentRed,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {empleadoSeleccionado.estado
                    ? "● Activo (Permitido)"
                    : "● Desactivado"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={localStyles.modalCloseBtn}
              onPress={() => setModalVerVisible(false)}
            >
              <Text style={localStyles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR EMPLEADO */}
      <Modal visible={modalEditarVisible} transparent animationType="fade">
        <View style={globalStyles.modalOverlay}>
          <View style={globalStyles.modalContent}>
            <Text style={globalStyles.modalTitle}>Editar Empleado</Text>
            <ScrollView style={{ width: "100%" }}>
              <Text style={localStyles.inputLabel}>Nombres</Text>
              <TextInput
                style={localStyles.inputModal}
                value={nombresEdit}
                onChangeText={(text) =>
                  setNombresEdit(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))
                }
                placeholder="Nombres"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={localStyles.inputLabel}>Apellidos</Text>
              <TextInput
                style={localStyles.inputModal}
                value={apellidosEdit}
                onChangeText={(text) =>
                  setApellidosEdit(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))
                }
                placeholder="Apellidos"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={localStyles.inputLabel}>Cédula</Text>
              <TextInput
                style={localStyles.inputModal}
                value={cedulaEdit}
                onChangeText={(text) =>
                  setCedulaEdit(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="numeric"
                placeholder="Cédula"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={localStyles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={localStyles.inputModal}
                value={correoEdit}
                onChangeText={setCorreoEdit}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="correo@ejemplo.com"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={localStyles.inputLabel}>Número de Teléfono</Text>
              <TextInput
                style={localStyles.inputModal}
                value={telefonoEdit}
                onChangeText={(text) =>
                  setTelefonoEdit(text.replace(/[^0-9+]/g, ""))
                }
                keyboardType="phone-pad"
                placeholder="Ej. 04141234567"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={localStyles.inputLabel}>
                Nueva Contraseña (Opcional)
              </Text>
              <TextInput
                style={localStyles.inputModal}
                value={passwordEdit}
                onChangeText={setPasswordEdit}
                secureTextEntry
                placeholder="Dejar en blanco para no cambiar"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>

            <View style={localStyles.modalButtonsRow}>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.border },
                ]}
                onPress={() => setModalEditarVisible(false)}
              >
                <Text style={localStyles.actionBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  localStyles.modalBtnAction,
                  { backgroundColor: colors.accentGreen },
                ]}
                onPress={guardarEdicion}
              >
                <Text style={localStyles.actionBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  searchBar: {
    backgroundColor: colors.cardBackground,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.cardBackground,
    padding: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeaderText: {
    fontWeight: "bold",
    color: colors.accentBlue,
    fontSize: 15,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: colors.cardBackground,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  rowName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsContainer: {
    flex: 1.8,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "center",
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
  modalMessageText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  modalBody: {
    marginBottom: 20,
    width: "100%",
  },
  modalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  modalValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "600",
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  modalCloseText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 10,
  },
  inputModal: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
    width: "100%",
  },
  modalBtnAction: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
