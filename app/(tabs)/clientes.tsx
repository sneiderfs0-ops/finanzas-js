import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { supabase } from "../../supabase";

export default function ClientesScreen() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  // Estados para el formulario de nuevo cliente
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");

  useEffect(() => {
    obtenerClientes();
  }, []);

  const obtenerClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("cedula", { ascending: false });
    if (data) setClientes(data);
  };

  const agregarCliente = async () => {
    if (!cedula || !nombres || !apellidos) {
      Alert.alert(
        "Atención",
        "La cédula, nombres y apellidos son obligatorios.",
      );
      return;
    }

    const { error } = await supabase.from("clientes").insert([
      {
        cedula: cedula.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim(),
        correo: correo.trim().toLowerCase(),
        direccion: direccion.trim(),
      },
    ]);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setCedula("");
      setNombres("");
      setApellidos("");
      setTelefono("");
      setCorreo("");
      setDireccion("");
      obtenerClientes();
      Alert.alert("Éxito", "Cliente registrado correctamente.");
    }
  };

  const clientesFiltrados = clientes.filter((c) =>
    `${c.nombres} ${c.apellidos} ${c.cedula}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Gestión de Clientes</Text>

      {/* Formulario de Registro */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionSubtitle}>Registrar Nuevo Cliente</Text>

        <TextInput
          style={styles.input}
          placeholder="Cédula (Solo números)"
          value={cedula}
          onChangeText={(text) => setCedula(text.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.input}
          placeholder="Nombres"
          value={nombres}
          onChangeText={setNombres}
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.input}
          placeholder="Apellidos"
          value={apellidos}
          onChangeText={setApellidos}
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.input}
          placeholder="Teléfono (Solo números)"
          value={telefono}
          onChangeText={(text) => setTelefono(text.replace(/[^0-9]/g, ""))}
          keyboardType="phone-pad"
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.input}
          placeholder="Correo Electrónico"
          value={correo}
          onChangeText={setCorreo}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: "top" }]}
          placeholder="Dirección de Residencia"
          value={direccion}
          onChangeText={setDireccion}
          multiline
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity style={styles.addButton} onPress={agregarCliente}>
          <Text style={styles.addButtonText}>Guardar Cliente</Text>
        </TouchableOpacity>
      </View>

      {/* Listado y Buscador */}
      <Text style={styles.sectionSubtitle}>Listado de Clientes</Text>
      <TextInput
        style={styles.search}
        placeholder="🔍 Buscar por nombre, apellido o cédula..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor="#aaa"
      />

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.cedula}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <Text style={styles.itemName}>
              {item.nombres} {item.apellidos}
            </Text>
            <Text style={styles.itemDetail}>Cédula: {item.cedula}</Text>
            <Text style={styles.itemDetail}>
              Teléfono: {item.telefono || "No registrado"}
            </Text>
            <Text style={styles.itemDetail}>
              Correo: {item.correo || "No registrado"}
            </Text>
            <Text style={styles.itemDetail}>
              Dirección: {item.direccion || "No registrada"}
            </Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f6fa" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#2f3640",
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 8,
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
  },
  input: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    fontSize: 15,
  },
  addButton: {
    backgroundColor: "#0984e3",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  addButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  search: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 15,
  },
  itemCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 2,
  },
  itemDetail: { fontSize: 14, color: "#718093", marginTop: 2 },
});
