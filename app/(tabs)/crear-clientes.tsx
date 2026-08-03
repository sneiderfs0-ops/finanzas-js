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
} from "react-native";
import { supabase } from "../../supabase";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useRouter } from "expo-router";

export default function CrearClienteModal({
  onClose,
  onClienteCreado,
}: {
  onClose: () => void;
  onClienteCreado: () => void;
}) {
  const router = useRouter();
  const colorScheme = useColorScheme();
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

      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        Alert.alert("Error", "No se encontró una sesión activa.");
        setLoading(false);
        return;
      }

      const userId = authData.user.id;
      const emailLogueado = authData.user.email?.trim().toLowerCase();
      let cedulaUsuarioLogueado = null;

      // 1. Buscar en administradores
      let queryAdmin = supabase.from("administradores").select("cedula");
      if (userId) queryAdmin = queryAdmin.eq("id", userId);
      else if (emailLogueado)
        queryAdmin = queryAdmin.eq("correo", emailLogueado);

      const { data: adminData } = await queryAdmin.maybeSingle();

      if (adminData) {
        cedulaUsuarioLogueado = adminData.cedula;
      } else {
        // 2. Buscar en empleados
        let queryEmp = supabase.from("empleados").select("cedula");
        if (userId) queryEmp = queryEmp.eq("id", userId);
        else if (emailLogueado) queryEmp = queryEmp.eq("correo", emailLogueado);

        const { data: empData } = await queryEmp.maybeSingle();

        if (empData) {
          cedulaUsuarioLogueado = empData.cedula;
        } else {
          // 3. Buscar en secretaria
          let querySec = supabase.from("secretaria").select("cedula");
          if (userId) querySec = querySec.eq("id", userId);
          else if (emailLogueado)
            querySec = querySec.eq("correo", emailLogueado);

          const { data: secData } = await querySec.maybeSingle();

          if (secData) {
            cedulaUsuarioLogueado = secData.cedula;
          }
        }
      }

      // Inserción en la tabla de clientes utilizando la cédula encontrada
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

      // Limpiar campos
      setCedula("");
      setNombres("");
      setApellidos("");
      setTelefono("");
      setDireccion("");

      // Notificamos que se creó el cliente
      onClienteCreado();

      // Mostramos el modal de éxito
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
    setTimeout(() => {
      onClose();
    }, 200);
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
        placeholderTextColor="#94a3b8"
        value={cedula}
        onChangeText={(text) => {
          const numericText = text.replace(/[^0-9]/g, "");
          if (numericText.length <= 10) setCedula(numericText);
        }}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Nombres *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Juan Carlos"
        placeholderTextColor="#94a3b8"
        value={nombres}
        onChangeText={(text) => {
          const lettersText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
          if (lettersText.length <= 25) setNombres(lettersText);
        }}
      />

      <Text style={styles.label}>Apellidos *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Pérez Gómez"
        placeholderTextColor="#94a3b8"
        value={apellidos}
        onChangeText={(text) => {
          const lettersText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
          if (lettersText.length <= 25) setApellidos(lettersText);
        }}
      />

      <Text style={styles.label}>Teléfono *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 0414123457"
        placeholderTextColor="#94a3b8"
        value={telefono}
        onChangeText={(text) => {
          const numericText = text.replace(/[^0-9]/g, "");
          if (numericText.length <= 15) setTelefono(numericText);
        }}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Dirección</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Calle Principal, Casa #12"
        placeholderTextColor="#94a3b8"
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
        onPress={() => router.replace("/")} // Redirige directamente al index
      >
        <Text style={styles.btnCloseText}>Cancelar</Text>
      </TouchableOpacity>

      {/* Modal de Éxito */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={handleCerrarExito}
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
            <Text style={styles.successMessage}>
              El cliente ha sido guardado exitosamente en el sistema.
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
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#94a3b8",
  },
  input: {
    backgroundColor: "#ffffff",
    color: "#000000",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 15,
  },
  btnGuardar: {
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnClose: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnCloseText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalContent: {
    width: "100%",
    maxWidth: 350,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 5,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
  btnSuccessOk: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
});
