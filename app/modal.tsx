import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function ModalScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />

      <View style={styles.card}>
        {/* Cabecera del Modal */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Información del Sistema</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Imagen descriptiva de la aplicación */}
        <View style={styles.imageContainer}>
          <Image
            source={require("../assets/images/imagen.png")}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        {/* Badges / Etiquetas Tecnológicas */}
        <View style={styles.tagsContainer}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Ecosistema Fintech</Text>
          </View>
          <View style={styles.tagSecondary}>
            <Text style={styles.tagSecondaryText}>React Native + Expo</Text>
          </View>
          <View style={styles.tagSecondary}>
            <Text style={styles.tagSecondaryText}>Supabase Backend</Text>
          </View>
        </View>

        {/* Sección 1: Presentación del Sistema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Plataforma Digital de Créditos
          </Text>
          <Text style={styles.paragraph}>
            Esta plataforma digital transforma la gestión crediticia al actuar
            como un puente financiero inteligente, diseñado para ofrecer
            liquidez inmediata de forma segura, transparente y eficiente. El
            sistema automatiza todo el ciclo de vida del crédito: desde la
            solicitud inicial y la evaluación del perfil del cliente, hasta el
            cálculo automatizado de tasas de interés y la estructuración de
            tablas de amortización en cuotas periódicas.
          </Text>
          <Text style={styles.paragraph}>
            Gracias a esto, los usuarios pueden financiar consumos, impulsar
            inversiones o resolver emergencias económicas con total claridad
            sobre sus compromisos de pago, mientras que la empresa prestamista
            obtiene un control centralizado, reducción de riesgos y una
            supervisión óptima de su cartera.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Sección 2: Arquitectura y Desarrollo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arquitectura & Desarrollo</Text>
          <Text style={styles.developerBadge}>
            💡 Desarrollado por:{" "}
            <Text style={styles.developerName}>Ing. Erika Grimaldo</Text>
          </Text>
          <Text style={styles.paragraph}>
            Detrás de esta experiencia fluida existe una arquitectura
            tecnológica de vanguardia. El frontend de la aplicación está
            construido con{" "}
            <Text style={styles.boldText}>React Native y Expo</Text>, una
            combinación líder en la industria que permite un despliegue ágil en
            múltiples sistemas operativos bajo un único código base,
            garantizando una interfaz móvil nativa, rápida y altamente
            intuitiva.
          </Text>
          <Text style={styles.paragraph}>
            Para el motor de la aplicación se integró{" "}
            <Text style={styles.boldText}>Supabase</Text> como infraestructura
            de backend, lo que asegura una base de datos relacional robusta,
            sistemas de autenticación cifrados para proteger la información
            confidencial de los usuarios y sincronización en tiempo real para un
            control de cobros y pagos sin desfases. El resultado es un
            ecosistema Fintech de alto rendimiento, seguro y perfectamente
            escalable para el mercado financiero moderno.
          </Text>
        </View>

        {/* Botón Inferior para Entendido / Cerrar */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Entendido</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f6fa",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: 650,
    borderRadius: 20,
    padding: 24,
    elevation: 5,
    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.08)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2f3640",
  },
  closeButton: {
    backgroundColor: "#f1f2f6",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#718093",
  },
  imageContainer: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#e1b12c",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    backgroundColor: "#2ed573",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  tagText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12,
  },
  tagSecondary: {
    backgroundColor: "#e1b12c15",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1b12c",
  },
  tagSecondaryText: {
    color: "#d48806",
    fontWeight: "600",
    fontSize: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e272e",
    marginBottom: 10,
  },
  developerBadge: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2ed573",
    fontSize: 14,
    color: "#57606f",
    marginBottom: 12,
  },
  developerName: {
    fontWeight: "bold",
    color: "#2f3640",
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4b6584",
    marginBottom: 12,
    textAlign: "justify",
  },
  boldText: {
    fontWeight: "bold",
    color: "#2f3640",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f2f6",
    marginVertical: 16,
  },
  actionButton: {
    backgroundColor: "#2f3640",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
});
