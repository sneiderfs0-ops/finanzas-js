import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../supabase";

interface Empleado {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  estado: boolean;
}

export default function GestionEmpleadosScreen() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Modales generales
  const [modalVerVisible, setModalVerVisible] = useState(false);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] =
    useState<Empleado | null>(null);

  // Estados para los nuevos Modales de Confirmación Personalizados
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

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("empleados")
      .select("id, nombres, apellidos, cedula, correo, estado")
      .order("nombres", { ascending: true });

    if (error) {
      console.log("Error al cargar empleados:", error.message);
      Alert.alert("Error", "No se pudieron cargar los empleados.");
    } else {
      setEmpleados(data || []);
    }
    setLoading(false);
  };

  // Ejecutar Cambio de Estado
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
        "No se aplicaron cambios. Revisa las políticas RLS.",
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
      cargarEmpleados();
    }
  };

  const abrirEditar = (emp: Empleado) => {
    setEmpleadoSeleccionado(emp);
    setNombresEdit(emp.nombres);
    setApellidosEdit(emp.apellidos);
    setCedulaEdit(emp.cedula);
    setCorreoEdit(emp.correo);
    setModalEditarVisible(true);
  };

  const guardarEdicion = async () => {
    if (!empleadoSeleccionado) return;

    const { error } = await supabase
      .from("empleados")
      .update({
        nombres: nombresEdit.trim(),
        apellidos: apellidosEdit.trim(),
        cedula: cedulaEdit.trim(),
        correo: correoEdit.trim().toLowerCase(),
      })
      .eq("id", empleadoSeleccionado.id);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Éxito", "Datos del empleado actualizados.");
      setModalEditarVisible(false);
      cargarEmpleados();
    }
  };

  const empleadosFiltrados = empleados.filter((emp) =>
    `${emp.nombres} ${emp.apellidos} ${emp.cedula}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0984e3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Gestión de Empleados</Text>
          <Text style={styles.subtitle}>Control de personal y accesos</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/registrar-empleado")}
        >
          <Text style={styles.addButtonText}>+ Registrar Empleado</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="🔍 Buscar por cédula, nombre o apellido..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor="#a4b0be"
      />

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>
          Nombre y Cédula
        </Text>
        <Text
          style={[styles.tableHeaderText, { flex: 1.8, textAlign: "center" }]}
        >
          Acciones de Control
        </Text>
      </View>

      <FlatList
        data={empleadosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <View style={{ flex: 1.5, justifyContent: "center" }}>
              <Text style={styles.rowName}>
                {item.nombres} {item.apellidos}
              </Text>
              <Text style={styles.rowSub}>Cédula: {item.cedula}</Text>
              <Text
                style={[
                  styles.rowSub,
                  {
                    color: item.estado ? "#27ae60" : "#c0392b",
                    fontWeight: "bold",
                  },
                ]}
              >
                {item.estado ? "● Activo" : "● Desactivado"}
              </Text>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#0984e3" }]}
                onPress={() => {
                  setEmpleadoSeleccionado(item);
                  setModalVerVisible(true);
                }}
              >
                <Text style={styles.actionBtnText}>Ver</Text>
              </TouchableOpacity>

              {/* Botón Activar / Desactivar con Modal */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: item.estado ? "#e67e22" : "#27ae60" },
                ]}
                onPress={() => {
                  setEmpleadoAccion(item);
                  setModalConfirmarEstadoVisible(true);
                }}
              >
                <Text style={styles.actionBtnText}>
                  {item.estado ? "Desactivar" : "Activar"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#f39c12" }]}
                onPress={() => abrirEditar(item)}
              >
                <Text style={styles.actionBtnText}>Editar</Text>
              </TouchableOpacity>

              {/* Botón Borrar con Modal */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#e74c3c" }]}
                onPress={() => {
                  setEmpleadoAccion(item);
                  setModalConfirmarBorrarVisible(true);
                }}
              >
                <Text style={styles.actionBtnText}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No se encontraron empleados registrados.
          </Text>
        }
      />

      {/* MODAL: CONFIRMAR CAMBIO DE ESTADO (ACTIVAR / DESACTIVAR) */}
      <Modal
        visible={modalConfirmarEstadoVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Acción</Text>
            <Text style={styles.modalMessageText}>
              ¿Estás seguro de{" "}
              {empleadoAccion?.estado ? "desactivar" : "activar"} al empleado{" "}
              <Text style={{ fontWeight: "bold" }}>
                {empleadoAccion?.nombres} {empleadoAccion?.apellidos}
              </Text>
              ?
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#95a5a6" }]}
                onPress={() => {
                  setModalConfirmarEstadoVisible(false);
                  setEmpleadoAccion(null);
                }}
              >
                <Text style={styles.actionBtnText}>Denegar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#27ae60" }]}
                onPress={confirmarCambioEstado}
              >
                <Text style={styles.actionBtnText}>Aceptar</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Eliminación</Text>
            <Text style={styles.modalMessageText}>
              ¿Estás seguro de eliminar permanentemente a{" "}
              <Text style={{ fontWeight: "bold" }}>
                {empleadoAccion?.nombres} {empleadoAccion?.apellidos}
              </Text>
              ? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#95a5a6" }]}
                onPress={() => {
                  setModalConfirmarBorrarVisible(false);
                  setEmpleadoAccion(null);
                }}
              >
                <Text style={styles.actionBtnText}>Denegar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#e74c3c" }]}
                onPress={confirmarBorrarEmpleado}
              >
                <Text style={styles.actionBtnText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL VER DETALLES */}
      <Modal visible={modalVerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detalles del Empleado</Text>
            {empleadoSeleccionado && (
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Nombres:</Text>
                <Text style={styles.modalValue}>
                  {empleadoSeleccionado.nombres}
                </Text>

                <Text style={styles.modalLabel}>Apellidos:</Text>
                <Text style={styles.modalValue}>
                  {empleadoSeleccionado.apellidos}
                </Text>

                <Text style={styles.modalLabel}>Cédula:</Text>
                <Text style={styles.modalValue}>
                  {empleadoSeleccionado.cedula}
                </Text>

                <Text style={styles.modalLabel}>Correo:</Text>
                <Text style={styles.modalValue}>
                  {empleadoSeleccionado.correo}
                </Text>

                <Text style={styles.modalLabel}>Estado de Acceso:</Text>
                <Text
                  style={[
                    styles.modalValue,
                    {
                      color: empleadoSeleccionado.estado
                        ? "#27ae60"
                        : "#c0392b",
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
              style={styles.modalCloseBtn}
              onPress={() => setModalVerVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR EMPLEADO */}
      <Modal visible={modalEditarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Empleado</Text>
            <ScrollView>
              <Text style={styles.inputLabel}>Nombres</Text>
              <TextInput
                style={styles.inputModal}
                value={nombresEdit}
                onChangeText={setNombresEdit}
              />

              <Text style={styles.inputLabel}>Apellidos</Text>
              <TextInput
                style={styles.inputModal}
                value={apellidosEdit}
                onChangeText={setApellidosEdit}
              />

              <Text style={styles.inputLabel}>Cédula</Text>
              <TextInput
                style={styles.inputModal}
                value={cedulaEdit}
                onChangeText={(text) =>
                  setCedulaEdit(text.replace(/[^0-9]/g, ""))
                }
              />

              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={styles.inputModal}
                value={correoEdit}
                onChangeText={setCorreoEdit}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#95a5a6" }]}
                onPress={() => setModalEditarVisible(false)}
              >
                <Text style={styles.actionBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnAction, { backgroundColor: "#27ae60" }]}
                onPress={guardarEdicion}
              >
                <Text style={styles.actionBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f6fa" },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
  },
  headerTitle: { fontSize: 26, fontWeight: "bold", color: "#2f3640" },
  subtitle: { fontSize: 14, color: "#718093" },
  addButton: {
    backgroundColor: "#2ed573",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    elevation: 2,
  },
  addButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  searchBar: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dcdde1",
    marginBottom: 16,
    fontSize: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e1f5fe",
    padding: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableHeaderText: { fontWeight: "bold", color: "#0277bd", fontSize: 15 },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f2f6",
    alignItems: "center",
  },
  rowName: { fontSize: 16, fontWeight: "bold", color: "#2f3640" },
  rowSub: { fontSize: 12, color: "#718093", marginTop: 2 },
  actionsContainer: {
    flex: 1.8,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 4,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  emptyText: {
    textAlign: "center",
    color: "#718093",
    marginTop: 40,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 16,
  },
  modalMessageText: {
    fontSize: 16,
    color: "#2f3640",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalBody: { marginBottom: 20 },
  modalLabel: { fontSize: 13, color: "#718093", marginTop: 8 },
  modalValue: {
    fontSize: 16,
    color: "#2f3640",
    fontWeight: "600",
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: "#0984e3",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  inputLabel: {
    fontSize: 13,
    color: "#2f3640",
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 10,
  },
  inputModal: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dcdde1",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  modalBtnAction: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
