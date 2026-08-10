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
import { globalStyles, colors } from "../constants/globalStyles";

export default function ModalScreen() {
  return (
    <ScrollView contentContainerStyle={localStyles.scrollContainer}>
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />

      <View style={globalStyles.card}>
        {/* Cabecera del Modal */}
        <View style={localStyles.header}>
          <Text style={globalStyles.sectionTitle}>Información del Sistema</Text>
          <TouchableOpacity
            style={localStyles.closeButton}
            onPress={() => router.replace("../")} // Redirige directamente al index
            activeOpacity={0.7}
          >
            <Text style={localStyles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Imagen descriptiva de la aplicación */}
        <View style={localStyles.imageContainer}>
          <Image
            source={require("../assets/images/imagen.png")}
            style={localStyles.image}
            resizeMode="cover"
          />
        </View>

        {/* Badges / Etiquetas Tecnológicas */}
        <View style={localStyles.tagsContainer}>
          <View style={localStyles.tag}>
            <Text style={localStyles.tagText}>Ecosistema Fintech</Text>
          </View>
          <View style={localStyles.tagSecondary}>
            <Text style={localStyles.tagSecondaryText}>
              React Native + Expo
            </Text>
          </View>
          <View style={localStyles.tagSecondary}>
            <Text style={localStyles.tagSecondaryText}>Supabase Backend</Text>
          </View>
        </View>

        {/* Sección 1: Presentación del Sistema */}
        <View style={localStyles.section}>
          <Text style={localStyles.subHeaderTitle}>
            Plataforma Digital de Créditos
          </Text>
          <Text style={localStyles.paragraph}>
            Esta plataforma digital transforma la gestión crediticia al actuar
            como un puente financiero inteligente, diseñado para ofrecer
            liquidez inmediata de forma segura, transparente y eficiente. El
            sistema automatiza todo el ciclo de vida del crédito: desde la
            solicitud inicial y la evaluación del perfil del cliente, hasta el
            cálculo automatizado de tasas de interés y la estructuración de
            tablas de amortización en cuotas periódicas.
          </Text>
          <Text style={localStyles.paragraph}>
            Gracias a esto, los usuarios pueden financiar consumos, impulsar
            inversiones o resolver emergencias económicas con total claridad
            sobre sus compromisos de pago, mientras que la empresa prestamista
            obtiene un control centralizado, reducción de riesgos y una
            supervisión óptima de su cartera.
          </Text>
        </View>

        <View style={localStyles.divider} />

        {/* Sección 2: Arquitectura y Desarrollo */}
        <View style={localStyles.section}>
          <Text style={localStyles.subHeaderTitle}>
            Arquitectura & Desarrollo
          </Text>
          <Text style={localStyles.developerBadge}>
            💡 Desarrollado por:{" "}
            <Text style={localStyles.developerName}>Ing. E.G.</Text>
          </Text>
          <Text style={localStyles.paragraph}>
            Detrás de esta experiencia fluida existe una arquitectura
            tecnológica de vanguardia. El frontend de la aplicación está
            construido con una combinación líder en la industria que permite un
            despliegue ágil en múltiples sistemas operativos bajo un único
            código base, garantizando una interfaz móvil nativa, rápida y
            altamente intuitiva.
          </Text>
          <Text style={localStyles.paragraph}>
            Para el motor de la aplicación se integró como infraestructura de
            backend, lo que asegura una base de datos relacional robusta,
            sistemas de autenticación cifrados para proteger la información
            confidencial de los usuarios y sincronización en tiempo real para un
            control de cobros y pagos sin desfases. El resultado es un
            ecosistema Fintech de alto rendimiento, seguro y perfectamente
            escalable para el mercado financiero moderno.
          </Text>
        </View>

        {/* Botón Inferior para Entendido / Redirigir a Index */}
        <TouchableOpacity
          style={globalStyles.primaryButton}
          onPress={() => router.replace("../")} // Redirige directamente al index
          activeOpacity={0.8}
        >
          <Text style={globalStyles.primaryButtonText}>Entendido</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: colors.background,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.accentGreen,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  tagText: {
    color: "#0f172a",
    fontWeight: "bold",
    fontSize: 12,
  },
  tagSecondary: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  tagSecondaryText: {
    color: colors.accentBlue,
    fontWeight: "600",
    fontSize: 12,
  },
  section: {
    marginBottom: 12,
  },
  subHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  developerBadge: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.accentGreen,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  developerName: {
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: "justify",
  },
  boldText: {
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
});
