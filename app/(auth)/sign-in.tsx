import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from "react-native";
import { supabase } from "../../supabase";
import { router, Link } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para el Modal avanzado
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);

  const mostrarAlertaPersonalizada = (
    titulo: string,
    mensaje: string,
    onAccept?: () => void,
  ) => {
    setModalTitle(titulo);
    setModalMessage(mensaje);
    setModalAction(() => onAccept || (() => setModalVisible(false)));
    setModalVisible(true);
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      mostrarAlertaPersonalizada(
        "⚠️ Atención",
        "Por favor ingresa tu correo y contraseña.",
      );
      return;
    }

    setLoading(true);

    try {
      // 0. Limpieza preventiva local
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});

      // 1. Iniciar sesión en Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

      if (authError) {
        throw authError;
      }

      const userId = authData?.user?.id;

      if (!userId) {
        throw new Error("No se pudo obtener la sesión del usuario.");
      }

      // -----------------------------------------------------------------
      // 2. VERIFICAR EN LA TABLA "administradores" (Acceso libre si existe)
      // -----------------------------------------------------------------
      const { data: adminData } = await supabase
        .from("administradores")
        .select("id, correo")
        .eq("id", userId)
        .maybeSingle();

      if (adminData) {
        router.replace("/(tabs)");
        return;
      }

      // -----------------------------------------------------------------
      // 3. VERIFICAR EN LA TABLA "secretaria" (Debe estar aprobada)
      // -----------------------------------------------------------------
      const { data: secData } = await supabase
        .from("secretaria")
        .select("id, estado, aprobado, correo")
        .eq("id", userId)
        .maybeSingle();

      if (secData) {
        if (secData.aprobado === "pendiente") {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          mostrarAlertaPersonalizada(
            "⏳ Aprobación Pendiente",
            "Tu cuenta de secretaría está pendiente por confirmación del administrador.",
          );
          return;
        }
        if (secData.aprobado === "denegado") {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          mostrarAlertaPersonalizada(
            "❌ Acceso Denegado",
            "Tu cuenta de secretaría no ha sido autorizada.",
          );
          return;
        }

        router.replace("/(tabs)");
        return;
      }

      // -----------------------------------------------------------------
      // 4. VERIFICAR EN LA TABLA "empleados" (Debe estar aprobado Y activo)
      // -----------------------------------------------------------------
      const { data: empData } = await supabase
        .from("empleados")
        .select("id, estado, aprobado, correo")
        .eq("id", userId)
        .maybeSingle();

      if (empData) {
        if (empData.estado === false) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          mostrarAlertaPersonalizada(
            "🚫 Cuenta Inactiva",
            "Tu cuenta de empleado se encuentra desactivada.",
          );
          return;
        }
        if (empData.aprobado === "pendiente") {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          mostrarAlertaPersonalizada(
            "⏳ Aprobación Pendiente",
            "Tu solicitud de acceso como empleado está en revisión.",
          );
          return;
        }
        if (empData.aprobado === "denegado") {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          mostrarAlertaPersonalizada(
            "❌ Acceso Denegado",
            "Tu solicitud de empleado ha sido rechazada.",
          );
          return;
        }

        router.replace("/(tabs)");
        return;
      }

      // -----------------------------------------------------------------
      // 5. SI NO ESTÁ EN NINGUNA TABLA
      // -----------------------------------------------------------------
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      mostrarAlertaPersonalizada(
        "⚠️ Usuario No Registrado",
        "Tus credenciales existen, pero tu cuenta no está asignada a ningún perfil del sistema.",
      );
    } catch (err: any) {
      let mensajeError = "Ocurrió un error inesperado al intentar ingresar.";

      if (err?.message) {
        if (err.message.includes("Invalid login credentials")) {
          mensajeError =
            "El correo electrónico o la contraseña son incorrectos.";
        } else if (err.message.includes("Email not confirmed")) {
          mensajeError =
            "Debes confirmar tu correo electrónico antes de iniciar sesión.";
        } else {
          mensajeError = err.message;
        }
      }

      mostrarAlertaPersonalizada("❌ Error de Acceso", mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🚀 Sistema de Préstamos</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>¿No tienes cuenta? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* --- PANTALLA EMERGENTE (MODAL) ELEGANTE --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                if (modalAction) modalAction();
                else setModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    color: "#64748b",
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    fontSize: 16,
    color: "#1e293b",
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 25,
  },
  registerText: {
    color: "#64748b",
    fontSize: 15,
  },
  registerLink: {
    color: "#6366f1",
    fontSize: 15,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
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
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: "#6366f1",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    elevation: 4,
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
