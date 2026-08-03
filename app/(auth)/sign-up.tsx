import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { supabase } from "../../supabase";
import { router, Link } from "expo-router";

export default function SignUpScreen() {
  const [rol, setRol] = useState<"empleado" | "secretaria">("empleado");
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const limpiarCampos = () => {
    setCedula("");
    setNombres("");
    setApellidos("");
    setTelefono("");
    setEmail("");
    setPassword("");
    setRol("empleado");
  };

  const handleSignUp = async () => {
    if (!cedula || !nombres || !apellidos || !email || !password || !rol) {
      Alert.alert(
        "Campos incompletos",
        "Por favor llena todos los campos obligatorios.",
      );
      return;
    }

    const soloNumeros = /^[0-9]+$/;
    const soloLetras = /^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/;
    const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!soloNumeros.test(cedula) || cedula.length > 12) {
      Alert.alert(
        "Campo inválido",
        "La cédula debe contener solo números (máximo 12 dígitos).",
      );
      return;
    }
    if (!soloLetras.test(nombres) || nombres.length > 20) {
      Alert.alert(
        "Campo inválido",
        "Los nombres deben contener solo letras (máximo 20 caracteres).",
      );
      return;
    }
    if (!soloLetras.test(apellidos) || apellidos.length > 20) {
      Alert.alert(
        "Campo inválido",
        "Los apellidos deben contener solo letras (máximo 20 caracteres).",
      );
      return;
    }
    if (!soloNumeros.test(telefono) || telefono.length > 15) {
      Alert.alert(
        "Campo inválido",
        "El teléfono debe contener solo números (máximo 15 dígitos).",
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!formatoEmail.test(cleanEmail)) {
      Alert.alert("Correo inválido", "Ingresa un correo electrónico válido.");
      return;
    }

    setLoading(true);

    try {
      // 1. Validar si la cédula ya existe en alguna de las tablas
      const { data: adminCedula } = await supabase
        .from("administradores")
        .select("cedula")
        .eq("cedula", cedula)
        .maybeSingle();

      const { data: empCedula } = await supabase
        .from("empleados")
        .select("cedula")
        .eq("cedula", cedula)
        .maybeSingle();

      const { data: secCedula } = await supabase
        .from("secretaria")
        .select("cedula")
        .eq("cedula", cedula)
        .maybeSingle();

      if (adminCedula || empCedula || secCedula) {
        setLoading(false);
        setModalTitle("Cédula ya registrada");
        setModalMessage(
          "El número de cédula ingresado ya se encuentra registrado en el sistema.",
        );
        setModalVisible(true);
        return;
      }

      // 2. Registrar en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
      });

      if (authError) {
        setLoading(false);
        if (
          authError.message.toLowerCase().includes("already registered") ||
          authError.message.toLowerCase().includes("already exists")
        ) {
          setModalTitle("Correo ya registrado");
          setModalMessage(
            "El correo electrónico ingresado ya pertenece a una cuenta existente.",
          );
          setModalVisible(true);
          return;
        }

        Alert.alert("Error de autenticación", authError.message);
        return;
      }

      // Obtener el ID real generado por Supabase Auth
      const userId = authData.user?.id;
      if (!userId) {
        setLoading(false);
        Alert.alert(
          "Error",
          "No se pudo obtener el ID del usuario autenticado.",
        );
        return;
      }

      // 3. Insertar el registro usando el ID real de Auth en la tabla correspondiente
      const tablaDestino = rol === "secretaria" ? "secretaria" : "empleados";

      const { error: dbError } = await supabase.from(tablaDestino).insert([
        {
          id: userId,
          cedula: cedula,
          nombres: nombres,
          apellidos: apellidos,
          telefono: telefono,
          correo: cleanEmail,
          estado: true,
          aprobado: "pendiente",
          rol: rol,
        },
      ]);

      if (dbError) {
        setLoading(false);
        console.log(
          "❌ ERROR EN BASE DE DATOS:",
          JSON.stringify(dbError, null, 2),
        );
        Alert.alert(
          "Error de base de datos",
          dbError.message + "\n" + (dbError.details || ""),
        );
        return;
      }

      // 4. Cerrar sesión para que espere la aprobación del administrador
      await supabase.auth.signOut();

      setModalTitle("¡Registro Exitoso!");
      setModalMessage(
        "Tu cuenta ha sido registrada correctamente. Queda a la espera de aprobación por parte del administrador para poder iniciar sesión.",
      );

      limpiarCampos();
      setModalVisible(true);
    } catch (err: any) {
      setLoading(false);
      console.log("❌ ERROR INESPERADO:", JSON.stringify(err, null, 2));
      Alert.alert(
        "Error inesperado",
        err?.message || "Ocurrió un fallo al procesar tu registro.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    if (modalTitle === "¡Registro Exitoso!") {
      router.replace("/(auth)/sign-in");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.card}>
        <Text style={styles.title}>📝 Crear Cuenta</Text>
        <Text style={styles.subtitle}>Completa tus datos para registrarte</Text>

        <Text style={styles.label}>Selecciona tu Rol:</Text>
        <View style={styles.rolContainer}>
          <TouchableOpacity
            style={[styles.rolButton, rol === "empleado" && styles.rolSelected]}
            onPress={() => setRol("empleado")}
          >
            <Text
              style={[
                styles.rolText,
                rol === "empleado" && styles.rolTextSelected,
              ]}
            >
              Empleado
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rolButton,
              rol === "secretaria" && styles.rolSelected,
            ]}
            onPress={() => setRol("secretaria")}
          >
            <Text
              style={[
                styles.rolText,
                rol === "secretaria" && styles.rolTextSelected,
              ]}
            >
              Secretaria
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Cédula"
          value={cedula}
          onChangeText={(text) => setCedula(text.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          maxLength={12}
          placeholderTextColor="#a4b0be"
        />
        <TextInput
          style={styles.input}
          placeholder="Nombres"
          value={nombres}
          onChangeText={(text) =>
            setNombres(text.replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]/g, ""))
          }
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />
        <TextInput
          style={styles.input}
          placeholder="Apellidos"
          value={apellidos}
          onChangeText={(text) =>
            setApellidos(text.replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]/g, ""))
          }
          maxLength={20}
          placeholderTextColor="#a4b0be"
        />
        <TextInput
          style={styles.input}
          placeholder="Número de Teléfono"
          value={telefono}
          onChangeText={(text) => setTelefono(text.replace(/[^0-9]/g, ""))}
          keyboardType="phone-pad"
          maxLength={15}
          placeholderTextColor="#a4b0be"
        />
        <TextInput
          style={styles.input}
          placeholder="Correo Electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#a4b0be"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#a4b0be"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrarse</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleModalClose}
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 30,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    color: "#1e293b",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#64748b",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  rolContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  rolButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  rolSelected: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  rolText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  rolTextSelected: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    fontSize: 15,
    color: "#1e293b",
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    color: "#64748b",
    fontSize: 14,
  },
  loginLink: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 10,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: "#6366f1",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
