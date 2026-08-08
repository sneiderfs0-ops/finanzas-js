import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../supabase";
import { colors, globalStyles } from "@/constants/globalStyles";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para controlar el Modal personalizado
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [esExitoso, setEsExitoso] = useState(false);

  const handlePasswordReset = async () => {
    const emailTrimmed = correo.trim().toLowerCase();

    if (!emailTrimmed) {
      setModalTitle("Atención");
      setModalMessage("Por favor ingresa tu correo electrónico.");
      setEsExitoso(false);
      setModalVisible(true);
      return;
    }

    try {
      setLoading(true);

      // Verificar si el correo existe en alguna de tus 3 tablas
      const existeAdmin = await supabase
        .from("administradores")
        .select("correo")
        .eq("correo", emailTrimmed)
        .maybeSingle();

      const existeEmp = await supabase
        .from("empleados")
        .select("correo")
        .eq("correo", emailTrimmed)
        .maybeSingle();

      const existeSec = await supabase
        .from("secretaria")
        .select("correo")
        .eq("correo", emailTrimmed)
        .maybeSingle();

      if (!existeAdmin.data && !existeEmp.data && !existeSec.data) {
        setModalTitle("Correo no registrado");
        setModalMessage(
          "El correo electrónico ingresado no se encuentra registrado en el sistema.",
        );
        setEsExitoso(false);
        setModalVisible(true);
        setLoading(false);
        return;
      }

      // Llamada oficial a Supabase Auth para enviar el correo de recuperación
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailTrimmed,
        {
          redirectTo:
            "https://finanzas-sneider-esp35hlgc-finanzas-sneider.vercel.app/forgot",
        },
      );

      if (error) throw error;

      setModalTitle("¡Correo Enviado!");
      setModalMessage(
        "Hemos enviado las instrucciones a tu correo electrónico para restablecer tu contraseña.",
      );
      setEsExitoso(true);
      setModalVisible(true);
    } catch (error: any) {
      setModalTitle("Error");
      setModalMessage(
        error.message || "No se pudo enviar el correo de recuperación.",
      );
      setEsExitoso(false);
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarModal = () => {
    setModalVisible(false);
    if (esExitoso) {
      router.replace("/(auth)/sign-in");
    }
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.card}>
        <Text style={localStyles.title}>🔒 Recuperar Contraseña</Text>
        <Text style={localStyles.subtitle}>
          Ingresa tu correo electrónico registrado y te enviaremos las
          instrucciones.
        </Text>

        <TextInput
          style={localStyles.input}
          placeholder="Correo electrónico"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={correo}
          onChangeText={setCorreo}
        />

        <TouchableOpacity
          style={localStyles.button}
          onPress={handlePasswordReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={localStyles.buttonText}>Enviar instrucciones</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.backButton}
          onPress={() => router.replace("/(auth)/sign-in")}
        >
          <Text style={localStyles.backButtonText}>
            Volver al inicio de sesión
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Personalizado */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCerrarModal}
      >
        <View style={globalStyles.modalOverlay}>
          <View style={[globalStyles.modalContent, { maxWidth: 400 }]}>
            <Text style={globalStyles.modalTitle}>{modalTitle}</Text>
            <Text style={localStyles.modalTextMessage}>{modalMessage}</Text>

            <TouchableOpacity
              style={[
                localStyles.modalButton,
                {
                  backgroundColor: esExitoso
                    ? colors.accentGreen || "#28A745"
                    : colors.accentRed || "#DC3545",
                },
              ]}
              onPress={handleCerrarModal}
            >
              <Text style={localStyles.modalButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.cardBackground,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.accentBlue || "#007AFF",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 14,
  },
  backButton: {
    padding: 8,
    alignItems: "center",
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalTextMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 12,
  },
  modalButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  modalButtonText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 14,
  },
});
