import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../supabase";
import { colors } from "@/constants/globalStyles";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!nuevaPassword || !confirmarPassword) {
      Alert.alert("Error", "Por favor completa todos los campos.");
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return;
    }

    if (nuevaPassword.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: nuevaPassword,
      });

      if (error) throw error;

      Alert.alert("Éxito", "Tu contraseña ha sido actualizada correctamente.", [
        {
          text: "Iniciar Sesión",
          onPress: () => router.replace("/(auth)/sign-in"),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo actualizar la contraseña.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.card}>
        <Text style={localStyles.title}>🔑 Nueva Contraseña</Text>
        <Text style={localStyles.subtitle}>
          Ingresa tu nueva contraseña para asegurar tu cuenta.
        </Text>

        <TextInput
          style={localStyles.input}
          placeholder="Nueva contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={nuevaPassword}
          onChangeText={setNuevaPassword}
        />

        <TextInput
          style={localStyles.input}
          placeholder="Confirmar nueva contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={confirmarPassword}
          onChangeText={setConfirmarPassword}
        />

        <TouchableOpacity
          style={localStyles.button}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={localStyles.buttonText}>Actualizar contraseña</Text>
          )}
        </TouchableOpacity>
      </View>
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
    backgroundColor: colors.accentGreen || "#28A745",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 14,
  },
});
