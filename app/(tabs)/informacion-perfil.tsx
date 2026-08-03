import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { supabase } from "../../supabase";

const colors = {
  background: "#0f172a",
  cardBackground: "#1e293b",
  border: "#334155",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  primary: "#6366f1",
  primaryHover: "#4f46e5",
  accentBlue: "#38bdf8",
  accentGreen: "#4ade80",
  accentRed: "#f43f5e",
  accentYellow: "#fbbf24",
  inputBackground: "#f8fafc",
  inputDarkBg: "#0f172a",
};

export default function PerfilScreen() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Datos fijos (no editables)
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [rolDetectado, setRolDetectado] = useState("");

  // Datos editables
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");

  // Contraseñas
  const [passwordActual, setPasswordActual] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");

  // Estados para Modales personalizados
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [mensajeErrorModal, setMensajeErrorModal] = useState("");

  const [modalExitoVisible, setModalExitoVisible] = useState(false);
  const [mensajeExitoModal, setMensajeExitoModal] = useState("");

  useEffect(() => {
    cargarDatosPerfil();
  }, []);

  const cargarDatosPerfil = async () => {
    try {
      setFetching(true);
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("No hay una sesión activa.");
      }

      const emailUser = authData.user.email;

      let { data: adminData } = await supabase
        .from("administradores")
        .select("*")
        .eq("correo", emailUser)
        .single();

      if (adminData) {
        setCedula(adminData.cedula || "");
        setNombres(adminData.nombres || "");
        setApellidos(adminData.apellidos || "");
        setTelefono(adminData.telefono || "");
        setCorreo(adminData.correo || "");
        setRolDetectado("administradores");
        setFetching(false);
        return;
      }

      let { data: empData } = await supabase
        .from("empleados")
        .select("*")
        .eq("correo", emailUser)
        .single();

      if (empData) {
        setCedula(empData.cedula || "");
        setNombres(empData.nombres || "");
        setApellidos(empData.apellidos || "");
        setTelefono(empData.telefono || "");
        setCorreo(empData.correo || "");
        setRolDetectado("empleados");
        setFetching(false);
        return;
      }

      let { data: secData } = await supabase
        .from("secretaria")
        .select("*")
        .eq("correo", emailUser)
        .single();

      if (secData) {
        setCedula(secData.cedula || "");
        setNombres(secData.nombres || "");
        setApellidos(secData.apellidos || "");
        setTelefono(secData.telefono || "");
        setCorreo(secData.correo || "");
        setRolDetectado("secretaria");
        setFetching(false);
        return;
      }

      throw new Error("No se encontró el registro del usuario en el sistema.");
    } catch (error: any) {
      setMensajeErrorModal(
        error.message || "No se pudieron cargar los datos del perfil.",
      );
      setModalErrorVisible(true);
    } finally {
      setFetching(false);
    }
  };

  const handleActualizarPerfil = async () => {
    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user || !authData.user.email)
        throw new Error("Sesión expirada.");

      const currentEmail = authData.user.email;

      // Si el usuario intenta cambiar la contraseña, validar la contraseña actual primero
      if (nuevaPassword.trim() !== "") {
        if (!passwordActual.trim()) {
          setMensajeErrorModal(
            "Debe ingresar su contraseña actual para realizar el cambio.",
          );
          setModalErrorVisible(true);
          setLoading(false);
          return;
        }

        // Verificar credenciales actuales iniciando sesión con el correo actual y la contraseña actual
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: passwordActual,
        });

        if (signInError) {
          setMensajeErrorModal(
            "Contraseña errónea. La contraseña actual no coincide.",
          );
          setModalErrorVisible(true);
          setLoading(false);
          return;
        }
      }

      // 1. Actualizar Teléfono y Correo en su respectiva tabla de roles
      if (rolDetectado) {
        const updatePayload: any = { telefono, correo };

        const { error: dbError } = await supabase
          .from(rolDetectado)
          .update(updatePayload)
          .eq("cedula", cedula);

        if (dbError) throw dbError;
      }

      // 2. Actualizar correo en Supabase Auth si cambió
      if (correo !== currentEmail) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: correo,
        });
        if (emailError) throw emailError;
      }

      // 3. Actualizar contraseña si se ingresó una nueva y pasó la validación
      if (nuevaPassword.trim() !== "") {
        const { error: passError } = await supabase.auth.updateUser({
          password: nuevaPassword,
        });
        if (passError) throw passError;

        if (rolDetectado === "administradores") {
          await supabase
            .from("administradores")
            .update({ password: nuevaPassword })
            .eq("cedula", cedula);
        }
      }

      setMensajeExitoModal(
        nuevaPassword.trim() !== ""
          ? "¡Éxito! Cambio de contraseña y perfil realizado correctamente."
          : "Información de perfil actualizada correctamente.",
      );
      setModalExitoVisible(true);

      setPasswordActual("");
      setNuevaPassword("");
    } catch (error: any) {
      setMensajeErrorModal(error.message || "No se pudo actualizar el perfil.");
      setModalErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.scrollContainer, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.mainWrapper}>
        <View style={styles.card}>
          <Text style={styles.title}>Mi Perfil</Text>
          <Text style={styles.subtitle}>
            Consulta tus datos institucionales y modifica tu contacto o
            contraseña
          </Text>

          {/* Cédula (No editable) */}
          <Text style={styles.label}>Cédula (No editable)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={cedula}
            editable={false}
          />

          {/* Nombres (No editable) */}
          <Text style={styles.label}>Nombres (No editable)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={nombres}
            editable={false}
          />

          {/* Apellidos (No editable) */}
          <Text style={styles.label}>Apellidos (No editable)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={apellidos}
            editable={false}
          />

          {/* Teléfono (Solo números enteros permitidos) */}
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="Solo números enteros"
            placeholderTextColor={colors.textSecondary}
            value={telefono}
            onChangeText={(text) => setTelefono(text.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
          />

          {/* Correo Electrónico (Editable) */}
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.textSecondary}
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.separator} />

          {/* Contraseña Actual */}
          <Text style={styles.label}>Contraseña Actual</Text>
          <TextInput
            style={styles.input}
            placeholder="Requerida solo para cambiar contraseña"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={passwordActual}
            onChangeText={setPasswordActual}
          />

          {/* Nueva Contraseña */}
          <Text style={styles.label}>Nueva Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Dejar en blanco para no cambiarla"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={nuevaPassword}
            onChangeText={setNuevaPassword}
          />

          {/* Botón Guardar */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleActualizarPerfil}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL DE ERROR (Contraseña errónea u otros fallos) */}
      <Modal
        visible={modalErrorVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalErrorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalIconContainer,
                { backgroundColor: "#fef2f2" },
              ]}
            >
              <Text style={{ fontSize: 22 }}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Atención</Text>
            <Text style={styles.modalMessage}>{mensajeErrorModal}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: colors.accentRed },
              ]}
              onPress={() => setModalErrorVisible(false)}
            >
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ÉXITO */}
      <Modal
        visible={modalExitoVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalExitoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalIconContainer,
                { backgroundColor: "#f0fdf4" },
              ]}
            >
              <Text style={{ fontSize: 22 }}>✅</Text>
            </View>
            <Text style={styles.modalTitle}>¡Éxito!</Text>
            <Text style={styles.modalMessage}>{mensajeExitoModal}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: colors.accentGreen },
              ]}
              onPress={() => setModalExitoVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: "#0f172a" }]}>
                Aceptar
              </Text>
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
    backgroundColor: colors.background,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mainWrapper: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.inputDarkBg,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: "#172033",
    color: colors.textSecondary,
    borderColor: "#263548",
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
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
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  modalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
