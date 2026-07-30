import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { supabase } from "../../supabase";
import { router, Link } from "expo-router";

export default function SignUpScreen() {
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Formateadores de entrada
  const handleCedulaChange = (text: string) => {
    setCedula(text.replace(/[^0-9]/g, ""));
  };

  const handleNombreChange = (text: string) => {
    setNombre(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""));
  };

  const handleApellidoChange = (text: string) => {
    setApellido(text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""));
  };

  const handleTelefonoChange = (text: string) => {
    setTelefono(text.replace(/[^0-9+]/g, ""));
  };

  // Función para vaciar todos los campos del formulario
  const limpiarFormulario = () => {
    setCedula("");
    setNombre("");
    setApellido("");
    setTelefono("");
    setEmail("");
    setPassword("");
  };

  const handleSignUp = async () => {
    // 1. Validaciones básicas de campos vacíos
    if (!cedula || !nombre || !apellido || !telefono || !email || !password) {
      Alert.alert("Atención", "Por favor completa todos los campos.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Atención",
        "La contraseña debe tener al menos 6 caracteres.",
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(
        "Correo Inválido",
        "Por favor ingresa un correo electrónico válido.",
      );
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData.session;

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (authError) throw authError;
      if (!authData.user) {
        throw new Error("No se pudo crear el usuario de autenticación.");
      }

      const userId = authData.user.id;

      // 3. Insertar en la tabla 'empleados' vinculando el ID de Auth
      const { error: dbError } = await supabase.from("empleados").insert([
        {
          id: userId,
          cedula: cedula.trim(),
          nombres: nombre.trim(),
          apellidos: apellido.trim(),
          telefono: telefono.trim(),
          correo: email.trim().toLowerCase(),
          estado: adminSession ? true : false,
        },
      ]);

      if (dbError) {
        if (dbError.code === "23505") {
          throw new Error(
            "La cédula o el correo ya se encuentran registrados en el sistema.",
          );
        }
        throw new Error(dbError.message);
      }

      // Limpiamos los campos del formulario de inmediato
      limpiarFormulario();

      // Si había un admin logueado (creado desde el panel)
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        Alert.alert(
          "¡Registro Exitoso!",
          "El empleado ha sido registrado y guardado correctamente.",
          [
            {
              text: "OK",
              onPress: () => router.back(), // Vuelve al panel de administración
            },
          ],
        );
      } else {
        // Flujo público normal
        Alert.alert(
          "¡Registro Exitoso!",
          "Tu cuenta ha sido creada correctamente. Espera la aprobación del administrador para ingresar.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ],
        );
      }
    } catch (err: any) {
      let mensajeError = err.message;
      if (mensajeError.includes("already registered")) {
        mensajeError = "Este correo electrónico ya se encuentra registrado.";
      }
      Alert.alert("Error de Registro", mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Registro de Empleados</Text>
      <Text style={styles.subtitle}>Crear nueva cuenta en el sistema</Text>

      <TextInput
        style={styles.input}
        placeholder="Cédula de Identidad (Única)"
        value={cedula}
        onChangeText={handleCedulaChange}
        keyboardType="numeric"
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={nombre}
        onChangeText={handleNombreChange}
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Apellido"
        value={apellido}
        onChangeText={handleApellidoChange}
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Número de Teléfono"
        value={telefono}
        onChangeText={handleTelefonoChange}
        keyboardType="phone-pad"
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Correo Electrónico (Único)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña (Mínimo 6 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#aaa"
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

      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>¿Ya tienes cuenta? </Text>
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity>
            <Text style={styles.registerLink}>Iniciar sesión</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f5f6fa",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2f3640",
  },
  subtitle: {
    fontSize: 14,
    color: "#718093",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0984e3",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
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
