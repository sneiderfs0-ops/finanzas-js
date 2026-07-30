import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../supabase";
import { router, Link } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atención", "Por favor ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);

    try {
      // 1. Iniciar sesión en Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        throw error;
      }

      const userId = data.user.id;

      // 2. Verificar si es Administrador
      const { data: adminData } = await supabase
        .from("administradores")
        .select("id")
        .eq("id", userId)
        .single();

      if (adminData) {
        // Si es admin, entra directo al sistema mediante la ruta de grupo limpia
        router.replace("/(tabs)");
        return;
      }

      // 3. Si no es admin, verificar si es Empleado y su estado
      const { data: empleadoData, error: empError } = await supabase
        .from("empleados")
        .select("estado")
        .eq("id", userId)
        .single();

      if (empError || !empleadoData) {
        await supabase.auth.signOut();
        throw new Error(
          "No se encontró un perfil registrado para este usuario.",
        );
      }

      // Validar si el empleado está desactivado (estado = false)
      if (empleadoData.estado === false) {
        await supabase.auth.signOut(); // Cierra la sesión por seguridad
        Alert.alert(
          "Acceso Denegado",
          "Tu cuenta ha sido desactivada por el administrador. Comunícate con soporte.",
        );
        return;
      }

      // 4. Si todo es correcto, redirigir al panel principal limpio
      router.replace("/(tabs)");
    } catch (err: any) {
      let mensajeError = "Credenciales incorrectas o usuario no encontrado.";
      if (err.message && err.message.includes("Invalid login credentials")) {
        mensajeError = "El correo o la contraseña son incorrectos.";
      } else if (err.message) {
        mensajeError = err.message;
      }

      Alert.alert("Error de Acceso", mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sistema de Préstamos</Text>
      <Text style={styles.subtitle}>Iniciar sesión al sistema</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo Electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#aaa"
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#aaa"
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
            <Text style={styles.registerLink}>Registrarse</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f5f6fa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2f3640",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#718093",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2ed573",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerText: {
    color: "#718093",
    fontSize: 15,
  },
  registerLink: {
    color: "#0984e3",
    fontSize: 15,
    fontWeight: "bold",
  },
});
