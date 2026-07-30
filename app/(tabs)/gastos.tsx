import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Platform,
} from "react-native";
import { supabase } from "../../supabase";

interface CajaOption {
  id: string;
  nombre: string;
}

interface GastoItem {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  registrado_por_cedula: string;
  nombreResponsable?: string;
}

export default function GastosScreen() {
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const [cajaSeleccionada, setCajaSeleccionada] = useState("");
  const [categoria, setCategoria] = useState("nomina_empleado");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para la tabla y buscador
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [busquedaFecha, setBusquedaFecha] = useState("");

  useEffect(() => {
    cargarCajas();
    cargarGastos();
  }, []);

  const cargarCajas = async () => {
    const { data } = await supabase.from("cajas_bancos").select("id, nombre");
    if (data && data.length > 0) {
      setCajas(data);
      setCajaSeleccionada(data[0].id);
    }
  };

  const cargarGastos = async () => {
    const { data, error } = await supabase
      .from("gastos")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Cruzar con tablas administradores y empleados para obtener el nombre real
      const gastosConNombres = await Promise.all(
        data.map(async (g) => {
          let nombreCompleto = "Sistema / Desconocido";
          if (g.registrado_por_cedula) {
            // Buscar en administradores
            const { data: admin } = await supabase
              .from("administradores")
              .select("nombres, apellidos")
              .eq("cedula", g.registrado_por_cedula)
              .single();
            if (admin) {
              nombreCompleto = `${admin.nombres} ${admin.apellidos} (Admin)`;
            } else {
              // Buscar en empleados
              const { data: emp } = await supabase
                .from("empleados")
                .select("nombres, apellidos")
                .eq("cedula", g.registrado_por_cedula)
                .single();
              if (emp) {
                nombreCompleto = `${emp.nombres} ${emp.apellidos} (Empleado)`;
              }
            }
          }
          return {
            ...g,
            fecha: g.created_at
              ? g.created_at.split("T")[0]
              : new Date().toISOString().split("T")[0],
            nombreResponsable: nombreCompleto,
          };
        }),
      );
      setGastos(gastosConNombres);
    }
  };

  const registrarGasto = async () => {
    if (!monto || !descripcion || !cajaSeleccionada) {
      Alert.alert("Atención", "Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      let cedulaAdminEmp = "ADMIN";
      if (userId) {
        const { data: admin } = await supabase
          .from("administradores")
          .select("cedula")
          .eq("id", userId)
          .single();
        if (admin) {
          cedulaAdminEmp = admin.cedula;
        } else {
          const { data: emp } = await supabase
            .from("empleados")
            .select("cedula")
            .eq("id", userId)
            .single();
          if (emp) cedulaAdminEmp = emp.cedula;
        }
      }

      const { error } = await supabase.from("gastos").insert([
        {
          caja_id: cajaSeleccionada,
          categoria: categoria,
          monto: Number(monto),
          descripcion: descripcion.trim(),
          registrado_por_cedula: cedulaAdminEmp,
        },
      ]);

      if (error) throw error;

      // Actualizar saldo de la caja
      const { data: cajaActual } = await supabase
        .from("cajas_bancos")
        .select("saldo_actual")
        .eq("id", cajaSeleccionada)
        .single();
      if (cajaActual) {
        const nuevoSaldo = Number(cajaActual.saldo_actual) - Number(monto);
        await supabase
          .from("cajas_bancos")
          .update({ saldo_actual: nuevoSaldo })
          .eq("id", cajaSeleccionada);
      }

      Alert.alert("Éxito", "Egreso registrado correctamente.");
      setMonto("");
      setDescripcion("");
      cargarGastos();
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo registrar el gasto.");
    } finally {
      setLoading(false);
    }
  };

  // Funciones de Descarga Excel y PDF
  const descargarExcel = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Fecha,Descripcion,Responsable,Monto"]
        .concat(
          gastosFiltrados.map(
            (g) =>
              `${g.fecha},"${g.descripcion}","${g.nombreResponsable}",${g.monto}`,
          ),
        )
        .join("\n");

    if (Platform.OS === "web") {
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "reporte_gastos.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert(
        "Exportar Excel",
        "La descarga de archivos CSV/Excel está optimizada para entorno Web.",
      );
    }
  };

  const descargarPDF = () => {
    if (Platform.OS === "web") {
      window.print();
    } else {
      Alert.alert(
        "Exportar PDF",
        "Para exportar en PDF en dispositivos móviles, utiliza la opción de imprimir pantalla.",
      );
    }
  };

  const gastosFiltrados = gastos.filter((g) =>
    g.fecha.includes(busquedaFecha.trim()),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Registro de Gastos y Pagos</Text>
      <Text style={styles.subtitle}>Nómina, servicios y otros egresos</Text>

      {/* Formulario */}
      <View style={styles.formCard}>
        <Text style={styles.label}>Categoría de Gasto:</Text>
        <View style={styles.row}>
          {["nomina_empleado", "servicios", "alquiler", "otro"].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catButton,
                categoria === cat && styles.catButtonSelected,
              ]}
              onPress={() => setCategoria(cat)}
            >
              <Text
                style={[
                  styles.catButtonText,
                  categoria === cat && styles.catButtonTextSelected,
                ]}
              >
                {cat === "nomina_empleado" ? "Nómina" : cat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Método / Caja de Salida:</Text>
        <View style={styles.row}>
          {cajas.map((caja) => (
            <TouchableOpacity
              key={caja.id}
              style={[
                styles.catButton,
                cajaSeleccionada === caja.id && styles.catButtonSelected,
              ]}
              onPress={() => setCajaSeleccionada(caja.id)}
            >
              <Text
                style={[
                  styles.catButtonText,
                  cajaSeleccionada === caja.id && styles.catButtonTextSelected,
                ]}
              >
                {caja.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Monto a pagar ($)"
          value={monto}
          onChangeText={setMonto}
          keyboardType="numeric"
          placeholderTextColor="#aaa"
        />

        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: "top" }]}
          placeholder="Descripción (Ej: Pago de sueldo a Juan Pérez)"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={registrarGasto}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrar Egreso</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sección Tabla CRUD e Historial */}
      <Text style={styles.sectionTitle}>Historial y Reportes de Gastos</Text>

      <View style={styles.filterExportRow}>
        <TextInput
          style={styles.searchFecha}
          placeholder="📅 Buscar por fecha (YYYY-MM-DD)..."
          value={busquedaFecha}
          onChangeText={setBusquedaFecha}
          placeholderTextColor="#aaa"
        />
        <View style={styles.exportButtonsContainer}>
          <TouchableOpacity
            style={styles.exportExcelBtn}
            onPress={descargarExcel}
          >
            <Text style={styles.exportText}>📥 Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportPdfBtn} onPress={descargarPDF}>
            <Text style={styles.exportText}>📄 PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cabecera de Tabla */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 1.2 }]}>Fecha</Text>
        <Text style={[styles.th, { flex: 2 }]}>Descripción</Text>
        <Text style={[styles.th, { flex: 2 }]}>Responsable</Text>
        <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Monto</Text>
      </View>

      {gastosFiltrados.map((item) => (
        <View key={item.id} style={styles.tableRow}>
          <Text style={[styles.td, { flex: 1.2 }]}>{item.fecha}</Text>
          <Text style={[styles.td, { flex: 2 }]} numberOfLines={2}>
            {item.descripcion}
          </Text>
          <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
            {item.nombreResponsable}
          </Text>
          <Text
            style={[
              styles.td,
              {
                flex: 1,
                textAlign: "right",
                fontWeight: "bold",
                color: "#e74c3c",
              },
            ]}
          >
            ${Number(item.monto).toLocaleString()}
          </Text>
        </View>
      ))}

      {gastosFiltrados.length === 0 && (
        <Text style={styles.emptyText}>
          No se encontraron registros de gastos.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, backgroundColor: "#f5f6fa" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#2f3640" },
  subtitle: { fontSize: 14, color: "#718093", marginBottom: 16 },
  formCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    boxShadow: "0px 2px 6px rgba(0,0,0,0.08)",
    elevation: 2,
    marginBottom: 24,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#2f3640", marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  catButton: {
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dcdde1",
    marginRight: 8,
    marginBottom: 8,
  },
  catButtonSelected: { backgroundColor: "#0984e3", borderColor: "#0984e3" },
  catButtonText: { fontSize: 13, color: "#718093" },
  catButtonTextSelected: { color: "#fff", fontWeight: "bold" },
  input: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#d63031",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2f3640",
    marginBottom: 12,
  },
  filterExportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  searchFecha: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dcdde1",
    fontSize: 14,
  },
  exportButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  exportExcelBtn: {
    backgroundColor: "#27ae60",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  exportPdfBtn: {
    backgroundColor: "#c0392b",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  exportText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e1f5fe",
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  th: { fontWeight: "bold", color: "#0277bd", fontSize: 13 },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f2f6",
    alignItems: "center",
  },
  td: { fontSize: 13, color: "#2f3640" },
  emptyText: {
    textAlign: "center",
    color: "#718093",
    marginTop: 20,
    fontSize: 14,
  },
});
