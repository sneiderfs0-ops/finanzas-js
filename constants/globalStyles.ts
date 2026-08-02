import { StyleSheet } from "react-native";

export const colors = {
  background: "#0f172a", // Fondo oscuro principal
  cardBackground: "#1e293b", // Fondo de tarjetas y contenedores
  border: "#334155", // Bordes sutiles
  textPrimary: "#f8fafc", // Texto principal blanco/claro
  textSecondary: "#94a3b8", // Texto secundario gris claro
  primary: "#6366f1", // Azul/Índigo llamativo (botones)
  primaryHover: "#4f46e5",
  accentBlue: "#38bdf8", // Cian brillante
  accentGreen: "#4ade80", // Verde esmeralda brillante
  accentRed: "#f43f5e", // Rojo coral
  accentYellow: "#fbbf24", // Amarillo ámbar
  inputBackground: "#f8fafc", // Fondo para inputs en formularios claros si aplica
  inputDarkBg: "#0f172a", // Fondo de inputs en modo oscuro
};

export const globalStyles = StyleSheet.create({
  // Contenedores Principales
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 20,
    alignItems: "center",
  },
  mainWrapper: {
    width: "100%",
    maxWidth: 800,
  },

  // Tarjetas / Cards
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3, // Se mantiene para compatibilidad con Android
  },
  dashboardCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3, // Se mantiene para compatibilidad con Android
  },

  // Tipografía
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Entradas (Inputs)
  input: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.textPrimary,
  },

  // Botones
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3, // Se mantiene para compatibilidad con Android
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
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.06)",
    elevation: 3, // Se mantiene para compatibilidad con Android
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
});
