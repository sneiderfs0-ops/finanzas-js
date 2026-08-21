import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validación para avisarte en consola si faltan las llaves en el .env
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Faltan las variables de entorno de Supabase. Recuerda reiniciar con 'npx expo start -c'",
  );
}

// Configuración de almacenamiento y persistencia:
// - En Web: usamos sessionStorage para que la sesión se borre al cerrar la pestaña o el navegador.
// - En Móvil (APK): usamos AsyncStorage pero con persistSession en false para que la sesión se cierre al cerrar la app por completo.
const getStorage = () => {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.sessionStorage : undefined;
  }
  return AsyncStorage;
};

export const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      storage: getStorage(),
      autoRefreshToken: true,
      persistSession: Platform.OS === "web" ? true : false,
      detectSessionInUrl: false,
    },
  },
);
