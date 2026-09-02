import { StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");
const isMobile = width < 768;

export const colors = {
  background: "#0d1424", // Fondo oscuro principal
  cardBackground: "#293143", // Fondo de tarjetas y contenedores
  border: "#334155", // Bordes sutiles
  textPrimary: "#f8fafc", // Texto principal blanco/claro
  textSecondary: "#bcc3cc", // Texto secundario gris claro
  primary: "#4f52f2", // Azul/Índigo llamativo (botones)
  primaryHover: "#4f46e5",
  accentBlue: "#38bdf8", // Cian brillante
  accentGreen: "#4ade80", // Verde esmeralda brillante
  accentRed: "#f43f5e", // Rojo coral
  accentYellow: "#fbbf24", // Amarillo ámbar
  inputBackground: "#f8fafc", // Fondo para inputs en formularios claros si aplica
  inputDarkBg: "#0d1424", // Fondo de inputs en modo oscuro
};

export const globalStyles = StyleSheet.create({
  // Contenedores Principales (Adaptados para no bloquear el scroll en móvil)
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: isMobile ? 16 : 20,
    justifyContent: isMobile ? "flex-start" : "center",
    alignItems: "center",
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: isMobile ? 16 : 20,
    paddingBottom: 80, // Espacio extra abajo para que el teclado no tape el último input
    alignItems: "center",
    justifyContent: isMobile ? "flex-start" : "center",
  },
  mainWrapper: {
    width: "100%",
    maxWidth: 800,
  },

  // Tarjetas / Cards (Ancho completo en móvil para aprovechar espacio)
  card: {
    width: "100%",
    maxWidth: isMobile ? "100%" : 420,
    backgroundColor: colors.cardBackground,
    borderRadius: isMobile ? 18 : 24,
    padding: isMobile ? 20 : 30,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  dashboardCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: isMobile ? 16 : 20,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },

  // Tipografía
  title: {
    fontSize: isMobile ? 22 : 26,
    fontWeight: "800",
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isMobile ? 13 : 14,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Entradas (Inputs más cómodos al tacto en móvil)
  input: {
    backgroundColor: colors.background,
    padding: isMobile ? 14 : 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    fontSize: 16, // Evita zoom automático en iOS y es cómodo en Android
    color: colors.textPrimary,
  },

  // Botones
  primaryButton: {
    backgroundColor: colors.primary,
    padding: isMobile ? 14 : 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Modales / Pantallas Emergentes
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: isMobile ? 16 : 28,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: isMobile ? 20 : 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
});
