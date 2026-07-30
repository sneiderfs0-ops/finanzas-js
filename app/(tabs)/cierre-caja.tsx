import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../supabase";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

interface CierreItem {
  id: string;
  fecha: string;
  total_intereses: number;
  total_gastos: number;
  ganancia_neta: number;
}

export default function ReporteGananciasScreen() {
  const [cierres, setCierres] = useState<CierreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarCierres();
  }, []);

  const cargarCierres = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cierres_caja")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.log("Error cargando cierres:", error.message);
      Alert.alert("Error", "No se pudo obtener el historial de ganancias.");
    } else {
      setCierres(data || []);
    }
    setLoading(false);
  };

  // Función para exportar y descargar en PDF
  const generarPDF = async () => {
    if (cierres.length === 0) {
      Alert.alert("Aviso", "No hay datos para generar el PDF.");
      return;
    }

    const filasHTML = cierres
      .map(
        (item) => `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #bdc3c7;">${item.fecha}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #bdc3c7;">$${Number(item.total_intereses).toFixed(2)}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #bdc3c7;">$${Number(item.total_gastos).toFixed(2)}</td>
          <td style="text-align: right; padding: 8px; border: 1px solid #bdc3c7; font-weight: bold; color: #27ae60;">$${Number(item.ganancia_neta).toFixed(2)}</td>
        </tr>
      `,
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2c3e50; padding: 20px; }
            h1 { text-align: center; color: #2c3e50; font-size: 18pt; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #7f8c8d; font-size: 10pt; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #34495e; color: white; padding: 10px; font-size: 10pt; border: 1px solid #bdc3c7; }
            td { font-size: 9pt; }
          </style>
        </head>
        <body>
          <h1>Reporte de Cierres de Caja y Ganancias</h1>
          <div class="subtitle">Histórico consolidado del negocio</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Total Intereses Recibidos</th>
                <th>Total Gastos</th>
                <th>Ganancia Neta</th>
              </tr>
            </thead>
            <tbody>
              ${filasHTML}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Error",
          "La compartición de archivos no está disponible en este dispositivo.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
        dialogTitle: "Guardar o Compartir PDF",
      });
    } catch (error: any) {
      console.log("Error al generar PDF:", error);
      Alert.alert(
        "Error",
        "No se pudo exportar el PDF: " + (error.message || ""),
      );
    }
  };

  // Función para exportar formato CSV compatible con Excel (.csv)
  const generarExcelCSV = async () => {
    if (cierres.length === 0) {
      Alert.alert("Aviso", "No hay datos para exportar.");
      return;
    }

    let csvContent =
      "Fecha,Total Intereses Recibidos,Total Gastos,Ganancia Neta\n";
    cierres.forEach((item) => {
      csvContent += `${item.fecha},${item.total_intereses},${item.total_gastos},${item.ganancia_neta}\n`;
    });

    try {
      const path = `${FileSystem.documentDirectory}reporte_ganancias.csv`;
      await FileSystem.writeAsStringAsync(path, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Error",
          "La compartición de archivos no está disponible en este dispositivo.",
        );
        return;
      }

      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: "Descargar Reporte en Excel",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error: any) {
      console.log("Error al exportar CSV/Excel:", error);
      Alert.alert(
        "Error",
        "No se pudo generar el archivo de Excel: " + (error.message || ""),
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0984e3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Historial de Ganancias</Text>
      <Text style={styles.subtitle}>Reporte detallado por cierres de caja</Text>

      {/* Botones de Descarga */}
      <View style={styles.botonesContainer}>
        <TouchableOpacity
          style={[styles.btnExport, styles.btnPdf]}
          onPress={generarPDF}
        >
          <Text style={styles.btnText}>📥 Descargar PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnExport, styles.btnExcel]}
          onPress={generarExcelCSV}
        >
          <Text style={styles.btnText}>📊 Descargar Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Tabla Visual en Pantalla */}
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.headerText, { flex: 1.2 }]}>
            Fecha
          </Text>
          <Text style={[styles.cell, styles.headerText]}>Intereses</Text>
          <Text style={[styles.cell, styles.headerText]}>Gastos</Text>
          <Text style={[styles.cell, styles.headerText]}>Ganancia</Text>
        </View>

        {cierres.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={[styles.cell, { flex: 1.2, textAlign: "center" }]}>
              {item.fecha}
            </Text>
            <Text style={[styles.cell, styles.textRight]}>
              ${Number(item.total_intereses).toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.textRight]}>
              ${Number(item.total_gastos).toFixed(2)}
            </Text>
            <Text style={[styles.cell, styles.textRight, styles.textGanancia]}>
              ${Number(item.ganancia_neta).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f6fa" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#2f3640" },
  subtitle: { fontSize: 14, color: "#718093", marginBottom: 16 },
  botonesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  btnExport: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  btnPdf: { backgroundColor: "#e74c3c" },
  btnExcel: { backgroundColor: "#27ae60" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  table: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dcdde1",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ecf0f1",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerRow: { backgroundColor: "#34495e" },
  cell: { fontSize: 13, color: "#2f3640", flex: 1, textAlign: "center" },
  headerText: { color: "#fff", fontWeight: "bold" },
  textRight: { textAlign: "right" },
  textGanancia: { fontWeight: "bold", color: "#27ae60" },
});
