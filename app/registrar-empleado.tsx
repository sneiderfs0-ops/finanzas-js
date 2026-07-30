import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../supabase";

export default function RegistrarEmpleadoScreen() {
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);

  // Estado para controlar la visibilidad de la pantalla emergente (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  const limpiarCampos = () => {
    setCedula("");
    setNombres("");
    setApellidos("");
    setTelefono("");
    setCorreo("");
    setContrasena("");
  };

  const handleRegistrar = async () => {
    if (
      !cedula.trim() ||
      !nombres.trim() ||
      !apellidos.trim() ||
      !telefono.trim() ||
      !correo.trim() ||
      !contrasena.trim()
    ) {
      Alert.alert("Error", "Por favor completa todos los campos obligatorios.");
      return;
    }

    setLoading(true);

    try {
      // 1. Crear el usuario en Supabase Auth
      const { error: authError } = await supabase.auth.signUp({
        email: correo.trim().toLowerCase(),
        password: contrasena,
      });

      if (authError) throw authError;

      // 2. Insertar los datos en la tabla empleados
      const { error: dbError } = await supabase.from("empleados").insert([
        {
          cedula: cedula.trim(),
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim(),
          correo: correo.trim().toLowerCase(),
          estado: true,
        },
      ]);

      if (dbError) throw dbError;

      // Limpiamos los campos inmediatamente al registrar con éxito
      limpiarCampos();

      // Mostramos el mensaje emergente personalizado
      setMensajeExito(
        "¡El empleado ha sido registrado correctamente en el sistema!",
      );
      setModalVisible(true);
    } catch (error: any) {
      console.log("Error detallado:", JSON.stringify(error, null, 2));
      Alert.alert(
        "Error al registrar",
        error.message || "Ocurrió un error inesperado.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarModal = () => {
    setModalVisible(false);
    router.back(); // Regresa a la pantalla anterior al cerrar el modal de éxito
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Registrar Empleado</Text>
        <Text style={styles.subtitle}>
          Completa los datos (máx. 20 caracteres por campo)
        </Text>

        <Text style={styles.label}>Cédula (Solo números)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 26123456"
          value={cedula}
          onChangeText={(text) =>
            setCedula(text.replace(/[^0-9]/g, "").slice(0, 20))
          }
          keyboardType="numeric"
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />

        <Text style={styles.label}>Nombres (Solo letras)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Juan"
          value={nombres}
          onChangeText={(text) =>
            setNombres(
              text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").slice(0, 20),
            )
          }
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />

        <Text style={styles.label}>Apellidos (Solo letras)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Pérez"
          value={apellidos}
          onChangeText={(text) =>
            setApellidos(
              text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").slice(0, 20),
            )
          }
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />

        <Text style={styles.label}>Teléfono (Solo números)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 04121234567"
          value={telefono}
          onChangeText={(text) =>
            setTelefono(text.replace(/[^0-9]/g, "").slice(0, 20))
          }
          keyboardType="phone-pad"
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />

        <Text style={styles.label}>Correo Electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="empleado@correo.com"
          value={correo}
          onChangeText={(text) => setCorreo(text.slice(0, 20))}
          maxLength={20}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#a4b0be"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Máximo 20 caracteres"
          value={contrasena}
          onChangeText={(text) => setContrasena(text.slice(0, 20))}
          maxLength={20}
          secureTextEntry
          placeholderTextColor="#a4b0be"
        />

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleRegistrar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Guardar Empleado</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      {/* Pantalla Emergente (Modal de Éxito) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>¡Registro Exitoso!</Text>
            <Text style={styles.modalMessage}>{mensajeExito}</Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCerrarModal}
            >
              <Text style={styles.modalButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 450,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#718093",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2f3640",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dcdde1",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#2f3640",
  },
  btnPrimary: {
    backgroundColor: "#2ed573",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: "transparent",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  btnSecondaryText: {
    color: "#718093",
    fontWeight: "bold",
    fontSize: 14,
  },
  // Estilos del Modal Emergente
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.2)",
    elevation: 6,
  },
  successIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2ed573",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successIconText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: "#718093",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: "#2ed573",
    width: "100%",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
