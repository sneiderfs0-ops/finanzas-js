import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  ScrollView,
} from "react-native";
import { supabase } from "../../supabase";
import { colors, globalStyles } from "@/constants/globalStyles";

export default function ClientesScreen() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    verificarRolYObtenerClientes();
  }, []);

  const verificarRolYObtenerClientes = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !session.user?.email) return;

      const emailLogueado = session.user.email.trim().toLowerCase();

      // 1. Verificar si es Administrador
      const { data: adminData } = await supabase
        .from("administradores")
        .select("cedula")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (adminData) {
        // El administrador ve todos los clientes
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .order("cedula", { ascending: false });
        if (data) setClientes(data);
        return;
      }

      // 2. Verificar si es Secretaria
      const { data: secData } = await supabase
        .from("secretaria")
        .select("cedula")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (secData) {
        // La secretaría ve todos los clientes (igual que el administrador)
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .order("cedula", { ascending: false });
        if (data) setClientes(data);
        return;
      }

      // 3. Verificar si es Empleado
      const { data: empData } = await supabase
        .from("empleados")
        .select("cedula")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (empData) {
        // El empleado solo ve los clientes registrados por su propia cédula
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("registrado_por_cedula", empData.cedula)
          .order("cedula", { ascending: false });
        if (data) setClientes(data);
        return;
      }
    } catch (error) {
      console.error("Error al verificar el rol y filtrar clientes:", error);
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

      {/* Buscador */}
      <TextInput
        style={styles.search}
        placeholder="🔍 Buscar por nombre, apellido o cédula..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor={colors.textSecondary}
      />

      {/* Listado con scroll y diseño moderno y elegante */}
      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.cedula}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.cardHeader}>
              <View style={styles.nameContainer}>
                <Text style={styles.itemName}>
                  {item.nombres} {item.apellidos}
                </Text>
                <Text style={styles.itemCedula}>C.I. {item.cedula}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsContainer}>
              <Text style={styles.itemDetail}>
                📞 <Text style={styles.detailLabel}>Teléfono:</Text>{" "}
                {item.telefono || "No registrado"}
              </Text>
              <Text style={styles.itemDetail}>
                ✉️ <Text style={styles.detailLabel}>Correo:</Text>{" "}
                {item.correo || "No registrado"}
              </Text>
              <Text style={styles.itemDetail}>
                📍 <Text style={styles.detailLabel}>Dirección:</Text>{" "}
                {item.direccion || "No registrada"}
              </Text>
            </View>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    color: colors.textPrimary,
  },
  search: {
    backgroundColor: colors.cardBackground,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.textPrimary,
  },
  itemCard: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nameContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  itemCedula: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  detailsContainer: {
    gap: 6,
  },
  itemDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailLabel: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
