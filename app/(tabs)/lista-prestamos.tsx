import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { supabase } from "../../supabase";

export default function ListaPrestamosScreen() {
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros por fecha (formato YYYY-MM-DD)
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Modal para ver detalles y pagos acumulados
  const [modalVisible, setModalVisible] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<any>(null);
  const [pagosPrestamo, setPagosPrestamo] = useState<any[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const cargarPrestamos = async () => {
    setLoading(true);
    try {
      // Consulta simplificada para evitar errores de llaves foráneas no existentes
      let query = supabase
        .from("prestamos")
        .select(
          `
          *,
          clientes (
            nombres,
            apellidos
          ),
          pagos (
            monto_pagado
          )
        `,
        )
        .order("fecha_prestamo", { ascending: false });

      if (fechaInicio) {
        query = query.gte("fecha_prestamo", `${fechaInicio}T00:00:00`);
      }
      if (fechaFin) {
        query = query.lte("fecha_prestamo", `${fechaFin}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const prestamosProcesados = data.map((p) => {
          const totalPagado = p.pagos
            ? p.pagos.reduce(
                (sum: number, pago: any) => sum + Number(pago.monto_pagado),
                0,
              )
            : 0;

          const montoTotal = Number(p.monto_total) || 0;
          let estadoAutomatico =
            totalPagado >= montoTotal ? "pagado" : "activo";

          // Tomar el correo o identificador del administrador registrado
          let nombreCreador =
            p.registrado_por_correo || p.admin_id || "Administrador";

          return {
            ...p,
            totalPagado,
            estadoAutomatico,
            nombreAdmin: nombreCreador,
          };
        });

        setPrestamos(prestamosProcesados);
      }
    } catch (err: any) {
      console.log("Error cargando préstamos:", err.message);
      Alert.alert("Error", "No se pudieron cargar los préstamos.");
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalles = async (item: any) => {
    setPrestamoSeleccionado(item);
    setModalVisible(true);
    setCargandoPagos(true);

    try {
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("prestamo_id", item.id)
        .order("fecha_pago", { ascending: false });

      if (error) throw error;
      setPagosPrestamo(data || []);
    } catch (err: any) {
      console.log("Error al cargar pagos del préstamo:", err.message);
    } finally {
      setCargandoPagos(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const nombreCliente = item.clientes
      ? `${item.clientes.nombres} ${item.clientes.apellidos}`
      : "Cliente desconocido";

    const fechaFormateada = item.fecha_prestamo
      ? new Date(item.fecha_prestamo).toLocaleDateString()
      : "Fecha no disponible";

    const esPagado = item.estadoAutomatico === "pagado";
    const badgeColor = esPagado ? "#2ed573" : "#e1b12c";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.clienteNombre}>{nombreCliente}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>
              {item.estadoAutomatico.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.cardText}>Cédula: {item.cliente_cedula}</Text>
        <Text style={styles.cardText}>
          Monto Total: <Text style={styles.bold}>${item.monto_total}</Text>
        </Text>
        <Text style={styles.cardText}>
          Total Abonado:{" "}
          <Text style={[styles.bold, { color: "#2ed573" }]}>
            ${item.totalPagado.toFixed(2)}
          </Text>
        </Text>
        <Text style={styles.cardText}>
          Registrado por: <Text style={styles.bold}>{item.nombreAdmin}</Text>
        </Text>
        <Text style={styles.cardSubText}>Fecha: {fechaFormateada}</Text>

        <TouchableOpacity
          style={styles.btnVerDetalle}
          onPress={() => abrirDetalles(item)}
        >
          <Text style={styles.btnVerDetalleText}>Ver Detalles y Pagos</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión de Préstamos</Text>

      <View style={styles.filtroContainer}>
        <Text style={styles.filtroLabel}>Filtrar por Fecha (AAAA-MM-DD):</Text>
        <View style={styles.inputsFechaRow}>
          <TextInput
            style={styles.inputFecha}
            placeholder="Desde (Ej: 2026-01-01)"
            value={fechaInicio}
            onChangeText={setFechaInicio}
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={styles.inputFecha}
            placeholder="Hasta (Ej: 2026-12-31)"
            value={fechaFin}
            onChangeText={setFechaFin}
            placeholderTextColor="#aaa"
          />
        </View>
        <View style={styles.botonesFiltroRow}>
          <TouchableOpacity style={styles.btnFiltrar} onPress={cargarPrestamos}>
            <Text style={styles.btnFiltrarText}>Aplicar Filtro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnLimpiar}
            onPress={() => {
              setFechaInicio("");
              setFechaFin("");
              cargarPrestamos();
            }}
          >
            <Text style={styles.btnLimpiarText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#0984e3"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={prestamos}
          keyExtractor={(item) =>
            item.id?.toString() || Math.random().toString()
          }
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No se encontraron préstamos.</Text>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Detalles del Préstamo</Text>

              {prestamoSeleccionado && (
                <>
                  <Text style={styles.modalLabel}>
                    Cliente:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.clientes
                        ? `${prestamoSeleccionado.clientes.nombres} ${prestamoSeleccionado.clientes.apellidos}`
                        : prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Cédula Cliente:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.cliente_cedula}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Registrado por:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.nombreAdmin}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Monto Original:{" "}
                    <Text style={styles.modalValue}>
                      ${prestamoSeleccionado.monto_prestado || "N/A"}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Tasa de Interés:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.tasa_interes}%
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Monto Total a Pagar:{" "}
                    <Text style={styles.modalValue}>
                      ${prestamoSeleccionado.monto_total}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Total Abonado / Pagado:{" "}
                    <Text style={[styles.modalValue, { color: "#2ed573" }]}>
                      ${prestamoSeleccionado.totalPagado.toFixed(2)}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Frecuencia / Cuotas:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.frecuencia || "N/A"} (
                      {prestamoSeleccionado.cuotas || 0} cuotas de $
                      {prestamoSeleccionado.valor_cuota || 0})
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Estado Automático:{" "}
                    <Text
                      style={[
                        styles.modalValue,
                        {
                          color:
                            prestamoSeleccionado.estadoAutomatico === "pagado"
                              ? "#2ed573"
                              : "#e1b12c",
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {prestamoSeleccionado.estadoAutomatico.toUpperCase()}
                    </Text>
                  </Text>
                  <Text style={styles.modalLabel}>
                    Fecha de Registro:{" "}
                    <Text style={styles.modalValue}>
                      {prestamoSeleccionado.fecha_prestamo
                        ? new Date(
                            prestamoSeleccionado.fecha_prestamo,
                          ).toLocaleString()
                        : "N/A"}
                    </Text>
                  </Text>

                  <Text style={styles.subtituloPagos}>
                    Historial de Abonos (Tabla Pagos):
                  </Text>
                  {cargandoPagos ? (
                    <ActivityIndicator size="small" color="#0984e3" />
                  ) : pagosPrestamo.length === 0 ? (
                    <Text style={styles.sinPagosText}>
                      No hay pagos registrados para este préstamo aún.
                    </Text>
                  ) : (
                    pagosPrestamo.map((pago, index) => (
                      <View key={pago.id || index} style={styles.pagoItem}>
                        <Text style={styles.pagoTexto}>
                          Monto Pagado:{" "}
                          <Text style={styles.bold}>${pago.monto_pagado}</Text>
                        </Text>
                        <Text style={styles.pagoSubTexto}>
                          Fecha:{" "}
                          {pago.fecha_pago
                            ? new Date(pago.fecha_pago).toLocaleString()
                            : "N/A"}
                        </Text>
                        <Text style={styles.pagoSubTexto}>
                          Registrado por:{" "}
                          {pago.registrado_por_correo || "Administrador"}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.btnCerrarModal}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCerrarText}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  filtroContainer: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  filtroLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 6,
  },
  inputsFechaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  inputFecha: {
    width: "48%",
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 13,
  },
  botonesFiltroRow: { flexDirection: "row", justifyContent: "space-between" },
  btnFiltrar: {
    backgroundColor: "#0984e3",
    padding: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 4,
    alignItems: "center",
  },
  btnFiltrarText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  btnLimpiar: {
    backgroundColor: "#b2bec3",
    padding: 8,
    borderRadius: 6,
    width: 80,
    alignItems: "center",
  },
  btnLimpiarText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  clienteNombre: { fontSize: 16, fontWeight: "bold", color: "#2f3640" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardText: { fontSize: 14, color: "#555", marginBottom: 2 },
  cardSubText: { fontSize: 12, color: "#888", marginBottom: 8 },
  bold: { fontWeight: "bold", color: "#2980b9" },
  btnVerDetalle: {
    backgroundColor: "#f1f2f6",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  btnVerDetalleText: { color: "#0984e3", fontWeight: "600", fontSize: 13 },
  emptyText: {
    textAlign: "center",
    color: "#888",
    marginTop: 20,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
    color: "#2f3640",
    textAlign: "center",
  },
  modalLabel: { fontSize: 14, color: "#555", marginBottom: 6 },
  modalValue: { fontWeight: "bold", color: "#2f3640" },
  subtituloPagos: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2f3640",
    marginTop: 14,
    marginBottom: 8,
  },
  sinPagosText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    marginBottom: 10,
  },
  pagoItem: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  pagoTexto: { fontSize: 13, color: "#2f3640" },
  pagoSubTexto: { fontSize: 12, color: "#6c757d" },
  btnCerrarModal: {
    backgroundColor: "#718093",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  btnCerrarText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
