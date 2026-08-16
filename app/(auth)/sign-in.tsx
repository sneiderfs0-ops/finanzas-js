import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { supabase } from "../../supabase";
import { router, Link } from "expo-router";
import { globalStyles, colors } from "../../constants/globalStyles";

const { width } = Dimensions.get("window");
const isMobile = width < 768;

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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={globalStyles.scrollContainer}>
        <View style={globalStyles.card}>
          <View style={localStyles.logoContainer}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={localStyles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={globalStyles.subtitle}>
            Inicia sesión para continuar
          </Text>

          <TextInput
            style={globalStyles.input}
            placeholder="Correo Electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#94a3b8"
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={globalStyles.primaryButtonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <View style={localStyles.registerContainer}>
            <Text style={localStyles.registerText}>¿No tienes cuenta? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={localStyles.registerLink}>Regístrate aquí</Text>
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
          <View style={globalStyles.modalOverlay}>
            <View style={globalStyles.modalContent}>
              <Text style={globalStyles.modalTitle}>{modalTitle}</Text>
              <Text style={globalStyles.modalMessage}>{modalMessage}</Text>

              <TouchableOpacity
                style={globalStyles.primaryButton}
                onPress={() => {
                  if (modalAction) modalAction();
                  else setModalVisible(false);
                }}
              >
                <Text style={globalStyles.primaryButtonText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    marginBottom: 5,
    width: "100%",
  },
  logo: {
    width: "100%",
    maxWidth: 100,
    height: isMobile ? 40 : 60,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  registerLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "bold",
  },
});
