import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useRouter } from "expo-router";

// Se definen las props como opcionales con el signo '?' para evitar errores de tipo
export default function CrearClienteModal({
  onClose,
  onClienteCreado,
}: {
  onClose?: () => void;
  onClienteCreado?: () => void;
}) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const handleCrearCliente = async () => {
    if (
      !cedula.trim() ||
      !nombres.trim() ||
      !apellidos.trim() ||
      !telefono.trim()
    ) {
      Alert.alert("Error", "Por favor completa los campos obligatorios.");
      return;
    }

    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error("No se encontró una sesión activa.");
      }

      const userId = authData.user.id;
      const emailLogueado = authData.user.email?.trim().toLowerCase();
      let cedulaUsuarioLogueado = null;

      // Buscar cédula del usuario en tablas de roles
      const tablas = ["administradores", "empleados", "secretaria"];
      for (const tabla of tablas) {
        const { data } = await supabase
          .from(tabla)
          .select("cedula")
          .or(`id.eq.${userId},correo.eq.${emailLogueado}`)
          .maybeSingle();

        if (data?.cedula) {
          cedulaUsuarioLogueado = data.cedula;
          break;
        }
      }

      const { error } = await supabase.from("clientes").insert([
        {
          cedula: cedula.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          registrado_por_cedula: cedulaUsuarioLogueado,
        },
      ]);

      if (error) throw error;

      // Resetear campos
      setCedula("");
      setNombres("");
      setApellidos("");
      setTelefono("");
      setDireccion("");

      // Ejecutar callback si existe
      if (onClienteCreado) onClienteCreado();
      setSuccessModalVisible(true);
    } catch (error: any) {
      console.log("Error detallado al registrar cliente:", error);
      Alert.alert("Error", error.message || "No se pudo registrar el cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarExito = () => {
    setSuccessModalVisible(false);
    if (onClose) onClose();
    else router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
        📝 Registrar Nuevo Cliente
      </Text>

      <Text style={styles.label}>Cédula *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 12345678"
        value={cedula}
        onChangeText={setCedula}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Nombres *</Text>
      <TextInput
        style={styles.input}
        value={nombres}
        onChangeText={setNombres}
      />

      <Text style={styles.label}>Apellidos *</Text>
      <TextInput
        style={styles.input}
        value={apellidos}
        onChangeText={setApellidos}
      />

      <Text style={styles.label}>Teléfono *</Text>
      <TextInput
        style={styles.input}
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Dirección</Text>
      <TextInput
        style={styles.input}
        value={direccion}
        onChangeText={setDireccion}
      />

      <TouchableOpacity
        style={[styles.btnGuardar, loading && { opacity: 0.7 }]}
        onPress={handleCrearCliente}
        disabled={loading}
      >
        <Text style={styles.btnText}>
          {loading ? "Guardando..." : "Guardar Cliente"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnClose}
        onPress={() => (onClose ? onClose() : router.replace("/"))}
      >
        <Text style={styles.btnCloseText}>Cancelar</Text>
      </TouchableOpacity>

      {/* Modal de Éxito */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.successModalContent,
              { backgroundColor: Colors[colorScheme].background },
            ]}
          >
            <Text style={styles.successIcon}>🎉</Text>
            <Text
              style={[styles.successTitle, { color: Colors[colorScheme].text }]}
            >
              ¡Cliente Registrado!
            </Text>
            <TouchableOpacity
              style={styles.btnSuccessOk}
              onPress={handleCerrarExito}
            >
              <Text style={styles.btnText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, justifyContent: "center" },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, color: "#94a3b8" },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  btnGuardar: {
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnClose: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnCloseText: { color: "#fff", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModalContent: {
    width: "90%",
    maxWidth: 350,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)" },
      default: { elevation: 5 },
    }),
  },
  successIcon: { fontSize: 40, marginBottom: 10 },
  successTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  btnSuccessOk: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
});
