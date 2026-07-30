import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { supabase } from "../supabase";

export default function NotificacionesEmpleados() {
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const cargarPendientes = async () => {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .eq("aprobado", "pendiente");

    if (!error && data) {
      setPendientes(data);
    }
  };

  useEffect(() => {
    cargarPendientes();

    const subscription = supabase
      .channel("empleados_pendientes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "empleados" },
        () => {
          cargarPendientes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const gestionarEmpleado = async (
    id: string,
    decision: "aprobado" | "denegado",
  ) => {
    try {
      if (decision === "aprobado") {
        const { error } = await supabase
          .from("empleados")
          .update({ aprobado: "aprobado", estado: true })
          .eq("id", id);

        if (error) throw error;
        Alert.alert("Éxito", "Empleado aprobado correctamente.");
      } else {
        const { error } = await supabase
          .from("empleados")
          .delete()
          .eq("id", id);

        if (error) throw error;
        Alert.alert("Aviso", "Solicitud de empleado denegada y descartada.");
      }

      cargarPendientes();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {pendientes.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendientes.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitudes de Registro</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {pendientes.length === 0 ? (
              <Text style={styles.emptyText}>
                No hay solicitudes pendientes.
              </Text>
            ) : (
              <FlatList
                data={pendientes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.cardItem}>
                    <View style={styles.infoContainer}>
                      <Text style={styles.nombreText}>
                        {item.nombres} {item.apellidos}
                      </Text>
                      <Text style={styles.detailText}>
                        Cédula: {item.cedula}
                      </Text>
                      <Text style={styles.detailText}>
                        Correo: {item.correo}
                      </Text>
                      <Text style={styles.detailText}>
                        Teléfono: {item.telefono}
                      </Text>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.btnAceptar}
                        onPress={() => gestionarEmpleado(item.id, "aprobado")}
                      >
                        <Text style={styles.btnText}>Aceptar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnDenegar}
                        onPress={() => gestionarEmpleado(item.id, "denegado")}
                      >
                        <Text style={styles.btnText}>Denegar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 15,
  },
  bellButton: {
    position: "relative",
    padding: 8,
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ff4757",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f2f6",
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2f3640",
  },
  closeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#718093",
  },
  emptyText: {
    textAlign: "center",
    color: "#718093",
    padding: 20,
    fontSize: 15,
  },
  cardItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  infoContainer: {
    marginBottom: 10,
  },
  nombreText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#57606f",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  btnAceptar: {
    backgroundColor: "#2ed573",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnDenegar: {
    backgroundColor: "#ff4757",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
