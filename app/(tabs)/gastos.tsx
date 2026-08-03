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
  Platform,
} from "react-native";
import { supabase } from "../../supabase";
import { colors } from "@/constants/globalStyles";

interface CajaOption {
  id: string;
  nombre: string;
  moneda: string;
}

interface GastoItem {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: string;
  categoria: string;
  registrado_por_cedula: string;
  nombreResponsable?: string;
}

export default function GastosScreen() {
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const [categoria, setCategoria] = useState("nomina_empleado");
  const [otraCategoria, setOtraCategoria] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [tipoPago, setTipoPago] = useState("efectivo");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);

  // Control de roles y permisos
  const [rolUsuario, setRolUsuario] = useState<string>("");
  const [cedulaUsuario, setCedulaUsuario] = useState<string>("");

  // Estados para la tabla y buscador
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [busquedaFecha, setBusquedaFecha] = useState("");

  useEffect(() => {
    verificarRolYCargarDatos();
  }, []);

  const verificarRolYCargarDatos = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const emailLogueado = authData.user?.email?.trim().toLowerCase();

      if (!emailLogueado) return;

      let rolEncontrado = "";
      let cedulaEncontrada = "";

      // 1. Verificar Admin
      const { data: admin } = await supabase
        .from("administradores")
        .select("cedula, rol")
        .eq("correo", emailLogueado)
        .maybeSingle();

      if (admin) {
        rolEncontrado = admin.rol || "administrador";
        cedulaEncontrada = admin.cedula;
      } else {
        // 2. Verificar Secretaria
        const { data: sec } = await supabase
          .from("secretaria")
          .select("cedula, rol")
          .eq("correo", emailLogueado)
          .maybeSingle();

        if (sec) {
          rolEncontrado = sec.rol || "secretaria";
          cedulaEncontrada = sec.cedula;
        } else {
          // 3. Verificar Empleado
          const { data: emp } = await supabase
            .from("empleados")
            .select("cedula, rol")
            .eq("correo", emailLogueado)
            .maybeSingle();

          if (emp) {
            rolEncontrado = emp.rol || "empleado";
            cedulaEncontrada = emp.cedula;
          }
        }
      }

      setRolUsuario(rolEncontrado);
      setCedulaUsuario(cedulaEncontrada);

      await cargarCajas();
      await cargarGastos(rolEncontrado, cedulaEncontrada);
    } catch (error) {
      console.error("Error al verificar permisos:", error);
    }
  };

  const cargarCajas = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda");
    if (data && data.length > 0) {
      setCajas(data);
    }
  };

  const cargarGastos = async (rol: string, cedula: string) => {
    let query = supabase
      .from("gastos")
      .select("*")
      .order("created_at", { ascending: false });

    if (rol === "empleado" && cedula) {
      query = query.eq("registrado_por_cedula", cedula);
    }

    const { data } = await query;

    if (data) {
      const gastosConNombres = await Promise.all(
        data.map(async (g) => {
          let nombreCompleto = "Sistema / Desconocido";
          if (g.registrado_por_cedula) {
            const { data: admin } = await supabase
              .from("administradores")
              .select("nombres, apellidos")
              .eq("cedula", g.registrado_por_cedula)
              .maybeSingle();
            if (admin) {
              nombreCompleto = `${admin.nombres} ${admin.apellidos} (Admin)`;
            } else {
              const { data: sec } = await supabase
                .from("secretaria")
                .select("nombres, apellidos")
                .eq("cedula", g.registrado_por_cedula)
                .maybeSingle();
              if (sec) {
                nombreCompleto = `${sec.nombres} ${sec.apellidos} (Secretaria)`;
              } else {
                const { data: emp } = await supabase
                  .from("empleados")
                  .select("nombres, apellidos")
                  .eq("cedula", g.registrado_por_cedula)
                  .maybeSingle();
                if (emp) {
                  nombreCompleto = `${emp.nombres} ${emp.apellidos} (Empleado)`;
                }
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

  const obtenerCajaIdAutomatica = () => {
    const terminoBusqueda =
      tipoPago === "efectivo" ? "Efectivo" : "Banco / Transferencia";
    const cajaEncontrada = cajas.find(
      (c) => c.nombre.includes(terminoBusqueda) && c.moneda === moneda,
    );
    return cajaEncontrada ? cajaEncontrada.id : null;
  };

  const registrarGasto = async () => {
    const cajaIdSeleccionada = obtenerCajaIdAutomatica();
    const categoriaFinal =
      categoria === "otro" ? otraCategoria.trim() : categoria;

    if (
      !monto ||
      !descripcion ||
      !cedulaUsuario ||
      !cajaIdSeleccionada ||
      (categoria === "otro" && !otraCategoria.trim())
    ) {
      Alert.alert(
        "Atención",
        "Por favor completa todos los campos requeridos, especifica la nueva categoría y verifica que exista una caja configurada.",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("gastos").insert([
        {
          caja_id: cajaIdSeleccionada,
          categoria: categoriaFinal,
          moneda: moneda,
          monto: Number(monto),
          descripcion: descripcion.trim(),
          registrado_por_cedula: cedulaUsuario,
        },
      ]);

      if (error) throw error;

      const { data: cajaActual } = await supabase
        .from("cajas_bancos")
        .select("saldo_actual")
        .eq("id", cajaIdSeleccionada)
        .single();

      if (cajaActual) {
        const nuevoSaldo = Number(cajaActual.saldo_actual) - Number(monto);
        await supabase
          .from("cajas_bancos")
          .update({ saldo_actual: nuevoSaldo })
          .eq("id", cajaIdSeleccionada);
      }

      Alert.alert("Éxito", "Egreso registrado correctamente.");
      setMonto("");
      setDescripcion("");
      setOtraCategoria("");
      cargarGastos(rolUsuario, cedulaUsuario);
    } catch (err: any) {
      Alert.alert("Error", err.message || "No se pudo registrar el gasto.");
    } finally {
      setLoading(false);
    }
  };

  const descargarExcel = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      ["Fecha;Descripcion;Responsable;Categoria;Moneda;Monto"]
        .concat(
          gastosFiltrados.map(
            (g) =>
              `"${g.fecha}";"${g.descripcion}";"${g.nombreResponsable}";"${g.categoria}";${g.moneda};${g.monto}`,
          ),
        )
        .join("\r\n");

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
        "La descarga de archivos está optimizada para entorno Web.",
      );
    }
  };

  const descargarPDF = () => {
    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const htmlContent = `
          <html>
            <head>
              <title>Reporte de Gastos</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h2 { text-align: center; color: #2f3640; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; }
                th { background-color: #0984e3; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .text-right { text-align: right; }
              </style>
            </head>
            <body>
              <h2>Reporte de Gastos</h2>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th>Categoría</th>
                    <th>Moneda</th>
                    <th class="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${gastosFiltrados
                    .map(
                      (item) => `
                    <tr>
                      <td>${item.fecha}</td>
                      <td>${item.descripcion}</td>
                      <td>${item.nombreResponsable}</td>
                      <td>${item.categoria}</td>
                      <td>${item.moneda}</td>
                      <td class="text-right">${Number(item.monto).toLocaleString()}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </body>
          </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    } else {
      Alert.alert(
        "Exportar PDF",
        "Para exportar en PDF en dispositivos móviles, utiliza la opción de imprimir.",
      );
    }
  };

  const gastosFiltrados = gastos.filter((g) =>
    g.fecha.includes(busquedaFecha.trim()),
  );

  const esAdminSecretaria =
    rolUsuario === "administrador" || rolUsuario === "secretaria";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mainWrapper}>
        <Text style={styles.headerTitle}>Registro de Gastos y Pagos</Text>
        <Text style={styles.subtitle}>
          Nómina, servicios, alquiler y otros egresos
        </Text>

        {/* Formulario */}
        <View style={styles.formCard}>
          <Text style={styles.label}>Categoría de Gasto:</Text>
          <View style={styles.row}>
            {[
              { id: "nomina_empleado", label: "Nómina" },
              { id: "servicios", label: "Servicios" },
              { id: "alquiler", label: "Alquiler" },
              { id: "otro", label: "Otro" },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catButton,
                  categoria === cat.id && styles.catButtonSelected,
                ]}
                onPress={() => setCategoria(cat.id)}
              >
                <Text
                  style={[
                    styles.catButtonText,
                    categoria === cat.id && styles.catButtonTextSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {categoria === "otro" && (
            <TextInput
              style={styles.input}
              placeholder="Especifica la categoría..."
              value={otraCategoria}
              onChangeText={setOtraCategoria}
              placeholderTextColor={colors.textSecondary}
            />
          )}

          <Text style={styles.label}>Moneda:</Text>
          <View style={styles.row}>
            {["USD", "COP"].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.catButton,
                  moneda === m && styles.catButtonSelected,
                ]}
                onPress={() => setMoneda(m)}
              >
                <Text
                  style={[
                    styles.catButtonText,
                    moneda === m && styles.catButtonTextSelected,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Tipo de Pago:</Text>
          <View style={styles.row}>
            {[
              { id: "efectivo", label: "Efectivo" },
              { id: "transferencia", label: "Transferencia (Banco)" },
            ].map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.catButton,
                  tipoPago === t.id && styles.catButtonSelected,
                ]}
                onPress={() => setTipoPago(t.id)}
              >
                <Text
                  style={[
                    styles.catButtonText,
                    tipoPago === t.id && styles.catButtonTextSelected,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Monto a pagar"
            value={monto}
            onChangeText={(text) => setMonto(text.replace(/[^0-9.]/g, ""))}
            keyboardType="numeric"
            placeholderTextColor={colors.textSecondary}
          />

          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: "top" }]}
            placeholder="Descripción (Ej: Compra de papelería)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            placeholderTextColor={colors.textSecondary}
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
        {esAdminSecretaria ? (
          <>
            <Text style={styles.sectionTitle}>
              Historial y Reportes de Gastos
            </Text>

            <View style={styles.filterExportRow}>
              <TextInput
                style={styles.searchFecha}
                placeholder="📅 Buscar por fecha (YYYY-MM-DD)..."
                value={busquedaFecha}
                onChangeText={setBusquedaFecha}
                placeholderTextColor={colors.textSecondary}
              />
              <View style={styles.exportButtonsContainer}>
                <TouchableOpacity
                  style={styles.exportExcelBtn}
                  onPress={descargarExcel}
                >
                  <Text style={styles.exportText}>📥 Descargar Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exportPdfBtn}
                  onPress={descargarPDF}
                >
                  <Text style={styles.exportText}>📥 Descargar PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabla configurada al 100% de ancho sin ScrollView horizontal forzado */}
            <View style={styles.tableContainer}>
              {/* Cabecera de Tabla */}
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1.2 }]}>Fecha</Text>
                <Text style={[styles.th, { flex: 2.5 }]}>Descripción</Text>
                <Text style={[styles.th, { flex: 2.5 }]}>Responsable</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Categoría</Text>
                <Text style={[styles.th, { flex: 1 }]}>Moneda</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>
                  Monto
                </Text>
              </View>

              {gastosFiltrados.map((item) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1.2 }]}>{item.fecha}</Text>
                  <Text style={[styles.td, { flex: 2.5 }]} numberOfLines={2}>
                    {item.descripcion}
                  </Text>
                  <Text style={[styles.td, { flex: 2.5 }]} numberOfLines={1}>
                    {item.nombreResponsable}
                  </Text>
                  <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                    {item.categoria}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>{item.moneda}</Text>
                  <Text
                    style={[
                      styles.td,
                      {
                        flex: 1.2,
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
            </View>
          </>
        ) : (
          <View style={styles.infoCardEmpleados}>
            <Text style={styles.infoTextEmpleados}>
              ℹ️ Tu rol de empleado permite registrar los gastos de forma
              exitosa. El listado general y reportes están reservados para la
              administración y secretaría.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
    width: "100%",
  },
  mainWrapper: {
    width: "100%",
    maxWidth: "100%",
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  formCard: {
    backgroundColor: colors.cardBackground,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  catButton: {
    backgroundColor: colors.background,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  catButtonSelected: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  catButtonText: { fontSize: 13, color: colors.textSecondary },
  catButtonTextSelected: { color: "#fff", fontWeight: "bold" },
  input: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.textPrimary,
    width: "100%",
  },
  button: {
    backgroundColor: "#e74c3c",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  filterExportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  searchFecha: {
    flex: 1,
    minWidth: 250,
    backgroundColor: colors.cardBackground,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    color: colors.textPrimary,
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
  tableContainer: {
    width: "100%", // Ocupa el 100% del ancho disponible en pantalla
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.accentBlue + "20",
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
  th: { fontWeight: "bold", color: colors.accentBlue, fontSize: 13 },
  tableRow: {
    flexDirection: "row",
    backgroundColor: colors.cardBackground,
    padding: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    width: "100%",
  },
  td: { fontSize: 13, color: colors.textPrimary },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 20,
    fontSize: 14,
  },
  infoCardEmpleados: {
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    width: "100%",
  },
  infoTextEmpleados: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
