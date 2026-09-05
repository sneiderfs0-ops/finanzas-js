import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../supabase";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useRouter } from "expo-router";

export default function CrearClienteModal({
  onClose,
  onClienteCreado,
}: {
  onClose?: () => void;
  onClienteCreado?: () => void;
}) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Estados para manejo de rutas y roles
  const [rutasDisponibles, setRutasDisponibles] = useState<any[]>([]);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string>("");
  const [esAdminOSecretaria, setEsAdminOSecretaria] = useState(false);

  useEffect(() => {
    verificarRolYObtenerRutas();
  }, []);

  const verificarRolYObtenerRutas = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const userId = authData.user.id;
      const emailLogueado = authData.user.email?.trim().toLowerCase();

      // 1. Verificar si es administrador o secretaria
      const { data: adminData } = await supabase
        .from("administradores")
        .select("cedula")
        .or(`id.eq.${userId},correo.eq.${emailLogueado}`)
        .maybeSingle();

      const { data: secData } = await supabase
        .from("secretaria")
        .select("cedula")
        .or(`id.eq.${userId},correo.eq.${emailLogueado}`)
        .maybeSingle();

      if (adminData || secData) {
        setEsAdminOSecretaria(true);
        const { data: rutasData, error: rutasError } = await supabase
          .from("rutas")
          .select("*");

        if (!rutasError && rutasData && rutasData.length > 0) {
          setRutasDisponibles(rutasData);
          setRutaSeleccionada(rutasData[0].id);
        }
      } else {
        setEsAdminOSecretaria(false);
        const { data: empData } = await supabase
          .from("empleados")
          .select("id")
          .or(`id.eq.${userId},correo.eq.${emailLogueado}`)
          .maybeSingle();

        if (empData) {
          const { data: rutasEmpData, error: rutasEmpError } = await supabase
            .from("empleado_rutas")
            .select("rutas (id, nombre_ruta)")
            .eq("empleado_id", empData.id);

          if (!rutasEmpError && rutasEmpData && rutasEmpData.length > 0) {
            const listadoRutas = rutasEmpData
              .map((item: any) => item.rutas)
              .filter(Boolean);
            setRutasDisponibles(listadoRutas);
            if (listadoRutas.length > 0) {
              setRutaSeleccionada(listadoRutas[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error al verificar rol o cargar rutas:", error);
    }
  };

  const handleSoloLetras = (
    text: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const soloLetras = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
    setter(soloLetras);
  };

  const handleSoloNumeros = (
    text: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const soloNumeros = text.replace(/[^0-9]/g, "");
    setter(soloNumeros);
  };

  const handleCrearCliente = async () => {
    if (!nombres.trim() || !apellidos.trim() || !telefono.trim()) {
      Alert.alert("Error", "Por favor completa los campos obligatorios.");
      return;
    }

    if (!rutaSeleccionada) {
      Alert.alert(
        "Error",
        "No se encontró una ruta asociada para registrar el cliente.",
      );
      return;
    }

    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error("No se encontró una sesión activa.");
      }

      const userId = authData.user.id;
      const emailLogueado = authData.user.email?.trim().toLowerCase();
      let cedulaUsuarioLogueado = null;

      const tablas = ["administradores", "empleados", "secretaria"];
      for (const tabla of tablas) {
        const { data } = await supabase
          .from(tabla)
          .select("cedula")
          .or(`id.eq.${userId},correo.eq.${emailLogueado}`)
          .maybeSingle();

        if (data?.cedula) {
          cedulaUsuarioLogueado = data.cedula;
          break;
        }
      }

      const objetoInsertar: any = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        registrado_por_cedula: cedulaUsuarioLogueado,
        ruta_id: rutaSeleccionada,
      };

      const { error } = await supabase
        .from("clientes")
        .insert([objetoInsertar]);

      if (error) throw error;

      setNombres("");
      setApellidos("");
      setTelefono("");
      setDireccion("");
      if (rutasDisponibles.length > 0 && esAdminOSecretaria) {
        setRutaSeleccionada(rutasDisponibles[0].id);
      }

      if (onClienteCreado) onClienteCreado();
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
    if (onClose) onClose();
    else router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.baseContainer}
        contentContainerStyle={styles.container}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          📝 Registrar Nuevo Cliente
        </Text>

        {esAdminOSecretaria && (
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Asignar a Ruta:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={rutaSeleccionada}
                onValueChange={(itemValue) => setRutaSeleccionada(itemValue)}
                style={styles.picker}
                dropdownIconColor="#000000"
              >
                {rutasDisponibles.length > 0 ? (
                  rutasDisponibles.map((ruta) => (
                    <Picker.Item
                      key={ruta.id}
                      label={ruta.nombre_ruta}
                      value={ruta.id}
                      color="#000000"
                    />
                  ))
                ) : (
                  <Picker.Item
                    label="No hay rutas disponibles"
                    value=""
                    color="#000000"
                  />
                )}
              </Picker>
            </View>
          </View>
        )}

        {!esAdminOSecretaria && rutasDisponibles.length > 0 && (
          <View style={styles.infoRutaContainer}>
            <Text style={styles.infoRutaText}>
              📍 Ruta asignada:{" "}
              <Text style={styles.boldText}>
                {rutasDisponibles[0].nombre_ruta}
              </Text>
            </Text>
          </View>
        )}

        <Text style={styles.label}>Nombres</Text>
        <TextInput
          style={styles.input}
          value={nombres}
          onChangeText={(text) => handleSoloLetras(text, setNombres)}
        />

        <Text style={styles.label}>Apellidos</Text>
        <TextInput
          style={styles.input}
          value={apellidos}
          onChangeText={(text) => handleSoloLetras(text, setApellidos)}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={(text) => handleSoloNumeros(text, setTelefono)}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Dirección</Text>
        <TextInput
          style={styles.input}
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
          onPress={() => (onClose ? onClose() : router.replace("/"))}
        >
          <Text style={styles.btnCloseText}>Cancelar</Text>
        </TouchableOpacity>

        <Modal
          animationType="fade"
          transparent={true}
          visible={successModalVisible}
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
                style={[
                  styles.successTitle,
                  { color: Colors[colorScheme].text },
                ]}
              >
                ¡Cliente Registrado!
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    flex: 1,
  },
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 60, // Espacio extra de scroll para evitar que el teclado cubra los botones
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
    color: "#000000",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#000000",
  },
  infoRutaContainer: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoRutaText: {
    fontSize: 14,
    color: "#061429",
  },
  boldText: {
    fontWeight: "bold",
    color: "#0f172a",
  },
  btnGuardar: {
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successModalContent: {
    width: "90%",
    maxWidth: 350,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)" },
      default: { elevation: 5 },
    }),
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  btnSuccessOk: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
});
