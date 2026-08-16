import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";

import { supabase } from "../../supabase";
import { colors, globalStyles } from "@/constants/globalStyles";

export default function ClientesScreen() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [esPrivilegiado, setEsPrivilegiado] = useState(false); // Admin o Secretaría

  // Estados para el Modal de Edición
  const [modalVisible, setModalVisible] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [nombresEdit, setNombresEdit] = useState("");
  const [apellidosEdit, setApellidosEdit] = useState("");
  const [telefonoEdit, setTelefonoEdit] = useState("");
  const [direccionEdit, setDireccionEdit] = useState("");

  useEffect(() => {
    verificarRolYObtenerClientes();
  }, []);

  const verificarRolYObtenerClientes = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user?.email) return;

      const emailLogueado = session.user.email.trim().toLowerCase();

      // 1. Verificar si es Administrador
      const { data: adminData } = await supabase
        .from("administradores")
        .select("cedula")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (adminData) {
        setEsPrivilegiado(true);
        await obtenerTodosLosClientes();
        return;
      }

      // 2. Verificar si es Secretaria
      const { data: secData } = await supabase
        .from("secretaria")
        .select("cedula")
        .eq("correo", emailLogueado)
        .eq("aprobado", "aprobado")
        .maybeSingle();

      if (secData) {
        setEsPrivilegiado(true);
        await obtenerTodosLosClientes();
        return;
      }

      // 3. Verificar si es Empleado
      const { data: empData } = await supabase
        .from("empleados")
        .select("id, cedula")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (empData) {
        setEsPrivilegiado(false);

        // Buscar la ruta asignada en la tabla intermedia 'empleado_rutas'
        const { data: rutaRelacion, error: rutaError } = await supabase
          .from("empleado_rutas")
          .select("ruta_id")
          .eq("empleado_id", empData.id)
          .maybeSingle();

        if (rutaError || !rutaRelacion?.ruta_id) {
          console.log(
            "El empleado no tiene una ruta asignada en empleado_rutas",
          );
          setClientes([]);
          return;
        }

        // Obtener los clientes que pertenecen a esa ruta_id
        const { data: clientesRuta, error: clientesError } = await supabase
          .from("clientes")
          .select("*")
          .eq("ruta_id", rutaRelacion.ruta_id)
          .order("nombres", { ascending: true });

        if (clientesRuta) {
          setClientes(clientesRuta);
        }
        if (clientesError) {
          console.error("Error obteniendo clientes de la ruta:", clientesError);
        }
      }
    } catch (error) {
      console.error("Error al verificar el rol y filtrar clientes:", error);
    }
  };

  const obtenerTodosLosClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nombres", { ascending: true });

    if (data) setClientes(data);
    if (error) console.error("Error obteniendo todos los clientes:", error);
  };

  const abrirModalEditar = (item: any) => {
    setClienteSeleccionado(item);
    setNombresEdit(item.nombres || "");
    setApellidosEdit(item.apellidos || "");
    setTelefonoEdit(item.telefono || "");
    setDireccionEdit(item.direccion || "");
    setModalVisible(true);
  };

  const guardarCambiosCliente = async () => {
    if (!clienteSeleccionado) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .update({
          nombres: nombresEdit,
          apellidos: apellidosEdit,
          telefono: telefonoEdit,
          direccion: direccionEdit,
        })
        .eq("cedula", clienteSeleccionado.cedula);

      if (error) throw error;

      Alert.alert(
        "Éxito",
        "Los datos del cliente han sido actualizados correctamente.",
      );
      setModalVisible(false);
      verificarRolYObtenerClientes();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo actualizar el cliente.",
      );
    }
  };

  const clientesFiltrados = clientes.filter((c) =>
    `${c.nombres} ${c.apellidos}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Gestión de Clientes</Text>

      {/* Buscador */}
      <TextInput
        style={styles.search}
        placeholder="🔍 Buscar por nombre o apellido..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor={colors.textSecondary}
      />

      {/* Listado con scroll */}
      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.cedula}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.cardHeader}>
              <View style={styles.nameContainer}>
                <Text style={styles.itemName}>
                  {item.nombres} {item.apellidos}
                </Text>
              </View>

              {/* Botón de editar visible SOLO para Administrador y Secretaría */}
              {esPrivilegiado && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => abrirModalEditar(item)}
                >
                  <Text style={styles.editButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsContainer}>
              <Text style={styles.itemDetail}>
                📞 <Text style={styles.detailLabel}>Teléfono:</Text>{" "}
                {item.telefono || "No registrado"}
              </Text>

              <Text style={styles.itemDetail}>
                📍 <Text style={styles.detailLabel}>Dirección:</Text>{" "}
                {item.direccion || "No registrada"}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Modal para Editar Cliente */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={globalStyles.modalOverlay}>
          <View style={[globalStyles.modalContent, styles.modalContainer]}>
            <Text style={globalStyles.modalTitle}>✏️ Editar Cliente</Text>

            <ScrollView
              contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
            >
              <View>
                <Text style={styles.inputLabel}>Nombres</Text>
                <TextInput
                  style={styles.inputModal}
                  value={nombresEdit}
                  onChangeText={setNombresEdit}
                  placeholder="Nombres del cliente"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Apellidos</Text>
                <TextInput
                  style={styles.inputModal}
                  value={apellidosEdit}
                  onChangeText={setApellidosEdit}
                  placeholder="Apellidos del cliente"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Número de Teléfono</Text>
                <TextInput
                  style={styles.inputModal}
                  value={telefonoEdit}
                  onChangeText={setTelefonoEdit}
                  placeholder="Teléfono"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Dirección</Text>
                <TextInput
                  style={[
                    styles.inputModal,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                  value={direccionEdit}
                  onChangeText={setDireccionEdit}
                  placeholder="Dirección"
                  multiline
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.btnSave]}
                onPress={guardarCambiosCliente}
              >
                <Text style={styles.modalBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    color: colors.textPrimary,
  },
  search: {
    backgroundColor: colors.cardBackground,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.textPrimary,
  },
  itemCard: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nameContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  editButton: {
    backgroundColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  detailsContainer: {
    gap: 6,
  },
  itemDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailLabel: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  modalContainer: {
    width: "92%",
    maxWidth: 450,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  inputModal: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: colors.border,
  },
  btnSave: {
    backgroundColor: colors.accentGreen || "#28a745",
  },
  modalBtnText: {
    fontWeight: "bold",
    color: colors.textPrimary,
    fontSize: 14,
  },
});
